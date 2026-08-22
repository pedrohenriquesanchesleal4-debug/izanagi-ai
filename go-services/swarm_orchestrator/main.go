// Command swarm_orchestrator runs the Izanagi concurrent agent-swarm
// orchestrator: a multi-stage channel pipeline exposed through JSON-RPC 2.0
// over a Unix domain socket with graceful SIGINT/SIGTERM shutdown.
package main

import (
	"os"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/app"
)

func main() {
	os.Exit(app.Run())
}
