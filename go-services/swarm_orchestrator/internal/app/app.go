// Package app wires every component of the swarm orchestrator with uber/fx:
// configuration from the environment, artifact executor, channel pipeline,
// event hub and the JSON-RPC server, plus the OnStart/OnStop lifecycle that
// implements graceful shutdown.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"go.uber.org/fx"
	"go.uber.org/fx/fxevent"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/pipeline"
	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/server"
)

// Environment variables understood by the orchestrator.
const (
	envSocketPath   = "IZANAGI_ORCHESTRATOR_SOCK" // overrides /tmp/izanagi-orch.sock
	envArtifactsDir = "IZANAGI_ARTIFACTS_DIR"     // root dir for stage artifacts
	envWorkers      = "IZANAGI_STAGE_WORKERS"     // worker goroutines per stage
	envQueueDepth   = "IZANAGI_QUEUE_DEPTH"       // buffered capacity per stage/ingress
)

// Defaults applied when the corresponding environment variable is unset.
const (
	defaultSocketPath  = "/tmp/izanagi-orch.sock"
	defaultArtifacts   = ".agents/artifacts"
	defaultWorkerCount = 2
	defaultDepth       = 64
	maxWorkerCount     = 32
	maxDepth           = 10_000
)

// shutdownGrace bounds the whole graceful-shutdown sequence.
const shutdownGrace = 15 * time.Second

// socketTeardownGrace bounds listener close + socket file removal after the
// pipeline drain has consumed its share of the budget.
const socketTeardownGrace = 3 * time.Second

// Config carries every tunable knob resolved from the environment.
type Config struct {
	SocketPath      string
	ArtifactsRoot   string
	WorkersPerStage int
	QueueDepth      int
}

// LoadConfig resolves configuration from the environment, failing loudly on
// malformed integers instead of silently guessing.
func LoadConfig() (Config, error) {
	cfg := Config{
		SocketPath:    getenv(envSocketPath, defaultSocketPath),
		ArtifactsRoot: getenv(envArtifactsDir, defaultArtifacts),
	}
	if cfg.ArtifactsRoot == "" {
		return cfg, fmt.Errorf("env %s must not be empty", envArtifactsDir)
	}
	workers, err := loadInt(envWorkers, defaultWorkerCount, maxWorkerCount)
	if err != nil {
		return cfg, err
	}
	depth, err := loadInt(envQueueDepth, defaultDepth, maxDepth)
	if err != nil {
		return cfg, err
	}
	cfg.WorkersPerStage = workers
	cfg.QueueDepth = depth
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

// loadInt parses an optional bounded positive integer from the environment.
func loadInt(key string, fallback, max int) (int, error) {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("env %s=%q: %w", key, raw, err)
	}
	if n < 1 || n > max {
		return 0, fmt.Errorf("env %s=%d: must be between 1 and %d", key, n, max)
	}
	return n, nil
}

// Module assembles the full dependency graph.
func Module() fx.Option {
	return fx.Module("swarm_orchestrator",
		fx.WithLogger(provideFxLogger),
		fx.Provide(
			LoadConfig,
			newLogger,
			server.NewHub,
			provideEventBus,
			provideExecutor,
			providePipelineOptions,
			pipeline.New,
			provideOrchestratorAPI,
			provideServer,
		),
		fx.Invoke(registerLifecycle),
	)
}

// provideFxLogger routes fx lifecycle events through the application logger.
func provideFxLogger(log *slog.Logger) fxevent.Logger {
	return &fxevent.SlogLogger{Logger: log}
}

func newLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
}

// provideEventBus adapts the concrete hub to the domain-side interface.
func provideEventBus(h *server.Hub) domain.EventBus { return h }

// provideExecutor binds the default disk-artifact executor; swap here to plug
// real agent backends into the same pipeline machinery.
func provideExecutor(cfg Config) domain.StageExecutor {
	return pipeline.NewFileArtifactExecutor(cfg.ArtifactsRoot)
}

func providePipelineOptions(cfg Config) pipeline.Options {
	return pipeline.Options{
		WorkersPerStage: cfg.WorkersPerStage,
		QueueDepth:      cfg.QueueDepth,
		ArtifactsRoot:   cfg.ArtifactsRoot,
	}
}

// provideOrchestratorAPI narrows the pipeline to its transport-facing surface.
func provideOrchestratorAPI(o *pipeline.Orchestrator) server.OrchestratorAPI { return o }

func provideServer(api server.OrchestratorAPI, hub *server.Hub, cfg Config) (*server.Server, error) {
	return server.New(api, hub, cfg.SocketPath)
}

// registerLifecycle owns the ordered start/stop choreography:
//
//	Start: spawn pools -> open the RPC socket.
//	Stop : drain + persist pending tasks -> close socket and remove its file.
func registerLifecycle(lc fx.Lifecycle, o *pipeline.Orchestrator, s *server.Server, log *slog.Logger) {
	lc.Append(fx.Hook{
		OnStart: func(ctx context.Context) error {
			if err := o.Start(ctx); err != nil {
				return fmt.Errorf("start pipeline pools: %w", err)
			}
			if err := s.Start(ctx); err != nil {
				shutdownErr := o.Shutdown(context.Background())
				return errors.Join(fmt.Errorf("start rpc server: %w", err), shutdownErr)
			}
			log.Info("swarm orchestrator ready",
				slog.String("socket", s.SocketPath()),
				slog.String("artifacts", o.Root()))
			return nil
		},
		OnStop: func(ctx context.Context) error {
			drainErr := o.Shutdown(ctx)
			teardownCtx, cancel := context.WithTimeout(context.Background(), socketTeardownGrace)
			defer cancel()
			socketErr := s.Stop(teardownCtx)
			if drainErr != nil {
				log.Warn("pipeline drain finished with pending work", slog.String("err", drainErr.Error()))
			}
			if socketErr != nil {
				log.Error("socket teardown failed", slog.String("err", socketErr.Error()))
			}
			return errors.Join(drainErr, socketErr)
		},
	})
}

// Run boots the application, blocks until SIGINT/SIGTERM and executes the
// graceful shutdown path. It returns the process exit code. A second signal
// escalates to immediate termination.
func Run() int {
	log := newLogger()
	sigs := make(chan os.Signal, 1)
	signalNotify(sigs)
	defer signalStop(sigs)

	fxApp := fx.New(Module())
	if err := fxApp.Err(); err != nil {
		log.Error("invalid fx application", slog.Any("err", err))
		return 1
	}

	startCtx, cancelStart := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancelStart()
	if err := fxApp.Start(startCtx); err != nil {
		log.Error("startup failed", slog.Any("err", err))
		return 1
	}

	sig := <-sigs
	log.Info("shutdown signal received", slog.String("signal", sig.String()))
	go func() {
		<-sigs
		log.Error("second signal received: forcing exit")
		forceExit(130)
	}()

	graceCtx, cancelGrace := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancelGrace()
	if err := fxApp.Stop(graceCtx); err != nil {
		log.Error("graceful shutdown incomplete", slog.Any("err", err))
		return 1
	}
	log.Info("orchestrator stopped cleanly")
	return 0
}
