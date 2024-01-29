package player

import (
	"context"

	"github.com/zmb3/spotify/v2"
)

type Player struct {
	client *spotify.Client
	ctx    context.Context
}

func NewPlayer() *Player {
	ctx := context.Background()

	return &Player{
		client: GetInstance(ctx),
		ctx:    ctx,
	}
}

type PlayerInterface interface {
	SomeQuery() (*spotify.User, error)
}

func (player *Player) SomeQuery() (*spotify.User, error) {
	return player.client.GetUsersPublicProfile(player.ctx, spotify.ID("2rdu132h3xewzz4sjegc4j4pq"))
}
