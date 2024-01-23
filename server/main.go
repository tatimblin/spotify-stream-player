package main

import (
	"fmt"
	"log"
	"net/http"
	broker "spotify-stream-player/server/modules"
	"time"
)

func main() {

	broker := broker.NewServer()

	go func() {
		for {
			time.Sleep(time.Second * 2)
			eventString := fmt.Sprintf("this time is %v", time.Now())
			log.Println("Receiving Event")
			broker.Notifier <- []byte(eventString)
		}
	}()

	log.Fatal("HTTP server error: ", http.ListenAndServe("localhost:3000", broker))
}
