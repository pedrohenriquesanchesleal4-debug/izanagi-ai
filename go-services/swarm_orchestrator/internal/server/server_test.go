package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/pipeline"
)

const testSettleTimeout = 5 * time.Second

// rpcErrorView mirrors the JSON-RPC error object on the wire.
type rpcErrorView struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// rpcFrame is any single JSON-RPC message: response, request or notification.
type rpcFrame struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  *string         `json:"method"`
	Params  json.RawMessage `json:"params"`
	ID      json.RawMessage `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *rpcErrorView   `json:"error"`
}

// rpcClient speaks newline-delimited JSON-RPC over the orchestrator socket,
// demultiplexing broadcast notifications from responses.
type rpcClient struct {
	t      *testing.T
	conn   net.Conn
	dec    *json.Decoder // persistent stream decoder; never recreated
	mu     sync.Mutex
	nextID int64
	events []rpcFrame
}

func newRPCClient(t *testing.T, sockPath string) *rpcClient {
	t.Helper()
	conn, err := net.Dial("unix", sockPath)
	if err != nil {
		t.Fatalf("dial %s: %v", sockPath, err)
	}
	t.Cleanup(func() { conn.Close() })
	return &rpcClient{t: t, conn: conn, dec: json.NewDecoder(conn)}
}

func (c *rpcClient) writeRaw(line string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.SetWriteDeadline(time.Now().Add(testSettleTimeout))
	_, err := c.conn.Write([]byte(line))
	return err
}

func (c *rpcClient) call(method string, params any) (json.RawMessage, *rpcErrorView) {
	c.t.Helper()
	c.mu.Lock()
	c.nextID++
	id := c.nextID
	c.mu.Unlock()

	req := map[string]any{"jsonrpc": "2.0", "id": id, "method": method}
	if params != nil {
		req["params"] = params
	}
	raw, err := json.Marshal(req)
	if err != nil {
		c.t.Fatalf("marshal request: %v", err)
	}
	if err := c.writeRaw(string(raw) + "\n"); err != nil {
		c.t.Fatalf("write request: %v", err)
	}

	for {
		f := c.readFrame()
		if f.Method != nil && len(f.ID) == 0 {
			c.events = append(c.events, f) // server notification
			continue
		}
		var got int64
		_ = json.Unmarshal(f.ID, &got)
		if got != id {
			continue // stale frame; keep scanning
		}
		return f.Result, f.Error
	}
}

func (c *rpcClient) readFrame() rpcFrame {
	c.t.Helper()
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.SetReadDeadline(time.Now().Add(testSettleTimeout))
	var f rpcFrame
	if err := c.dec.Decode(&f); err != nil {
		c.t.Fatalf("decode frame: %v", err)
	}
	return f
}

// waitForEvent keeps consuming frames until a notification of the given type
// arrives for taskId.
func (c *rpcClient) waitForEvent(taskID, typ string) rpcFrame {
	c.t.Helper()
	check := func(f rpcFrame) bool {
		if f.Method == nil || *f.Method != "event" {
			return false
		}
		var ev domain.Event
		if err := json.Unmarshal(f.Params, &ev); err != nil {
			return false
		}
		return ev.TaskID == taskID && ev.Type == typ
	}
	for _, f := range c.events {
		if check(f) {
			return f
		}
	}
	deadline := time.Now().Add(testSettleTimeout)
	for time.Now().Before(deadline) {
		f := c.readFrame()
		if f.Method != nil && len(f.ID) == 0 {
			c.events = append(c.events, f)
			if check(f) {
				return f
			}
			continue
		}
	}
	c.t.Fatalf("notification %s for %s not observed", typ, taskID)
	return rpcFrame{}
}

func startStack(t *testing.T, opts pipeline.Options) (*pipeline.Orchestrator, *Server, string) {
	t.Helper()
	root := t.TempDir()
	sock := filepath.Join(root, "orch.sock")
	opts.ArtifactsRoot = root

	hub := NewHub()
	o, err := pipeline.New(pipeline.NewFileArtifactExecutor(root), hub, opts)
	if err != nil {
		t.Fatalf("pipeline.New: %v", err)
	}
	if err := o.Start(context.Background()); err != nil {
		t.Fatalf("orch.Start: %v", err)
	}
	srv, err := New(o, hub, sock)
	if err != nil {
		t.Fatalf("server.New: %v", err)
	}
	if err := srv.Start(context.Background()); err != nil {
		t.Fatalf("server.Start: %v", err)
	}
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
		shCtx, cancelSh := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelSh()
		_ = o.Shutdown(shCtx)
	})
	return o, srv, sock
}

func waitDoneViaRPC(t *testing.T, c *rpcClient, taskID string) domain.TaskStatus {
	t.Helper()
	deadline := time.Now().Add(testSettleTimeout)
	for time.Now().Before(deadline) {
		res, rerr := c.call("orchestrator.status", map[string]string{"taskId": taskID})
		if rerr != nil {
			c.t.Fatalf("status %s: code=%d msg=%s", taskID, rerr.Code, rerr.Message)
		}
		var st domain.TaskStatus
		if err := json.Unmarshal(res, &st); err != nil {
			c.t.Fatalf("unmarshal status: %v", err)
		}
		if st.State.Terminal() {
			return st
		}
		time.Sleep(5 * time.Millisecond)
	}
	c.t.Fatalf("task %s did not settle in time", taskID)
	return domain.TaskStatus{}
}

func TestFullUDSCycleInTempDir(t *testing.T) {
	root := t.TempDir()
	sock := filepath.Join(root, "cycle.sock")
	artifacts := filepath.Join(root, "artifacts")

	hub := NewHub()
	o, err := pipeline.New(pipeline.NewFileArtifactExecutor(artifacts), hub, pipeline.Options{
		ArtifactsRoot: artifacts,
	})
	if err != nil {
		t.Fatalf("pipeline.New: %v", err)
	}
	ctx := context.Background()
	if err := o.Start(ctx); err != nil {
		t.Fatalf("orch.Start: %v", err)
	}
	srv, err := New(o, hub, sock)
	if err != nil {
		t.Fatalf("server.New: %v", err)
	}
	if err := srv.Start(ctx); err != nil {
		t.Fatalf("server.Start: %v", err)
	}

	c := newRPCClient(t, sock)

	// submit without agentChain -> canonical chain
	res, rerr := c.call("orchestrator.submit", map[string]any{
		"taskId": "e2e-task",
		"task":   "entregar ciclo completo via socket",
	})
	if rerr != nil {
		t.Fatalf("submit: %+v", rerr)
	}
	var accepted struct {
		Accepted bool   `json:"accepted"`
		TaskID   string `json:"taskId"`
	}
	if err := json.Unmarshal(res, &accepted); err != nil {
		t.Fatalf("unmarshal submit result: %v", err)
	}
	if !accepted.Accepted || accepted.TaskID != "e2e-task" {
		t.Fatalf("unexpected submit result: %+v", accepted)
	}

	st := waitDoneViaRPC(t, c, "e2e-task")
	if st.Stage != domain.RoleSecurity {
		t.Fatalf("final stage = %q, want security", st.Stage)
	}
	for _, name := range []string{"01-architect.md", "02-senior-engineer.md", "03-qa.md", "04-security.md"} {
		if _, err := os.Stat(filepath.Join(artifacts, "e2e-task", name)); err != nil {
			t.Fatalf("artifact %s missing: %v", name, err)
		}
	}

	c.waitForEvent("e2e-task", domain.EventStageCompleted)
	c.waitForEvent("e2e-task", domain.EventTaskCompleted)

	// cancelling an already-terminal task is a documented no-op
	res, rerr = c.call("orchestrator.cancel", map[string]string{"taskId": "e2e-task"})
	if rerr != nil {
		t.Fatalf("cancel terminal: %+v", rerr)
	}
	var noop struct {
		Cancelled bool `json:"cancelled"`
	}
	_ = json.Unmarshal(res, &noop)
	if noop.Cancelled {
		t.Fatalf("cancelling a done task must be a no-op, got %s", res)
	}

	// error surface
	if _, rerr = c.call("orchestrator.status", map[string]string{"taskId": "fantasma"}); rerr == nil || rerr.Code != codeUnknownTask {
		t.Fatalf("unknown status err = %+v", rerr)
	}
	if _, rerr = c.call("orchestrator.cancel", map[string]string{"taskId": "fantasma"}); rerr == nil || rerr.Code != codeUnknownTask {
		t.Fatalf("unknown cancel err = %+v", rerr)
	}
	if _, rerr = c.call("orchestrator.explode", nil); rerr == nil || rerr.Code != codeMethodNotFound {
		t.Fatalf("unknown method err = %+v", rerr)
	}
	if _, rerr = c.call("orchestrator.submit", map[string]any{"taskId": "../traversal", "task": "x"}); rerr == nil || rerr.Code != codeInvalidParams {
		t.Fatalf("invalid params err = %+v", rerr)
	}

	if err := srv.Stop(context.Background()); err != nil {
		t.Fatalf("server stop: %v", err)
	}
	if _, err := os.Stat(sock); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("socket file not removed (%v)", err)
	}
	if err := o.Shutdown(context.Background()); err != nil {
		t.Fatalf("orch shutdown: %v", err)
	}
}

func TestProtocolErrorsOverSocket(t *testing.T) {
	_, _, sock := startStack(t, pipeline.Options{})

	// A parse error corrupts stream framing: the server replies -32700 and
	// closes that connection; each malformed case therefore gets a fresh one.
	c := newRPCClient(t, sock)
	if err := c.writeRaw("{definitivamente nao json}\n"); err != nil {
		t.Fatalf("write raw: %v", err)
	}
	f := c.readFrame()
	if f.Error == nil || f.Error.Code != codeParseError {
		t.Fatalf("want parse error -32700, got %+v", f.Error)
	}

	c = newRPCClient(t, sock)
	if err := c.writeRaw("[{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"orchestrator.status\"}]\n"); err != nil {
		t.Fatalf("write batch: %v", err)
	}
	f = c.readFrame()
	if f.Error == nil || f.Error.Code != codeInvalidRequest {
		t.Fatalf("batch must be rejected with -32600, got %+v", f.Error)
	}

	if err := c.writeRaw(`{"jsonrpc":"1.0","id":9,"method":"orchestrator.status","params":{"taskId":"x"}}` + "\n"); err != nil {
		t.Fatalf("write bad version: %v", err)
	}
	f = c.readFrame()
	if f.Error == nil || f.Error.Code != codeInvalidRequest || strings.TrimSpace(string(f.ID)) != "9" {
		t.Fatalf("bad version err = %+v id=%s", f.Error, f.ID)
	}
}

// gateExecutor blocks every task's first stage until released, giving tests
// a deterministic window where tasks are queued or running.
type gateExecutor struct {
	release chan struct{}
}

func (g *gateExecutor) Execute(ctx context.Context, in domain.StageInput) (domain.StageOutput, error) {
	select {
	case <-g.release:
	case <-ctx.Done():
		return domain.StageOutput{}, ctx.Err()
	}
	return domain.StageOutput{Role: in.Role, Index: in.Index, Content: "ok"}, nil
}

func TestCancelRunningTaskOverSocket(t *testing.T) {
	root := t.TempDir()
	sock := filepath.Join(root, "cancel.sock")
	hub := NewHub()
	exec := &gateExecutor{release: make(chan struct{})}
	o, err := pipeline.New(exec, hub, pipeline.Options{
		WorkersPerStage: 1,
		IngressDepth:    16,
		ArtifactsRoot:   root,
	})
	if err != nil {
		t.Fatalf("pipeline.New: %v", err)
	}
	if err := o.Start(context.Background()); err != nil {
		t.Fatalf("orch.Start: %v", err)
	}
	srv, err := New(o, hub, sock)
	if err != nil {
		t.Fatalf("server.New: %v", err)
	}
	if err := srv.Start(context.Background()); err != nil {
		t.Fatalf("server.Start: %v", err)
	}
	defer close(exec.release)

	c := newRPCClient(t, sock)
	if _, rerr := c.call("orchestrator.submit", map[string]any{
		"taskId": "running-cancel",
		"task":   "vai ser cancelada rodando",
	}); rerr != nil {
		t.Fatalf("submit: %+v", rerr)
	}

	// wait until the task reports running
	deadline := time.Now().Add(testSettleTimeout)
	for {
		res, _ := c.call("orchestrator.status", map[string]string{"taskId": "running-cancel"})
		var st domain.TaskStatus
		_ = json.Unmarshal(res, &st)
		if st.State == domain.StateRunning {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("task never ran: %+v", st)
		}
		time.Sleep(4 * time.Millisecond)
	}

	res, rerr := c.call("orchestrator.cancel", map[string]string{"taskId": "running-cancel"})
	if rerr != nil {
		t.Fatalf("cancel running: %+v", rerr)
	}
	var cancelled struct {
		Cancelled bool `json:"cancelled"`
	}
	_ = json.Unmarshal(res, &cancelled)
	if !cancelled.Cancelled {
		t.Fatalf("expected cancelled=true, got %s", res)
	}

	st := waitDoneViaRPC(t, c, "running-cancel")
	if st.State != domain.StateFailed || st.Stage != domain.RoleArchitect {
		t.Fatalf("canceled task status = %+v", st)
	}
	if _, err := os.Stat(filepath.Join(root, "running-cancel")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("no artifact expected for canceled task (%v)", err)
	}
}

func TestSecondInstanceRejectedOnLiveSocket(t *testing.T) {
	_, _, sock := startStack(t, pipeline.Options{})
	hub := NewHub()
	dup, err := New(fakeAPI{}, hub, sock)
	if err != nil {
		t.Fatalf("New duplicate: %v", err)
	}
	err = dup.Start(context.Background())
	if err == nil || !errors.Is(err, errSocketInUse) {
		t.Fatalf("duplicate Start err = %v, want errSocketInUse", err)
	}
	if _, statErr := os.Stat(sock); statErr != nil {
		t.Fatalf("live socket must remain intact: %v", statErr)
	}
}

func TestStaleSocketFileReclaimed(t *testing.T) {
	root := t.TempDir()
	sock := filepath.Join(root, "stale.sock")

	// A leftover non-socket file (or a socket whose owner died without
	// unlinking it) must not prevent startup.
	if err := os.WriteFile(sock, []byte("stale"), 0o644); err != nil {
		t.Fatalf("create stale file: %v", err)
	}

	hub := NewHub()
	srv, err := New(fakeAPI{}, hub, sock)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := srv.Start(context.Background()); err != nil {
		t.Fatalf("Start over stale socket: %v", err)
	}
	stopCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := srv.Stop(stopCtx); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	if _, err := os.Stat(sock); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("socket not removed after stop: %v", err)
	}
}

func TestParallelClientsEndToEndWithoutRace(t *testing.T) {
	_, _, sock := startStack(t, pipeline.Options{})

	const clients = 8
	var wg sync.WaitGroup
	errs := make(chan error, clients)
	for i := range clients {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			id := fmt.Sprintf("par-%02d", i)
			conn, err := net.Dial("unix", sock)
			if err != nil {
				errs <- fmt.Errorf("%s dial: %w", id, err)
				return
			}
			defer conn.Close()
			c := &rpcClient{t: t, conn: conn, dec: json.NewDecoder(conn)}
			if _, rerr := c.call("orchestrator.submit", map[string]any{
				"taskId": id,
				"task":   fmt.Sprintf("cliente paralelo %d", i),
			}); rerr != nil {
				errs <- fmt.Errorf("%s submit: %s", id, rerr.Message)
				return
			}
			deadline := time.Now().Add(testSettleTimeout)
			for time.Now().Before(deadline) {
				res, _ := c.call("orchestrator.status", map[string]string{"taskId": id})
				var st domain.TaskStatus
				_ = json.Unmarshal(res, &st)
				if st.State == domain.StateDone {
					return
				}
				time.Sleep(4 * time.Millisecond)
			}
			errs <- fmt.Errorf("%s did not finish in time", id)
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}
}

type fakeAPI struct{}

func (fakeAPI) Submit(domain.AgentTask) error { return nil }

func (fakeAPI) Status(string) (domain.TaskStatus, bool) { return domain.TaskStatus{}, false }

func (fakeAPI) Cancel(string) (bool, error) { return false, domain.ErrUnknownTask }
