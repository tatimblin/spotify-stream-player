package player

import (
	"context"
	"fmt"
	"time"

	"github.com/zmb3/spotify/v2"
)

type Player struct {
	client      *spotify.Client
	ctx         context.Context
	fingerprint PlayerStateFingerprint
}

func NewPlayer() *Player {
	ctx := context.Background()

	return &Player{
		client:      GetInstance(ctx),
		ctx:         ctx,
		fingerprint: PlayerStateFingerprint{},
	}
}

type PlayerInterface interface {
	NowPlaying() (*spotify.CurrentlyPlaying, error)
	DetectStateChange(*PlayerState) bool
	SetPreviousState(*PlayerState)
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

	playerState.SetPlayerState(nowPlaying)

	return playerState, nil
}

// Detect state change
func (player *Player) DetectStateChange(playerState *PlayerState) bool {
	newState, err := playerState.GetFingerprint()
	if err != nil {
		fmt.Printf("could not get state: %v\n", err)
		return true
	}

	timeDifference := player.fingerprint.epoch.Sub(newState.epoch)
	if timeDifference.Abs() > time.Second {
		fmt.Println("epoch", timeDifference.Abs())
		return true
	}

	if player.fingerprint.uuid != newState.uuid {
		return true
	}

	return false
}

// Set the previous state
func (player *Player) SetPreviousState(playerState *PlayerState) {
	fingerprint, err := playerState.GetFingerprint()
	if err != nil {
		fmt.Printf("cannot set state: %v\n", err)
		return
	}
	player.fingerprint = fingerprint
}
