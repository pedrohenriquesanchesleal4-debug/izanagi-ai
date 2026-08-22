package app

import (
	"os"
	"os/signal"
	"syscall"
)

// Indirection over the signal package so tests can exercise Run-like flows
// without delivering real process signals.

func signalNotify(ch chan<- os.Signal) {
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
}

func signalStop(ch chan<- os.Signal) {
	signal.Stop(ch)
}

func forceExit(code int) {
	os.Exit(code)
}
