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
	NowPlaying() (*spotify.CurrentlyPlaying, error)
}

func (player *Player) NowPlaying() (PlayerState, error) {
	playerState := PlayerState{}

	nowPlaying, err := player.client.PlayerCurrentlyPlaying(player.ctx)
	if err != nil {
		return playerState, err
	}

	if nowPlaying.Item == nil {
		return playerState, fmt.Errorf("not a track")
	}

	playerState.SetTrack(nowPlaying.Item)
	playerState.SetAlbum(nowPlaying.Item)
	playerState.SetArtist(nowPlaying.Item)
	playerState.SetPreview(nowPlaying.Item)
	playerState.SetDuration(nowPlaying.Item)
	playerState.SetProgress(nowPlaying)

	return playerState, nil
}
