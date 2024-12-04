package player

import (
	"context"
	"fmt"

	"github.com/zmb3/spotify/v2"
)

type Player struct {
	client      *spotify.Client
	ctx         context.Context
	fingerprint Fingerprint
}

func NewPlayer() *Player {
	ctx := context.Background()

	return &Player{
		client:      GetInstance(ctx),
		ctx:         ctx,
		fingerprint: Fingerprint{},
	}
}

type PlayerInterface interface {
	NowPlaying() (PlayerState, error)
	DetectStateChange(*PlayerState) bool
	SetPreviousState(*PlayerState)
}

func (player *Player) NowPlaying() (PlayerState, error) {
	var playerState = PlayerState{}

	nowPlaying, err := player.client.PlayerCurrentlyPlaying(player.ctx)
	if err != nil {
		return playerState, err
	}

	if nowPlaying.Item == nil {
		recentlyPlayed, err := player.getRecentlyPlayedTrack()
		if err != nil {
			return playerState, err
		}
		playerState.SetPlayerStateSimple(&recentlyPlayed)
	} else {
		playerState.SetPlayerState(nowPlaying)
	}

	return playerState, nil
}

// Detect state change
func (player *Player) DetectStateChange(playerState *PlayerState) bool {
	newState, err := playerState.GetFingerprint()
	if err != nil {
		return false
	}

	// Initial state
	if player.fingerprint.IsZero() || newState.epoch.IsZero() {
		return true
	}

	isStateChange := player.fingerprint.epoch.Sub(newState.epoch) != 0

	// offset := time.Since(player.fingerprint.offset_epoch)
	// playerState.Cursor = playerState.Cursor.Add(offset)

	if isStateChange {
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

func (player *Player) getRecentlyPlayedTrack() (spotify.SimpleTrack, error) {
	recentlyPlayedList, err := player.client.PlayerRecentlyPlayedOpt(player.ctx, &spotify.RecentlyPlayedOptions{
		Limit: 1,
	})
	if err != nil {
		return spotify.SimpleTrack{}, err
	}

	if len(recentlyPlayedList) == 0 {
		return spotify.SimpleTrack{}, fmt.Errorf("no recent track found")
	}

	return recentlyPlayedList[0].Track, nil
}
