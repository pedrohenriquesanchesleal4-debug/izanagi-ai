// Package pipeline implements the concurrent swarm engine: a multi-stage
// channel pipeline (architect -> senior-engineer -> qa -> security by default)
// where every stage runs its own worker pool over a buffered channel. All
// data flows through channels; locks are confined to O(1) bookkeeping in the
// status registry and are never held while executors run.
package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
)

// Options tunes pool sizing and queue depth.
type Options struct {
	WorkersPerStage int    // goroutines per stage pool
	QueueDepth      int    // buffered channel capacity of each stage pool
	IngressDepth    int    // accepted-work queue ahead of the first stage; 0 = QueueDepth
	ArtifactsRoot   string // root directory for artifacts and pending-state persistence
}

const (
	defaultWorkers  = 2
	defaultQueue    = 64
	drainPollPeriod = 5 * time.Millisecond
	forceReapGrace  = 2 * time.Second
)

func (o Options) withDefaults() Options {
	if o.WorkersPerStage <= 0 {
		o.WorkersPerStage = defaultWorkers
	}
	if o.QueueDepth <= 0 {
		o.QueueDepth = defaultQueue
	}
	if o.IngressDepth <= 0 {
		o.IngressDepth = o.QueueDepth
	}
	return o
}

// Sentinel errors are re-exported from domain for pipeline callers.
var (
	ErrUnknownTask  = domain.ErrUnknownTask
	ErrTaskConflict = domain.ErrTaskConflict
	ErrQueueFull    = domain.ErrQueueFull
	ErrShuttingDown = domain.ErrShuttingDown
)

// stage owns one buffered channel consumed by its worker pool.
type stage struct {
	role string
	ch   chan *taskRun
}

// taskRun is the mutable envelope travelling through the pipeline. Ownership
// is exclusive: exactly one dispatcher/worker holds it at any moment, so its
// own fields need no locking.
type taskRun struct {
	task     domain.AgentTask
	idx      int // position of the next stage to execute within Chain
	prev     []domain.StageOutput
	ctx      context.Context
	cancel   context.CancelFunc
	canceled atomic.Bool
}

// entry mirrors the externally observable state of a task. pos mirrors the
// owner-worker's run.idx so readers never touch worker-owned fields.
type entry struct {
	run    *taskRun
	state  domain.TaskState
	pos    int
	errMsg string
	events []domain.Event
}

// stageLabel derives the reported stage from pipeline position and state.
func (e *entry) stageLabel() string {
	chain := e.run.task.Chain
	switch e.state {
	case domain.StateQueued:
		return chain[0]
	case domain.StateRunning:
		if e.pos < len(chain) {
			return chain[e.pos]
		}
	case domain.StateDone:
		return chain[len(chain)-1]
	case domain.StateFailed:
		if e.pos < len(chain) {
			return chain[e.pos]
		}
	}
	return ""
}

// registry guards entries with short critical sections only; executors never
// run while this lock is held.
type registry struct {
	mu    sync.RWMutex
	tasks map[string]*entry
}

func newRegistry() registry {
	return registry{tasks: make(map[string]*entry)}
}

func (rg *registry) get(id string) (*entry, bool) {
	rg.mu.RLock()
	defer rg.mu.RUnlock()
	e, ok := rg.tasks[id]
	return e, ok
}

func (rg *registry) activeCount() int {
	rg.mu.RLock()
	defer rg.mu.RUnlock()
	n := 0
	for _, e := range rg.tasks {
		if !e.state.Terminal() {
			n++
		}
	}
	return n
}

func (rg *registry) snapshot(e *entry) domain.TaskStatus {
	rg.mu.RLock()
	defer rg.mu.RUnlock()
	st := domain.TaskStatus{
		TaskID: e.run.task.ID,
		State:  e.state,
		Stage:  e.stageLabel(),
		Error:  e.errMsg,
		Events: make([]domain.Event, len(e.events)),
	}
	copy(st.Events, e.events)
	return st
}

// Orchestrator wires ingress, stage pools and the registry together.
type Orchestrator struct {
	exec domain.StageExecutor
	bus  domain.EventBus

	opts    Options
	ingress chan *taskRun
	stages  map[string]*stage

	reg registry

	wg       sync.WaitGroup // dispatcher + all stage workers
	stopCh   chan struct{}  // closed when intake stops and graceful drain begins
	quitCh   chan struct{}  // closed to hard-stop dispatcher/workers
	stopOnce sync.Once
	quitOnce sync.Once

	hardStopped atomic.Bool // set just before quitCh closes: no new stage claims

	mu          sync.Mutex // guards lifecycle flags below
	started     bool
	drained     bool
	persistPath string
}

