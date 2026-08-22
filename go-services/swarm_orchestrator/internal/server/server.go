package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"sync"
	"time"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
)

// writeTimeout bounds every individual frame write to a client.
const writeTimeout = 5 * time.Second

// errSocketInUse signals another orchestrator already owns the socket path.
var errSocketInUse = errors.New("socket already served by another orchestrator")

// OrchestratorAPI narrows the pipeline surface the RPC layer depends on.
type OrchestratorAPI interface {
	Submit(task domain.AgentTask) error
	Status(taskID string) (domain.TaskStatus, bool)
	Cancel(taskID string) (bool, error)
}

// Server serves JSON-RPC 2.0 over a Unix domain socket. Every connected
// client receives "event" push notifications broadcast by the Hub.
type Server struct {
	orch OrchestratorAPI
	hub  *Hub
	path string

	ln     net.Listener
	wg     sync.WaitGroup // per-connection goroutines
	mu     sync.Mutex
	conns  map[net.Conn]struct{}
	closed bool
}

// New builds a server bound to a socket path.
func New(orch OrchestratorAPI, hub *Hub, path string) (*Server, error) {
	if orch == nil {
		return nil, errors.New("server: orchestrator is required")
	}
	if hub == nil {
		return nil, errors.New("server: event hub is required")
	}
	if path == "" {
		return nil, errors.New("server: socket path must not be empty")
	}
	return &Server{
		orch:  orch,
		hub:   hub,
		path:  path,
		conns: make(map[net.Conn]struct{}),
	}, nil
}

// SocketPath returns the configured Unix socket path.
func (s *Server) SocketPath() string { return s.path }

// Start probes for a live instance on the same socket, cleans stale files
// and begins accepting connections.
func (s *Server) Start(_ context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ln != nil {
		return errors.New("server: already started")
	}
	if _, err := os.Stat(s.path); err == nil {
		probe, dialErr := net.DialTimeout("unix", s.path, 500*time.Millisecond)
		if dialErr == nil {
			probe.Close()
			return fmt.Errorf("server: %w at %s", errSocketInUse, s.path)
		}
		if rmErr := os.Remove(s.path); rmErr != nil {
			return fmt.Errorf("server: remove stale socket %s: %w", s.path, rmErr)
		}
	}
	ln, err := net.Listen("unix", s.path)
	if err != nil {
		return fmt.Errorf("server: listen on %s: %w", s.path, err)
	}
	s.ln = ln

	s.wg.Add(1)
	go s.acceptLoop(ln)
	return nil
}

// Stop closes the listener and every connection, waits for handlers and
// removes the socket file from disk.
func (s *Server) Stop(ctx context.Context) error {
	s.mu.Lock()
	if s.closed || s.ln == nil {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	ln := s.ln
	conns := make([]net.Conn, 0, len(s.conns))
	for c := range s.conns {
		conns = append(conns, c)
	}
	s.mu.Unlock()

	closeErr := ln.Close()
	for _, c := range conns {
		c.Close() // readers observe EOF and unwind
	}

	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()
	var waitErr error
	select {
	case <-done:
	case <-ctx.Done():
		waitErr = fmt.Errorf("server: stop deadline exceeded: %w", ctx.Err())
	}
	if waitErr != nil {
		return errors.Join(waitErr, closeErr, s.forceCleanupSocket())
	}

	if rmErr := os.Remove(s.path); rmErr != nil && !os.IsNotExist(rmErr) {
		closeErr = errors.Join(closeErr, fmt.Errorf("server: remove socket %s: %w", s.path, rmErr))
	}
	return closeErr
}

// forceCleanupSocket removes the socket file even when handlers could not be
// reaped within the stop deadline.
func (s *Server) forceCleanupSocket() error {
	if rmErr := os.Remove(s.path); rmErr != nil && !os.IsNotExist(rmErr) {
		return fmt.Errorf("server: remove socket %s: %w", s.path, rmErr)
	}
	return nil
}

func (s *Server) acceptLoop(ln net.Listener) {
	defer s.wg.Done()
	for {
		conn, err := ln.Accept()
		if err != nil {
			if s.isClosed() || errors.Is(err, net.ErrClosed) {
				return
			}
			continue
		}
		s.track(conn, true)
		s.wg.Add(1)
		go s.serveConn(conn)
	}
}

func (s *Server) isClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closed
}

func (s *Server) track(c net.Conn, add bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if add {
		s.conns[c] = struct{}{}
	} else {
		delete(s.conns, c)
	}
}

// serveConn runs the read loop for one client; a dedicated writer serializes
// responses and broadcast notifications onto the socket.
func (s *Server) serveConn(conn net.Conn) {
	defer s.wg.Done()
	defer conn.Close()
	defer s.track(conn, false)

	outbound := make(chan map[string]any, subscriberChanSize)
	writerDone := make(chan struct{})
	pumpDone := make(chan struct{})
	sub := s.hub.Subscribe()

	go s.writeLoop(conn, outbound, writerDone)
	go func() {
		defer close(pumpDone)
		s.notifyPump(sub, outbound)
	}()

	dec := json.NewDecoder(conn)
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			if !isStreamEnd(err) {
				s.trySend(outbound, errorFrame(nil, errf(codeParseError, "parse error: %v", err)))
			}
			break
		}
		resp := s.dispatch(raw)
		if resp == nil {
			continue // notification: never answered per JSON-RPC 2.0
		}
		if !s.trySend(outbound, resp) {
			break // writer gone or hopelessly backed up
		}
	}

	// Stop the event flow before closing the outbound queue so the pump can
	// never send into a closed channel.
	sub.Unsubscribe()
	<-pumpDone
	close(outbound)
	<-writerDone
}

