package app

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"go.uber.org/fx"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/pipeline"
)

// TestFxLifecycleBootsAndStopsCleanly exercises the real uber/fx graph:
// OnStart must open the RPC socket with pools running; OnStop must drain,
// clean up and remove the socket file.
func TestFxLifecycleBootsAndStopsCleanly(t *testing.T) {
	tmp := t.TempDir()
	sock := filepath.Join(tmp, "fx.sock")
	artifacts := filepath.Join(tmp, "artifacts")
	t.Setenv(envSocketPath, sock)
	t.Setenv(envArtifactsDir, artifacts)

	var orch *pipeline.Orchestrator
	fxApp := fx.New(Module(), fx.Populate(&orch))

	ctx := context.Background()
	if err := fxApp.Start(ctx); err != nil {
		t.Fatalf("fx Start: %v", err)
	}
	if _, err := os.Stat(sock); err != nil {
		t.Fatalf("lifecycle did not create the socket: %v", err)
	}

	id := "fx-wired-task"
	if err := orch.Submit(domain.AgentTask{ID: id, Prompt: "tarefa através do grafo fx"}); err != nil {
		t.Fatalf("Submit via fx graph: %v", err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		st, ok := orch.Status(id)
		if ok && st.State == domain.StateDone {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("task did not settle through fx wiring: %+v", st)
		}
		time.Sleep(3 * time.Millisecond)
	}
	if _, err := os.Stat(filepath.Join(artifacts, id, "04-security.md")); err != nil {
		t.Fatalf("artifact missing after fx-driven pipeline: %v", err)
	}

	stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := fxApp.Stop(stopCtx); err != nil {
		t.Fatalf("fx Stop: %v", err)
	}
	if _, err := os.Stat(sock); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("socket not removed on stop (%v)", err)
	}
	if _, err := os.Stat(filepath.Join(artifacts, "pending-tasks.json")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("clean shutdown must not leave pending states (%v)", err)
	}
}

func TestLoadConfigDefaultsAndValidation(t *testing.T) {
	t.Setenv(envSocketPath, "")
	t.Setenv(envArtifactsDir, "")
	t.Setenv(envWorkers, "")
	t.Setenv(envQueueDepth, "")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("defaults: %v", err)
	}
	if cfg.SocketPath != defaultSocketPath || cfg.ArtifactsRoot != defaultArtifacts {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.WorkersPerStage != defaultWorkerCount || cfg.QueueDepth != defaultDepth {
		t.Fatalf("unexpected sizing defaults: %+v", cfg)
	}

	t.Setenv(envWorkers, "0")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("workers=0 must be rejected")
	}
	t.Setenv(envWorkers, "not-a-number")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("non-numeric workers must be rejected")
	}
}
