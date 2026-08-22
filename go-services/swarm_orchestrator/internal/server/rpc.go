// Package server exposes the swarm orchestrator through JSON-RPC 2.0 over a
// Unix domain socket, pushing live "event" notifications to every connected
// client.
package server

import (
	"encoding/json"
	"fmt"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
)

// Standard JSON-RPC 2.0 error codes.
const (
	codeParseError     = -32700
	codeInvalidRequest = -32600
	codeMethodNotFound = -32601
	codeInvalidParams  = -32602
	codeInternalError  = -32603
)

// Application error codes (server-defined range).
const (
	codeUnknownTask  = -32001
	codeTaskConflict = -32002
	codeQueueFull    = -32003
	codeShuttingDown = -32004
	codeSocketInUse  = -32005
)

// rpcRequest is one inbound JSON-RPC 2.0 call or notification.
type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
	ID      json.RawMessage `json:"id"`
}

// isNotification reports whether the request must not be answered.
func (r *rpcRequest) isNotification() bool {
	return len(r.ID) == 0 || string(r.ID) == "null"
}

// rpcError is the JSON-RPC error object.
type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func (e *rpcError) Error() string {
	return fmt.Sprintf("jsonrpc error %d: %s", e.Code, e.Message)
}

// errf builds an *rpcError with an optional detail payload.
func errf(code int, format string, args ...any) *rpcError {
	return &rpcError{Code: code, Message: fmt.Sprintf(format, args...)}
}

// response frames are assembled as ordered maps for deterministic output.
func resultFrame(id json.RawMessage, result any) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": rawID(id), "result": result}
}

func errorFrame(id json.RawMessage, rpcErr *rpcError) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": rawID(id), "error": rpcErr}
}

func eventNotification(ev domain.Event) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "method": "event", "params": ev}
}

// rawID preserves null ids verbatim instead of emitting an empty field.
func rawID(id json.RawMessage) any {
	if len(id) == 0 {
		return nil
	}
	return id
}

// submitParams / statusParams / cancelParams mirror the wire contract.

type submitParams struct {
	TaskID     string   `json:"taskId"`
	Task       string   `json:"task"`
	AgentChain []string `json:"agentChain"` // optional; defaults to the canonical chain
}

type taskRefParams struct {
	TaskID string `json:"taskId"`
}

type submitResult struct {
	Accepted bool   `json:"accepted"`
	TaskID   string `json:"taskId"`
}

type cancelResult struct {
	Cancelled bool   `json:"cancelled"`
	TaskID    string `json:"taskId"`
}
