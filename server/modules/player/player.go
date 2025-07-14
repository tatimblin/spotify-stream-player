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

	if nowPlaying.Item != nil {
		playerState.SetPlayerStateCurrent(nowPlaying)
		fmt.Println(playerState)

		return playerState, nil
	}

	// No track playing, fallback to recently played

	recentlyPlayed, err := player.getRecentlyPlayedTrack()
	if err != nil {
		return playerState, err
	}
	playerState.SetPlayerStateRecent(&recentlyPlayed)

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

	// Track changed
	if player.fingerprint.uuid != newState.uuid {
		return true
	}

	// For the same track, send updates if playing to keep timestamps accurate
	// or if there's a significant time gap (more than 10 seconds)
	timeDiff := newState.epoch.Sub(player.fingerprint.epoch)
	if playerState.Playing || timeDiff > 10*time.Second || timeDiff < -5*time.Second {
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
