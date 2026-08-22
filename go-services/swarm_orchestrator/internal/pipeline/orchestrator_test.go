package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
)

// recordingBus collects every published event for assertions.
type recordingBus struct {
	mu     sync.Mutex
	events []domain.Event
}

func newRecordingBus() *recordingBus { return &recordingBus{} }

func (b *recordingBus) Publish(ev domain.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events = append(b.events, ev)
}

func (b *recordingBus) types() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]string, len(b.events))
	for i, ev := range b.events {
		out[i] = ev.Type
	}
	return out
}

// gateExecutor blocks each task's FIRST stage until release is closed; later
// stages run instantly. It records every execution for assertions.
type gateExecutor struct {
	release chan struct{}
	mu      sync.Mutex
	calls   map[string][]string // taskID -> executed roles in order
}

func newGateExecutor() *gateExecutor {
	return &gateExecutor{release: make(chan struct{}), calls: map[string][]string{}}
}

func (g *gateExecutor) Execute(ctx context.Context, in domain.StageInput) (domain.StageOutput, error) {
	g.mu.Lock()
	g.calls[in.TaskID] = append(g.calls[in.TaskID], in.Role)
	firstStage := len(g.calls[in.TaskID]) == 1
	g.mu.Unlock()

	if firstStage {
		select {
		case <-g.release:
		case <-ctx.Done():
			return domain.StageOutput{}, fmt.Errorf("execute %s: %w", in.Role, ctx.Err())
		}
	}
	content := fmt.Sprintf("entregável %s para %s", in.Role, in.TaskID)
	return domain.StageOutput{Role: in.Role, Index: in.Index, Content: content}, nil
}

func (g *gateExecutor) callsFor(taskID string) []string {
	g.mu.Lock()
	defer g.mu.Unlock()
	return append([]string(nil), g.calls[taskID]...)
}

// blockingExecutor never returns on its own: it only unblocks via release or
// task-context cancellation, always surfacing ctx.Err().
type blockingExecutor struct {
	release chan struct{}
}

func (b *blockingExecutor) Execute(ctx context.Context, in domain.StageInput) (domain.StageOutput, error) {
	select {
	case <-b.release:
		return domain.StageOutput{Role: in.Role, Index: in.Index, Content: "ok"}, nil
	case <-ctx.Done():
		return domain.StageOutput{}, ctx.Err()
	}
}

func waitForState(t *testing.T, o *Orchestrator, id string, want domain.TaskState) domain.TaskStatus {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		st, ok := o.Status(id)
		if ok && st.State == want {
			return st
		}
		time.Sleep(2 * time.Millisecond)
	}
	st, _ := o.Status(id)
	t.Fatalf("task %s did not reach state %q in time (last=%+v)", id, want, st)
	return domain.TaskStatus{}
}

func startOrchestrator(t *testing.T, exec domain.StageExecutor, bus domain.EventBus, opts Options) (*Orchestrator, context.CancelFunc) {
	t.Helper()
	o, err := New(exec, bus, opts)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := o.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	return o, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = o.Shutdown(ctx)
	}
}

func mustContain(t *testing.T, haystack, needle, label string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Fatalf("%s: expected substring %q in:\n%s", label, needle, haystack)
	}
}