// New validates dependencies and builds an idle orchestrator; call Start to
// spawn the pools.
func New(exec domain.StageExecutor, bus domain.EventBus, opts Options) (*Orchestrator, error) {
	if exec == nil {
		return nil, errors.New("pipeline: stage executor is required")
	}
	if bus == nil {
		return nil, errors.New("pipeline: event bus is required")
	}
	opts = opts.withDefaults()
	o := &Orchestrator{
		exec:        exec,
		bus:         bus,
		opts:        opts,
		ingress:     make(chan *taskRun, opts.IngressDepth),
		stages:      make(map[string]*stage),
		reg:         newRegistry(),
		stopCh:      make(chan struct{}),
		quitCh:      make(chan struct{}),
		persistPath: filepath.Join(opts.ArtifactsRoot, "pending-tasks.json"),
	}
	for _, role := range domain.DefaultChain() {
		o.stages[role] = &stage{role: role, ch: make(chan *taskRun, opts.QueueDepth)}
	}
	return o, nil
}

// Registered reports whether role belongs to the static pipeline.
func (o *Orchestrator) Registered(role string) bool {
	_, ok := o.stages[role]
	return ok
}

// Root returns the artifacts root directory (also holding pending-tasks.json).
func (o *Orchestrator) Root() string { return o.opts.ArtifactsRoot }

// Start spawns the dispatcher and every stage worker pool.
func (o *Orchestrator) Start(_ context.Context) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.started {
		return errors.New("pipeline: orchestrator already started")
	}
	if o.drained {
		return errors.New("pipeline: orchestrator already shut down")
	}
	o.started = true
	for _, st := range o.stages {
		for i := 0; i < o.opts.WorkersPerStage; i++ {
			o.wg.Add(1)
			go o.worker(st)
		}
	}
	o.wg.Add(1)
	go o.dispatcher()
	return nil
}

// Submit validates and enqueues a task. It never blocks indefinitely: a
// saturated ingress rejects immediately so RPC callers get fast feedback.
func (o *Orchestrator) Submit(task domain.AgentTask) error {
	if err := domain.ValidateTaskID(task.ID); err != nil {
		return fmt.Errorf("submit: %w", err)
	}
	if len(task.Prompt) == 0 {
		return fmt.Errorf("submit %s: prompt must not be empty", task.ID)
	}
	if task.Chain == nil {
		task.Chain = domain.DefaultChain()
	}
	if err := domain.ValidateChain(task.Chain, o.Registered); err != nil {
		return fmt.Errorf("submit %s: %w", task.ID, err)
	}

	var (
		run *taskRun
		ev  domain.Event
	)
	o.reg.mu.Lock()
	if prev, dup := o.reg.tasks[task.ID]; dup && !prev.state.Terminal() {
		o.reg.mu.Unlock()
		return fmt.Errorf("submit %s: %w", task.ID, ErrTaskConflict)
	}
	run = &taskRun{task: task}
	run.ctx, run.cancel = context.WithCancel(context.Background())
	o.reg.tasks[task.ID] = &entry{run: run, state: domain.StateQueued}
	ev = domain.NewEvent(task.ID, domain.EventTaskSubmitted, map[string]any{"roles": task.Chain})
	o.reg.mu.Unlock()
	o.bus.Publish(ev)

	select {
	case o.ingress <- run:
		return nil
	case <-o.stopCh:
		o.drop(run, "orchestrator is shutting down")
		return fmt.Errorf("submit %s: %w", task.ID, ErrShuttingDown)
	default:
		o.drop(run, "ingress queue is full")
		return fmt.Errorf("submit %s: %w", task.ID, ErrQueueFull)
	}
}

// Status returns a copy of the observable state of taskId.
func (o *Orchestrator) Status(taskID string) (domain.TaskStatus, bool) {
	e, ok := o.reg.get(taskID)
	if !ok {
		return domain.TaskStatus{}, false
	}
	return o.reg.snapshot(e), true
}

// Cancel requests cancellation of a queued or running task. Unknown tasks
// yield ErrUnknownTask; already-terminal tasks are no-ops (accepted=false).
func (o *Orchestrator) Cancel(taskID string) (bool, error) {
	var (
		accept bool
		run    *taskRun
		ev     domain.Event
	)
	o.reg.mu.Lock()
	e, ok := o.reg.tasks[taskID]
	if !ok {
		o.reg.mu.Unlock()
		return false, fmt.Errorf("cancel %s: %w", taskID, ErrUnknownTask)
	}
	if !e.state.Terminal() {
		accept = true
		run = e.run
		run.canceled.Store(true)
		ev = domain.NewEvent(taskID, domain.EventTaskCanceled, map[string]any{
			"state": string(e.state),
		})
		e.events = append(e.events, ev)
		if e.state == domain.StateQueued {
			e.state = domain.StateFailed
			e.errMsg = "canceled before execution"
		}
	}
	o.reg.mu.Unlock()

	if accept && run != nil {
		run.cancel() // unblocks an executor mid-flight
		o.bus.Publish(ev)
	}
	return accept, nil
}

