package player

import (
	"context"
	"log"
	"os"
	"sync"
	"time"

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
			token, err := createAuthenticatedToken(ctx)
			if err != nil {
				log.Fatalf("could not get token: %v", err)
			}

			spotifyInstance = spotify.New(spotifyauth.New().Client(ctx, token))
		})
	}

	return spotifyInstance
}

// Creates a new auth token for a specific user by using a pre determined
// refresh_token `SPOTIFY_REFRESH`, and forcing a refresh.
func createAuthenticatedToken(ctx context.Context) (*oauth2.Token, error) {
	auth := spotifyauth.New()

	config := &clientcredentials.Config{
		ClientID:     os.Getenv("SPOTIFY_ID"),
		ClientSecret: os.Getenv("SPOTIFY_SECRET"),
		TokenURL:     spotifyauth.TokenURL,
	}

	token, err := config.Token(ctx)
	if err != nil {
		return nil, err
	}

	token.RefreshToken = os.Getenv("SPOTIFY_REFRESH")
	token.Expiry = time.Now()

	return auth.RefreshToken(ctx, token)
}