func TestSubmitRunsFullChainAndWritesArtifacts(t *testing.T) {
	root := t.TempDir()
	bus := newRecordingBus()
	o, stop := startOrchestrator(t, NewFileArtifactExecutor(root), bus, Options{ArtifactsRoot: root})
	defer stop()

	id := "e2e-artifacts"
	if err := o.Submit(domain.AgentTask{ID: id, Prompt: "construir API de pagamentos com idempotência"}); err != nil {
		t.Fatalf("Submit: %v", err)
	}

	st := waitForState(t, o, id, domain.StateDone)
	if st.Stage != domain.RoleSecurity {
		t.Fatalf("final stage = %q, want %q", st.Stage, domain.RoleSecurity)
	}

	foundCompleted := false
	for _, ev := range st.Events {
		if ev.Type == domain.EventTaskCompleted {
			foundCompleted = true
		}
	}
	if !foundCompleted {
		t.Fatalf("status events missing %s: %+v", domain.EventTaskCompleted, st.Events)
	}

	expected := []string{"01-architect.md", "02-senior-engineer.md", "03-qa.md", "04-security.md"}
	for _, name := range expected {
		data, err := os.ReadFile(filepath.Join(root, id, name))
		if err != nil {
			t.Fatalf("artifact %s: %v", name, err)
		}
		role := strings.TrimSuffix(strings.SplitN(name, "-", 2)[1], ".md")
		mustContain(t, string(data), id, name)
		mustContain(t, string(data), role, name+" role header")
	}
	first, _ := os.ReadFile(filepath.Join(root, id, expected[0]))
	mustContain(t, string(first), "construir API de pagamentos", "prompt propagation")

	for _, typ := range []string{domain.EventTaskSubmitted, domain.EventStageStarted, domain.EventStageCompleted} {
		found := false
		for _, et := range bus.types() {
			if et == typ {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("bus missing event type %s; got %v", typ, bus.types())
		}
	}
}

func TestCancelQueuedTaskNeverExecutes(t *testing.T) {
	root := t.TempDir()
	exec := newGateExecutor()
	o, stop := startOrchestrator(t, exec, newRecordingBus(), Options{
		WorkersPerStage: 1,
		QueueDepth:      1, // stage buffers: single slot behind the blocked worker
		IngressDepth:    8, // accepted queue stays open for queued3
		ArtifactsRoot:   root,
	})
	defer stop()

	const running1, buffered2, queued3 = "t-running", "t-buffered", "t-queued"
	prompt := "trabalho enxame"
	for _, id := range []string{running1, buffered2} {
		if err := o.Submit(domain.AgentTask{ID: id, Prompt: prompt}); err != nil {
			t.Fatalf("Submit %s: %v", id, err)
		}
	}
	waitForState(t, o, running1, domain.StateRunning)

	// Ingress still accepts queued3 because its buffer is separate from the
	// stage channel that is already full behind the blocked worker.
	if err := o.Submit(domain.AgentTask{ID: queued3, Prompt: prompt}); err != nil {
		t.Fatalf("Submit %s: %v", queued3, err)
	}
	waitForState(t, o, queued3, domain.StateQueued)

	accepted, err := o.Cancel(queued3)
	if err != nil || !accepted {
		t.Fatalf("Cancel queued: accepted=%v err=%v", accepted, err)
	}
	st := waitForState(t, o, queued3, domain.StateFailed)
	if !strings.Contains(st.Error, "canceled") {
		t.Fatalf("expected canceled error, got %q", st.Error)
	}
	hasCancelEvent := false
	for _, ev := range st.Events {
		if ev.Type == domain.EventTaskCanceled {
			hasCancelEvent = true
		}
	}
	if !hasCancelEvent {
		t.Fatalf("missing %s event: %+v", domain.EventTaskCanceled, st.Events)
	}

	if again, err := o.Cancel(queued3); again || err != nil {
		t.Fatalf("second Cancel should be a no-op, got accepted=%v err=%v", again, err)
	}

	close(exec.release) // unblock and drain the whole swarm
	waitForState(t, o, running1, domain.StateDone)
	waitForState(t, o, buffered2, domain.StateDone)

	if calls := exec.callsFor(queued3); len(calls) > 0 {
		t.Fatalf("canceled task executed stages: %v", calls)
	}
}

func TestCancelRunningTaskAbortsChainWithoutArtifacts(t *testing.T) {
	root := t.TempDir()
	exec := &blockingExecutor{release: make(chan struct{})}
	o, stop := startOrchestrator(t, exec, newRecordingBus(), Options{ArtifactsRoot: root})
	defer stop()
	defer close(exec.release)

	id := "t-running-cancel"
	if err := o.Submit(domain.AgentTask{ID: id, Prompt: "fluxo longo"}); err != nil {
		t.Fatalf("Submit: %v", err)
	}
	waitForState(t, o, id, domain.StateRunning)

	if accepted, err := o.Cancel(id); !accepted || err != nil {
		t.Fatalf("Cancel: accepted=%v err=%v", accepted, err)
	}

	st := waitForState(t, o, id, domain.StateFailed)
	if st.Stage != domain.RoleArchitect {
		t.Fatalf("failed stage = %q, want architect", st.Stage)
	}
	for _, ev := range st.Events {
		switch ev.Type {
		case domain.EventStageStarted:
			if role, _ := ev.Data["role"].(string); role != domain.RoleArchitect {
				t.Fatalf("unexpected later stage started: %+v", ev)
			}
		case domain.EventTaskCompleted:
			t.Fatal("canceled task must not complete")
		}
	}
	if _, err := os.Stat(filepath.Join(root, id)); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("canceled before any write: unexpected artifact dir (%v)", err)
	}
}

