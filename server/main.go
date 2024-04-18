package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"spotify-stream-player/server/modules/broker"
	"spotify-stream-player/server/modules/player"
	"time"

	"github.com/joho/godotenv"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	log.Print("starting server...")

	err := godotenv.Load(".env")
	if err != nil {
		log.Fatalf("Error loading .env file: %s", err)
	}

	var state = player.PlayerState{}
	var (
		broker      broker.BrokerInterface = broker.NewBroker()
		player      player.PlayerInterface = player.NewPlayer()
		pollingRate                        = time.Second * 5
	)

	go func() {
		for {
			time.Sleep(pollingRate)
			updatePollingRate(&pollingRate, state.Playing)

			if !broker.IsListening() {
				continue
			}

			state, err = player.NowPlaying()
			if err != nil {
				fmt.Printf("Error: %s\n", err)
				continue
			}

			if !player.DetectStateChange(&state) {
				continue
			}
			player.SetPreviousState(&state)

			b, err := json.Marshal(state)
			if err != nil {
				fmt.Printf("Error: %s\n", err)
				continue
			}
			broker.Notify(b)
		}
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("defaulting on port %s", port)
	}

	h2s := &http2.Server{}
	handler := http.HandlerFunc(broker.ServeHTTP)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: h2c.NewHandler(handler, h2s),
	}
	log.Fatal("HTTP server error: ", server.ListenAndServe())
}

func updatePollingRate(pollingRate *time.Duration, playState bool) {
	if playState {
		*pollingRate = time.Duration(time.Second * 2)
	} else {
		*pollingRate = time.Duration(time.Second * 10)
	}
}
