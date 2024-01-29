package player

import (
	"context"
	"log"
	"os"
	"sync"

	"github.com/zmb3/spotify/v2"
	spotifyauth "github.com/zmb3/spotify/v2/auth"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
)

var (
	spotifyInstance *spotify.Client
	spotifyOnce     sync.Once
)

func GetInstance(ctx context.Context) *spotify.Client {
	if spotifyInstance == nil {
		spotifyOnce.Do(func() {
			token, err := createToken(ctx)
			if err != nil {
				log.Fatalf("could not get token: %v", err)
			}
			httpclient := spotifyauth.New().Client(ctx, token)
			spotifyInstance = spotify.New(httpclient)
		})
	}

	return spotifyInstance
}

func createToken(ctx context.Context) (*oauth2.Token, error) {
	config := &clientcredentials.Config{
		ClientID:     os.Getenv("SPOTIFY_ID"),
		ClientSecret: os.Getenv("SPOTIFY_SECRET"),
		TokenURL:     spotifyauth.TokenURL,
	}
	return config.Token(ctx)
}