func TestConcurrentSubmitsCompleteWithoutRace(t *testing.T) {
	root := t.TempDir()
	o, stop := startOrchestrator(t, NewFileArtifactExecutor(root), newRecordingBus(), Options{
		ArtifactsRoot: root,
	})
	defer stop()

	const n = 40
	errs := make(chan error, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			id := fmt.Sprintf("race-task-%02d", i)
			if err := o.Submit(domain.AgentTask{
				ID:     id,
				Prompt: fmt.Sprintf("tarefa concorrente %d", i),
				Chain:  domain.DefaultChain(),
			}); err != nil {
				errs <- fmt.Errorf("submit %s: %w", id, err)
				return
			}
			waitForState(t, o, id, domain.StateDone)
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}

	count := 0
	walkErr := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(d.Name(), ".md") {
			count++
		}
		return nil
	})
	if walkErr != nil {
		t.Fatalf("walk artifacts: %v", walkErr)
	}
	if count != n*len(domain.DefaultChain()) {
		t.Fatalf("artifact count = %d, want %d", count, n*len(domain.DefaultChain()))
	}
}

func TestSubmitValidationErrors(t *testing.T) {
	o, stop := startOrchestrator(t, NewFileArtifactExecutor(t.TempDir()), newRecordingBus(), Options{})
	defer stop()

	cases := []struct {
		name    string
		task    domain.AgentTask
		wantMsg string
	}{
		{"empty id", domain.AgentTask{Prompt: "x"}, "invalid taskId"},
		{"path traversal", domain.AgentTask{ID: "../evil", Prompt: "x"}, "invalid taskId"},
		{"slash in id", domain.AgentTask{ID: "a/b", Prompt: "x"}, "invalid taskId"},
		{"empty prompt", domain.AgentTask{ID: "ok-id"}, "prompt"},
		{"unknown role", domain.AgentTask{ID: "ok-id", Prompt: "x", Chain: []string{"wizard"}}, "unknown role"},
		{"empty chain", domain.AgentTask{ID: "ok-id", Prompt: "x", Chain: []string{}}, "at least one stage"},
	}
	for _, tc := range cases {
		err := o.Submit(tc.task)
		if err == nil {
			t.Fatalf("%s: expected error", tc.name)
		}
		mustContain(t, err.Error(), tc.wantMsg, tc.name)
	}
}

func TestDuplicateActiveIdRejectedAndReusableAfterTerminal(t *testing.T) {
	exec := newGateExecutor()
	o, stop := startOrchestrator(t, exec, newRecordingBus(), Options{ArtifactsRoot: t.TempDir()})
	defer stop()

	id := "dup-id"
	if err := o.Submit(domain.AgentTask{ID: id, Prompt: "primeira"}); err != nil {
		t.Fatalf("first submit: %v", err)
	}
	err := o.Submit(domain.AgentTask{ID: id, Prompt: "segunda"})
	if !errors.Is(err, ErrTaskConflict) {
		t.Fatalf("want ErrTaskConflict, got %v", err)
	}

	close(exec.release)
	waitForState(t, o, id, domain.StateDone)

	if err := o.Submit(domain.AgentTask{ID: id, Prompt: "terceira"}); err != nil {
		t.Fatalf("resubmit after terminal: %v", err)
	}
	waitForState(t, o, id, domain.StateDone)
}