// mutate applies fn under the registry lock, appends the events it returns
// to the task log and publishes them after releasing the lock. It reports
// whether the task exists.
func (o *Orchestrator) mutate(taskID string, fn func(*entry) []domain.Event) bool {
	o.reg.mu.Lock()
	e, ok := o.reg.tasks[taskID]
	if !ok {
		o.reg.mu.Unlock()
		return false
	}
	evs := fn(e)
	if len(evs) > 0 {
		e.events = append(e.events, evs...)
	}
	o.reg.mu.Unlock()
	for _, ev := range evs {
		o.bus.Publish(ev)
	}
	return true
}

// drop removes a rejected submission from the registry, releases its context
// and notifies subscribers.
func (o *Orchestrator) drop(run *taskRun, reason string) {
	o.reg.mu.Lock()
	delete(o.reg.tasks, run.task.ID)
	o.reg.mu.Unlock()
	run.cancel()
	o.bus.Publish(domain.NewEvent(run.task.ID, domain.EventTaskDropped,
		map[string]any{"reason": reason}))
}

// claim marks the beginning of a stage unless the task was canceled or has
// already reached a terminal state.
func (o *Orchestrator) claim(run *taskRun, role string) bool {
	claimed := false
	o.mutate(run.task.ID, func(e *entry) []domain.Event {
		if e.state.Terminal() || e.run.canceled.Load() || o.hardStopped.Load() {
			return nil
		}
		claimed = true
		e.state = domain.StateRunning
		return []domain.Event{domain.NewEvent(run.task.ID, domain.EventStageStarted, map[string]any{
			"role": role, "stageIndex": run.idx,
		})}
	})
	return claimed
}

// dispatcher moves accepted tasks into the pool of their first stage.
func (o *Orchestrator) dispatcher() {
	defer o.wg.Done()
	for {
		select {
		case run := <-o.ingress:
			o.routeFirst(run)
		case <-o.quitCh:
			return
		}
	}
}

func (o *Orchestrator) routeFirst(run *taskRun) {
	if run.canceled.Load() {
		return // already finalized by Cancel
	}
	first := o.stages[run.task.Chain[0]]
	select {
	case first.ch <- run:
	case <-o.quitCh:
		// left non-terminal; persisted as pending by Shutdown
	}
}

// worker consumes its stage channel until the orchestrator quits.
func (o *Orchestrator) worker(st *stage) {
	defer o.wg.Done()
	for {
		select {
		case run := <-st.ch:
			o.executeStage(st, run)
		case <-o.quitCh:
			return
		}
	}
}

// executeStage claims the task, runs the pluggable executor and forwards the
// envelope downstream or finalizes it.
func (o *Orchestrator) executeStage(st *stage, run *taskRun) {
	if !o.claim(run, st.role) {
		return
	}

	in := domain.StageInput{
		TaskID:      run.task.ID,
		Prompt:      run.task.Prompt,
		Role:        st.role,
		Index:       run.idx,
		TotalStages: len(run.task.Chain),
		Previous:    run.prev,
	}
	out, err := o.exec.Execute(run.ctx, in)
	if err != nil {
		o.failRun(run, st.role, err)
		return
	}

	run.prev = append(run.prev, out)
	o.mutate(run.task.ID, func(e *entry) []domain.Event {
		return []domain.Event{domain.NewEvent(run.task.ID, domain.EventStageCompleted, map[string]any{
			"role": st.role, "artifactPath": out.ArtifactPath,
		})}
	})

	run.idx++
	o.setPos(run)
	if run.idx >= len(run.task.Chain) {
		o.complete(run)
		return
	}
	next := o.stages[run.task.Chain[run.idx]]
	select {
	case next.ch <- run:
	case <-o.quitCh:
		// left non-terminal; persisted as pending by Shutdown
	}
}

// setPos mirrors the worker-owned pipeline position into the registry under
// its lock so Status readers observe a consistent (state, stage) pair.
func (o *Orchestrator) setPos(run *taskRun) {
	o.reg.mu.Lock()
	if e, ok := o.reg.tasks[run.task.ID]; ok {
		e.pos = run.idx
	}
	o.reg.mu.Unlock()
}

func (o *Orchestrator) complete(run *taskRun) {
	o.mutate(run.task.ID, func(e *entry) []domain.Event {
		if e.state.Terminal() {
			return nil
		}
		e.state = domain.StateDone
		return []domain.Event{domain.NewEvent(run.task.ID, domain.EventTaskCompleted, nil)}
	})
	run.cancel()
}