// dispatch validates one raw frame and produces the response (nil for
// inbound notifications).
func (s *Server) dispatch(raw []byte) map[string]any {
	trimmed := bytes.TrimLeft(raw, " \t\r\n")
	if len(trimmed) > 0 && trimmed[0] == '[' {
		return errorFrame(nil, errf(codeInvalidRequest, "batch requests are not supported"))
	}
	var req rpcRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return errorFrame(nil, errf(codeInvalidRequest, "invalid request object: %v", err))
	}
	if req.JSONRPC != "2.0" {
		return errorFrame(req.ID, errf(codeInvalidRequest, `jsonrpc field must be exactly "2.0"`))
	}
	if req.isNotification() {
		_, _ = s.call(&req) // side effects only, no reply per JSON-RPC 2.0
		return nil
	}

	result, rpcErr := s.call(&req)
	if rpcErr != nil {
		return errorFrame(req.ID, rpcErr)
	}
	return resultFrame(req.ID, result)
}

// call executes the method and returns either a result or an error.
func (s *Server) call(req *rpcRequest) (any, *rpcError) {
	switch req.Method {
	case "orchestrator.submit":
		return s.handleSubmit(req.Params)
	case "orchestrator.status":
		return s.handleStatus(req.Params)
	case "orchestrator.cancel":
		return s.handleCancel(req.Params)
	default:
		return nil, errf(codeMethodNotFound, "method %q not found", req.Method)
	}
}

func decodeParams(raw json.RawMessage, into any) *rpcError {
	if len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, into); err != nil {
		return errf(codeInvalidParams, "invalid params: %v", err)
	}
	return nil
}

func (s *Server) handleSubmit(raw json.RawMessage) (any, *rpcError) {
	var p submitParams
	if rpcErr := decodeParams(raw, &p); rpcErr != nil {
		return nil, rpcErr
	}
	task := domain.AgentTask{ID: p.TaskID, Prompt: p.Task, Chain: p.AgentChain}
	if err := s.orch.Submit(task); err != nil {
		return nil, mapSubmitError(err)
	}
	return submitResult{Accepted: true, TaskID: p.TaskID}, nil
}

func (s *Server) handleStatus(raw json.RawMessage) (any, *rpcError) {
	var p taskRefParams
	if rpcErr := decodeParams(raw, &p); rpcErr != nil {
		return nil, rpcErr
	}
	status, ok := s.orch.Status(p.TaskID)
	if !ok {
		return nil, errf(codeUnknownTask, "%s: %q", domain.ErrUnknownTask, p.TaskID)
	}
	return status, nil
}

func (s *Server) handleCancel(raw json.RawMessage) (any, *rpcError) {
	var p taskRefParams
	if rpcErr := decodeParams(raw, &p); rpcErr != nil {
		return nil, rpcErr
	}
	accepted, err := s.orch.Cancel(p.TaskID)
	if err != nil {
		return nil, errf(codeUnknownTask, "%s", err.Error())
	}
	return cancelResult{Cancelled: accepted, TaskID: p.TaskID}, nil
}

// mapSubmitError converts pipeline sentinel errors into JSON-RPC codes.
func mapSubmitError(err error) *rpcError {
	switch {
	case errors.Is(err, domain.ErrTaskConflict):
		return errf(codeTaskConflict, "%s", err.Error())
	case errors.Is(err, domain.ErrQueueFull):
		return errf(codeQueueFull, "%s", err.Error())
	case errors.Is(err, domain.ErrShuttingDown):
		return errf(codeShuttingDown, "%s", err.Error())
	default:
		return errf(codeInvalidParams, "%s", err.Error())
	}
}

// trySend enqueues a frame without blocking; false means the consumer is
// gone or permanently stalled.
func (s *Server) trySend(outbound chan<- map[string]any, frame map[string]any) bool {
	select {
	case outbound <- frame:
		return true
	default:
		return false
	}
}

func (s *Server) writeLoop(conn net.Conn, outbound <-chan map[string]any, done chan<- struct{}) {
	defer close(done)
	enc := json.NewEncoder(conn)
	for frame := range outbound {
		if err := conn.SetWriteDeadline(time.Now().Add(writeTimeout)); err != nil {
			continue
		}
		if err := enc.Encode(frame); err != nil {
			return
		}
	}
}

// notifyPump forwards hub broadcasts into the connection's outbound queue,
// dropping frames for slow clients instead of blocking the hub.
func (s *Server) notifyPump(sub *Subscription, outbound chan<- map[string]any) {
	for {
		select {
		case ev := <-sub.Events:
			frame := eventNotification(ev)
			select {
			case outbound <- frame:
			default:
			}
		case <-sub.Done():
			return
		}
	}
}

// isStreamEnd distinguishes clean connection teardown from protocol garbage.
func isStreamEnd(err error) bool {
	return errors.Is(err, io.EOF) ||
		errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, net.ErrClosed) ||
		errors.Is(err, os.ErrClosed)
}
