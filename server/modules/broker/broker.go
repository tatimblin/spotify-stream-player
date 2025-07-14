package broker

import (
	"fmt"
	"log"
	"net/http"
)

type Broker struct {
	Notifier       chan []byte
	Listening      bool
	newClients     chan chan []byte
	closingClients chan chan []byte
	clients        map[chan []byte]bool
	lastEvent      []byte
	destroyMessage []byte
	allowedOrigins map[string]bool
}

func NewBroker(allowedOrigins map[string]bool, destroyMessage []byte) (broker *Broker) {
	// Instantiate a broker
	broker = &Broker{
		Notifier:       make(chan []byte, 1),
		Listening:      false,
		newClients:     make(chan chan []byte),
		closingClients: make(chan chan []byte),
		clients:        make(map[chan []byte]bool),
		destroyMessage: destroyMessage,
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

	rw.Header().Set("Content-Type", "text/event-stream")
	rw.Header().Set("Cache-Control", "no-cache")
	rw.Header().Set("Connection", "keep-alive")

	origin := req.Header.Get("Origin")
	if broker.allowedOrigins[origin] {
		rw.Header().Set("Access-Control-Allow-Origin", origin)
	} else {
		http.Error(rw, "Origin not allowed", http.StatusForbidden)
		return
	}

	messageChan := broker.AddClient()

	defer func() {
		broker.RemoveClient(messageChan)
	}()

	go func() {
	outer:
		for {
			<-req.Context().Done()
			broker.RemoveClient(messageChan)
			break outer
		}
	}()

	for {
		message := <-messageChan
		if len(message) > 0 {
			fmt.Fprintf(rw, "data: %s\n\n", message)
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
				clientMessageChan <- event
			}
		case s := <-broker.newClients:
			broker.clients[s] = true
			// Only send lastEvent if it's not empty
			if len(broker.lastEvent) > 0 {
				s <- broker.lastEvent
			}
			log.Printf("Client added. %d registered clients", len(broker.clients))
			if len(broker.clients) > 0 {
				broker.Listening = true
			}
		case s := <-broker.closingClients:
			if len(broker.clients) == 1 {
				broker.Listening = false
			}
			s <- broker.destroyMessage
			delete(broker.clients, s)
			log.Printf("Removed client. %d registered clients", len(broker.clients))
		}
	}
}

func (broker *Broker) AddClient() chan []byte {
	messageChan := make(chan []byte)
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
	return broker.Listening
}
