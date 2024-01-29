package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"spotify-stream-player/server/modules/broker"
	"spotify-stream-player/server/modules/player"
	"time"
)

func main() {
	log.Print("starting server...")

	broker := broker.NewServer()

	player := player.NewPlayer()

	go func() {
		for {
			time.Sleep(time.Second * 2)
			eventString := fmt.Sprintf("this time is %v", time.Now())
			log.Println("Receiving Event")
			broker.Notifier <- []byte(eventString)

			someUser, err := player.SomeQuery()
			if err != nil {
				log.Fatalf("could not get user")
			}
			log.Print(someUser)
		}
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("defaulting on port %s", port)
	}

	log.Fatal("HTTP server error: ", http.ListenAndServe(":"+port, broker))
}
