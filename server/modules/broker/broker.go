package broker

import (
	"fmt"
	"log"
	"net/http"
)

type Broker struct {

	// Events are pushed to this channel by the main events-gathering routine
	Notifier chan []byte

	Playing bool

	// New client connections
	newClients chan chan []byte

	// Closed client connections
	closingClients chan chan []byte

	// Client connections registry
	clients map[chan []byte]bool
}

type BrokerInterface interface {
	NewServer() *Broker
	AddClient() chan []byte
	RemoveClient(chan []byte)
}

func NewServer() (broker *Broker) {
	// Instantiate a broker
	broker = &Broker{
		Notifier:       make(chan []byte, 1),
		Playing:        false,
		newClients:     make(chan chan []byte),
		closingClients: make(chan chan []byte),
		clients:        make(map[chan []byte]bool),
	}

	// Set it running - listening and broadcasting events
	go broker.listen()

	return
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
	rw.Header().Set("Access-Control-Allow-Origin", "*")

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
		fmt.Fprintf(rw, "data: %s\n\n", <-messageChan)
		flusher.Flush()
	}

}

func (broker *Broker) listen() {
	for {
		select {
		case event := <-broker.Notifier:
			for clientMessageChan := range broker.clients {
				clientMessageChan <- event
			}
		case s := <-broker.newClients:
			broker.clients[s] = true
			log.Printf("Client added. %d registered clients", len(broker.clients))
			if len(broker.clients) > 0 {
				broker.Playing = true
			}
		case s := <-broker.closingClients:
			if len(broker.clients) == 1 {
				broker.Playing = false
			}
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
