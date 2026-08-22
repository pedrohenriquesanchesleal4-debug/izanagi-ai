// Package domain defines the shared vocabulary of the swarm orchestrator:
// agent tasks, pipeline stages, execution events and the pluggable executor
// contract. Both the pipeline engine and the RPC server depend only on this
// package, which keeps them decoupled from each other.
package domain

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"
)

// TaskState is the coarse lifecycle state reported by orchestrator.status.
type TaskState string

const (
	StateQueued  TaskState = "queued"
	StateRunning TaskState = "running"
	StateDone    TaskState = "done"
	StateFailed  TaskState = "failed"
)

// Terminal reports whether the state is final and will not change anymore.
func (s TaskState) Terminal() bool {
	return s == StateDone || s == StateFailed
}

// Canonical roles of the default swarm chain:
// architect -> senior-engineer -> qa -> security.
const (
	RoleArchitect      = "architect"
	RoleSeniorEngineer = "senior-engineer"
	RoleQA             = "qa"
	RoleSecurity       = "security"
)

// DefaultChain returns the canonical role chain of the orchestrator.
func DefaultChain() []string {
	return []string{RoleArchitect, RoleSeniorEngineer, RoleQA, RoleSecurity}
}

// Sentinel errors shared across layers.
var (
	ErrUnknownTask  = errors.New("unknown task")
	ErrTaskConflict = errors.New("task id already active")
	ErrQueueFull    = errors.New("ingress queue is full")
	ErrShuttingDown = errors.New("orchestrator is shutting down")
)

// Event types emitted into the per-task event log and broadcast as push
// notifications over the RPC socket.
const (
	EventTaskSubmitted  = "task.submitted"
	EventStageStarted   = "stage.started"
	EventStageCompleted = "stage.completed"
	EventStageFailed    = "stage.failed"
	EventTaskCompleted  = "task.completed"
	EventTaskFailed     = "task.failed"
	EventTaskCanceled   = "task.canceled"
	EventTaskDropped    = "task.dropped"
)

// Event is a single timestamped occurrence in the life of a task. Its JSON
// shape matches the push-notification params sent over the RPC socket.
type Event struct {
	TaskID string         `json:"taskId"`
	Type   string         `json:"type"`
	Data   map[string]any `json:"data,omitempty"`
	At     time.Time      `json:"at"`
}

// NewEvent builds an event stamped with the current UTC time.
func NewEvent(taskID, typ string, data map[string]any) Event {
	return Event{TaskID: taskID, Type: typ, Data: data, At: time.Now().UTC()}
}

// AgentTask is a unit of work submitted to the orchestrator.
type AgentTask struct {
	ID     string   // unique identifier, reused as artifact directory name
	Prompt string   // natural-language description of the work
	Chain  []string // ordered roles the task flows through
}

// taskIDPattern constrains identifiers so they are always safe to embed in
// filesystem paths (artifact directories).
var taskIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)

// ValidateTaskID enforces a conservative charset for task identifiers,
// rejecting path separators and traversal sequences outright.
func ValidateTaskID(id string) error {
	if !taskIDPattern.MatchString(id) {
		return fmt.Errorf("invalid taskId %q: must match %s", id, taskIDPattern.String())
	}
	return nil
}

// ValidateChain ensures the chain is non-empty and every role is registered.
func ValidateChain(chain []string, registered func(role string) bool) error {
	if len(chain) == 0 {
		return errors.New("agent chain must declare at least one stage")
	}
	for i, role := range chain {
		if role == "" {
			return fmt.Errorf("agent chain position %d: empty role", i)
		}
		if !registered(role) {
			return fmt.Errorf("agent chain position %d: unknown role %q", i, role)
		}
	}
	return nil
}

// StageInput carries everything an executor needs to produce one artifact.
type StageInput struct {
	TaskID      string        // owning task id
	Prompt      string        // original user prompt
	Role        string        // role executing this stage
	Index       int           // zero-based position inside the chain
	TotalStages int           // length of the chain
	Previous    []StageOutput // outputs produced by earlier stages
}

// StageOutput is the result of one executed stage.
type StageOutput struct {
	Role         string
	Index        int
	Content      string // full markdown body also persisted on disk
	ArtifactPath string // absolute path of the artifact written by the executor
}

// StageExecutor performs the actual work of one pipeline stage. The default
// implementation persists real artifacts on disk; alternative implementations
// may call external tooling without touching the pipeline machinery.
type StageExecutor interface {
	Execute(ctx context.Context, in StageInput) (StageOutput, error)
}

// EventBus receives every orchestration event so transport layers can push
// live notifications to connected clients.
type EventBus interface {
	Publish(ev Event)
}

// TaskStatus is the read model returned by orchestrator.status.
type TaskStatus struct {
	TaskID string    `json:"taskId"`
	State  TaskState `json:"state"`
	Stage  string    `json:"stage"`
	Error  string    `json:"error,omitempty"`
	Events []Event   `json:"events"`
}
