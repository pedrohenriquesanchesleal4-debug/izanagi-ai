package server

import (
	"sync"

	"github.com/pedrohenriquesanchesleal4-debug/izanagi-ai/go-services/swarm_orchestrator/internal/domain"
)

// subscriberChanSize bounds how many events may queue for one connection;
// slower clients lose events instead of stalling the pipeline.
const subscriberChanSize = 128

// Subscription is one client's event tap. The Events channel is never closed:
// consumers observe Unsubscribe through the Done channel, which removes any
// chance of publishing into a closed channel.
type Subscription struct {
	Events <-chan domain.Event

	hub  *Hub
	ch   chan domain.Event
	done chan struct{}
	once sync.Once
}

// Done is closed once the subscription has been cancelled.
func (s *Subscription) Done() <-chan struct{} { return s.done }

// Unsubscribe detaches the subscription from the hub; idempotent.
func (s *Subscription) Unsubscribe() {
	s.once.Do(func() {
		s.hub.mu.Lock()
		delete(s.hub.subs, s)
		s.hub.mu.Unlock()
		close(s.done)
	})
}

// Hub fans orchestration events out to every connected client. It implements
// domain.EventBus on the producer side. Publish never blocks: busy or gone
// subscribers drop the event.
type Hub struct {
	mu   sync.Mutex
	subs map[*Subscription]struct{}
}

var _ domain.EventBus = (*Hub)(nil)

// NewHub builds an empty fan-out hub.
func NewHub() *Hub {
	return &Hub{subs: make(map[*Subscription]struct{})}
}

// Subscribe registers a new event receiver.
func (h *Hub) Subscribe() *Subscription {
	ch := make(chan domain.Event, subscriberChanSize)
	sub := &Subscription{
		Events: ch,
		hub:    h,
		ch:     ch,
		done:   make(chan struct{}),
	}
	h.mu.Lock()
	h.subs[sub] = struct{}{}
	h.mu.Unlock()
	return sub
}

// Publish delivers ev to all current subscribers without blocking.
func (h *Hub) Publish(ev domain.Event) {
	h.mu.Lock()
	targets := make([]*Subscription, 0, len(h.subs))
	for sub := range h.subs {
		targets = append(targets, sub)
	}
	h.mu.Unlock()

	for _, sub := range targets {
		select {
		case sub.ch <- ev:
		case <-sub.done: // cancelled while we were publishing
		default: // slow client: drop rather than block the pipeline
		}
	}
}
