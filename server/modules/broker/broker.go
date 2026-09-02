package broker

import (
	"fmt"
	"log"
	"net/http"
	"sync/atomic"
)

// clientBuffer is how many events a client may fall behind before the broker
// starts dropping frames for it. Every event is a whole-state snapshot, so a
// client that misses one is corrected by the next — dropping is always safe,
// and it keeps a single stalled connection from blocking listen() for everyone.
const clientBuffer = 4

type Broker struct {
	Notifier       chan []byte
	listening      atomic.Bool
	newClients     chan chan []byte
	closingClients chan chan []byte
	clients        map[chan []byte]bool
	lastEvent      []byte
	allowedOrigins map[string]bool
}

func NewBroker(allowedOrigins map[string]bool) (broker *Broker) {
	// Instantiate a broker
	broker = &Broker{
		Notifier:       make(chan []byte, 1),
		newClients:     make(chan chan []byte),
		closingClients: make(chan chan []byte),
		clients:        make(map[chan []byte]bool),
		allowedOrigins: allowedOrigins,
	}

	// Set it running - listening and broadcasting events
	go broker.listen()

	return
}

type BrokerInterface interface {
	ServeHTTP(http.ResponseWriter, *http.Request)
	AddClient() chan []byte
	RemoveClient(chan []byte)
	Notify([]byte)
	IsListening() bool
}

func (broker *Broker) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	flusher, ok := rw.(http.Flusher)
	if !ok {
		http.Error(rw, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	// Reject before writing stream headers, so the 403 goes out as a plain
	// error response rather than an event-stream that never streams.
	origin := req.Header.Get("Origin")
	if !broker.allowedOrigins[origin] {
		http.Error(rw, "Origin not allowed", http.StatusForbidden)
		return
	}

	rw.Header().Set("Content-Type", "text/event-stream")
	rw.Header().Set("Cache-Control", "no-cache")
	rw.Header().Set("Connection", "keep-alive")
	rw.Header().Set("Access-Control-Allow-Origin", origin)

	messageChan := broker.AddClient()
	defer broker.RemoveClient(messageChan)

	// Returning promptly is what keeps this cheap: the platform bills a request
	// until its handler returns, so a loop that only reads messageChan goes on
	// billing a client that hung up until the request timeout finally fires.
	for {
		select {
		case <-req.Context().Done():
			return
		case message, ok := <-messageChan:
			if !ok {
				return
			}
			if len(message) == 0 {
				continue
			}
			if _, err := fmt.Fprintf(rw, "data: %s\n\n", message); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (broker *Broker) listen() {
	for {
		select {
		case event := <-broker.Notifier:
			broker.lastEvent = event
			for clientMessageChan := range broker.clients {
				select {
				case clientMessageChan <- event:
				default:
					// Already clientBuffer events behind. Drop this one rather
					// than stall every other client waiting behind it.
				}
			}
		case s := <-broker.newClients:
			broker.clients[s] = true
			// Only send lastEvent if it's not empty. The channel was just made
			// and is buffered, so this send cannot block.
			if len(broker.lastEvent) > 0 {
				s <- broker.lastEvent
			}
			broker.listening.Store(true)
			log.Printf("Client added. %d registered clients", len(broker.clients))
		case s := <-broker.closingClients:
			// A handler can report the same client twice (context cancelled and
			// then the deferred removal); ignore the second one so we never
			// close an already-closed channel.
			if !broker.clients[s] {
				continue
			}
			delete(broker.clients, s)
			// Wakes the handler if it is still parked on a receive. listen() is
			// the only goroutine that sends on or closes a client channel, so
			// this cannot race a send.
			close(s)
			broker.listening.Store(len(broker.clients) > 0)
			log.Printf("Removed client. %d registered clients", len(broker.clients))
		}
	}
}

func (broker *Broker) AddClient() chan []byte {
	messageChan := make(chan []byte, clientBuffer)
	broker.newClients <- messageChan

	return messageChan
}

func (broker *Broker) RemoveClient(messageChan chan []byte) {
	broker.closingClients <- messageChan
}

func (broker *Broker) Notify(b []byte) {
	broker.Notifier <- b
}

func (broker *Broker) IsListening() bool {
	return broker.listening.Load()
}
