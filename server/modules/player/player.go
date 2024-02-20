package player

import (
	"context"
	"fmt"

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
	NowPlaying() (*spotify.CurrentlyPlaying, error)
}

func (player *Player) SomeQuery() (*spotify.User, error) {
	return player.client.GetUsersPublicProfile(player.ctx, spotify.ID("tristimb"))
}

func (player *Player) NowPlaying() (*spotify.CurrentlyPlaying, error) {
	nowPlaying, err := player.client.PlayerCurrentlyPlaying(player.ctx)
	fmt.Println("nowPlaying", nowPlaying)
	fmt.Println(err)
	return nowPlaying, err
}