func TestShutdownPersistsPendingStates(t *testing.T) {
	root := t.TempDir()
	exec := &blockingExecutor{release: make(chan struct{})}
	o, err := New(exec, newRecordingBus(), Options{
		WorkersPerStage: 1,
		QueueDepth:      16,
		ArtifactsRoot:   root,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := o.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer close(exec.release) // free any goroutine still parked in Execute

	if err := o.Submit(domain.AgentTask{ID: "p-busy", Prompt: "ocupado"}); err != nil {
		t.Fatalf("Submit busy: %v", err)
	}
	waitForState(t, o, "p-busy", domain.StateRunning)
	for _, id := range []string{"p-q1", "p-q2", "p-q3"} {
		if err := o.Submit(domain.AgentTask{ID: id, Prompt: "na fila"}); err != nil {
			t.Fatalf("Submit %s: %v", id, err)
		}
	}

	drainCtx, cancel := context.WithTimeout(context.Background(), 120*time.Millisecond)
	defer cancel()
	shutdownErr := o.Shutdown(drainCtx)
	if shutdownErr == nil || !errors.Is(shutdownErr, context.DeadlineExceeded) {
		t.Fatalf("forced shutdown should wrap deadline, got %v", shutdownErr)
	}

	data, readErr := os.ReadFile(o.persistPath)
	if readErr != nil {
		t.Fatalf("pending file not persisted: %v", readErr)
	}
	var file struct {
		SavedAt time.Time     `json:"savedAt"`
		Tasks   []PendingTask `json:"tasks"`
	}
	if err := json.Unmarshal(data, &file); err != nil {
		t.Fatalf("unmarshal pending file: %v\nraw:\n%s", err, data)
	}

	got := map[string]PendingTask{}
	for _, p := range file.Tasks {
		got[p.TaskID] = p
	}
	for _, id := range []string{"p-q1", "p-q2", "p-q3"} {
		p, ok := got[id]
		if !ok {
			t.Fatalf("pending file missing %s: %+v", id, file.Tasks)
		}
		if p.State != domain.StateQueued || p.Stage != domain.RoleArchitect {
			t.Fatalf("%s persisted as %+v, want queued/architect", id, p)
		}
	}
	if _, busy := got["p-busy"]; busy {
		t.Fatalf("busy task was force-canceled and must not be pending: %+v", file.Tasks)
	}
	st, _ := o.Status("p-busy")
	if st.State != domain.StateFailed || !strings.Contains(st.Error, "canceled") {
		t.Fatalf("busy task final status = %+v", st)
	}
}

func TestShutdownDrainsAcceptedWorkCleanly(t *testing.T) {
	root := t.TempDir()
	o, err := New(NewFileArtifactExecutor(root), newRecordingBus(), Options{ArtifactsRoot: root})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := o.Start(context.Background()); err != nil {
		t.Fatalf("Start: %v", err)
	}

	const n = 10
	for i := range n {
		if err := o.Submit(domain.AgentTask{ID: fmt.Sprintf("drain-%02d", i), Prompt: "drena"}); err != nil {
			t.Fatalf("Submit %d: %v", i, err)
		}
	}
	if err := o.Shutdown(context.Background()); err != nil {
		t.Fatalf("clean Shutdown returned error: %v", err)
	}
	for i := range n {
		waitForState(t, o, fmt.Sprintf("drain-%02d", i), domain.StateDone)
	}
	if _, statErr := os.Stat(o.persistPath); !errors.Is(statErr, fs.ErrNotExist) {
		t.Fatalf("clean drain must not persist pending states (%v)", statErr)
	}
	if _, found := o.Status("desconhecido"); found {
		t.Fatal("status of unknown task must report miss")
	}
	if accepted, err := o.Cancel("desconhecido"); accepted || !errors.Is(err, ErrUnknownTask) {
		t.Fatalf("cancel unknown: accepted=%v err=%v", accepted, err)
	}
}
