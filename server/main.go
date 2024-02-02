package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"spotify-stream-player/server/modules/broker"
	"spotify-stream-player/server/modules/player"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	log.Print("starting server...")

	err := godotenv.Load(".env")
	if err != nil {
		log.Fatalf("Error loading .env file: %s", err)
	}

	broker := broker.NewServer()
	player := player.NewPlayer()

	paused := true

	go func() {
		select {
		case <-broker.Play:
			fmt.Println("play")
			paused = false
		case <-broker.Pause:
			fmt.Println("pause")
			paused = true
		}
	}()

	go func() {
		for {
			fmt.Println("enter")

			time.Sleep(time.Second * 2)

			if paused {
				fmt.Println("abort")
				continue
			}

			someUser, err := player.SomeQuery()
			if err != nil {
				log.Fatalf("could not get user")
			}

			log.Println("Receiving Event")
			broker.Notifier <- []byte(someUser.DisplayName)
		}
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("defaulting on port %s", port)
	}

	log.Fatal("HTTP server error: ", http.ListenAndServe(":"+port, broker))
}