// failRun finalizes a failed stage, distinguishing user/shutdown
// cancellation (already logged as task.canceled by Cancel) from genuine
// execution errors.
func (o *Orchestrator) failRun(run *taskRun, role string, execErr error) {
	canceled := run.canceled.Load() || errors.Is(execErr, context.Canceled)
	msg := "canceled"
	if !canceled {
		msg = execErr.Error()
	}
	o.mutate(run.task.ID, func(e *entry) []domain.Event {
		if e.state.Terminal() {
			return nil
		}
		e.state = domain.StateFailed
		if e.errMsg == "" {
			e.errMsg = msg
		}
		evs := []domain.Event{domain.NewEvent(run.task.ID, domain.EventStageFailed, map[string]any{
			"role": role, "error": msg,
		})}
		if !canceled {
			evs = append(evs, domain.NewEvent(run.task.ID, domain.EventTaskFailed, map[string]any{
				"error": msg,
			}))
		}
		return evs
	})
	run.cancel()
}

// Shutdown stops intake, drains every accepted task until quiescence (or
// until ctx expires), then persists non-terminal tasks to disk. The caller's
// ctx bounds the graceful drain window.
func (o *Orchestrator) Shutdown(ctx context.Context) error {
	o.mu.Lock()
	if !o.started {
		o.mu.Unlock()
		return errors.New("pipeline: shutdown called before start")
	}
	if o.drained {
		o.mu.Unlock()
		return errors.New("pipeline: orchestrator already shut down")
	}
	o.drained = true
	o.mu.Unlock()

	o.stopOnce.Do(func() { close(o.stopCh) })

	ticker := time.NewTicker(drainPollPeriod)
	defer ticker.Stop()
	for o.reg.activeCount() > 0 {
		select {
		case <-ctx.Done():
			return o.forceStop(ctx)
		case <-ticker.C:
		}
	}

	// Everything settled cleanly: release idle pools and reap goroutines.
	o.hardQuit()
	o.wg.Wait()
	return nil
}

// forceStop cancels in-flight executors, hard-stops the pools and persists
// whatever did not reach a terminal state.
func (o *Orchestrator) forceStop(ctx context.Context) error {
	o.cancelActive()
	o.hardQuit()

	done := make(chan struct{})
	go func() {
		o.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(forceReapGrace):
		// A misbehaving executor ignoring its ctx cannot block persistence.
	}

	persistErr := o.persistPending()
	if remaining := o.reg.activeCount(); remaining > 0 {
		return errors.Join(persistErr, fmt.Errorf(
			"%d task(s) still pending after forced shutdown: %w", remaining, ctx.Err()))
	}
	return persistErr
}

func (o *Orchestrator) hardQuit() {
	o.hardStopped.Store(true)
	o.quitOnce.Do(func() { close(o.quitCh) })
}

// cancelActive cancels the context of every non-terminal task so executors
// honoring ctx return promptly.
func (o *Orchestrator) cancelActive() {
	o.reg.mu.RLock()
	runs := make([]*taskRun, 0, len(o.reg.tasks))
	for _, e := range o.reg.tasks {
		if !e.state.Terminal() {
			runs = append(runs, e.run)
		}
	}
	o.reg.mu.RUnlock()
	for _, run := range runs {
		run.canceled.Store(true)
		run.cancel()
	}
}

// PendingTask is one non-terminal task persisted at shutdown time.
type PendingTask struct {
	TaskID string           `json:"taskId"`
	State  domain.TaskState `json:"state"`
	Stage  string           `json:"stage"`
	Error  string           `json:"error,omitempty"`
}

type pendingFile struct {
	SavedAt time.Time     `json:"savedAt"`
	Tasks   []PendingTask `json:"tasks"`
}

// persistPending writes non-terminal task states to <ArtifactsRoot>/pending-tasks.json.
func (o *Orchestrator) persistPending() error {
	file := pendingFile{SavedAt: time.Now().UTC(), Tasks: []PendingTask{}}
	o.reg.mu.RLock()
	for _, e := range o.reg.tasks {
		if e.state.Terminal() {
			continue
		}
		file.Tasks = append(file.Tasks, PendingTask{
			TaskID: e.run.task.ID,
			State:  e.state,
			Stage:  e.stageLabel(),
			Error:  e.errMsg,
		})
	}
	o.reg.mu.RUnlock()

	if err := os.MkdirAll(o.opts.ArtifactsRoot, 0o755); err != nil {
		return fmt.Errorf("persist pending states: create root %s: %w", o.opts.ArtifactsRoot, err)
	}
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("persist pending states: marshal: %w", err)
	}
	if err := os.WriteFile(o.persistPath, append(data, '\n'), 0o644); err != nil {
		return fmt.Errorf("persist pending states: write %s: %w", o.persistPath, err)
	}
	return nil
}
