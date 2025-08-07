package player

import (
	"context"
	"fmt"
	"time"

	"github.com/zmb3/spotify/v2"
)

type Player struct {
	client          *spotify.Client
	ctx             context.Context
	fingerprint     Fingerprint
	previousPlaying bool
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
		fmt.Println("State change detected: Initial state")
		return true
	}

	// Track changed
	if player.fingerprint.uuid != newState.uuid {
		fmt.Println("State change detected: Track changed")
		return true
	}

	// Check for play/pause state changes
	previousState := player.getPreviousPlayingState()
	if previousState != playerState.Playing {
		if playerState.Playing {
			fmt.Println("State change detected: Resumed playing")
		} else {
			fmt.Println("State change detected: Paused")
		}
		return true
	}

	// For scrubbing detection - compare expected end times
	// If the expected end time changed significantly, it means the user scrubbed
	endTimeDiff := newState.expectedEndTime.Sub(player.fingerprint.expectedEndTime)

	// Significant change in expected end time (more than 10 seconds) indicates scrubbing
	if endTimeDiff > 10*time.Second || endTimeDiff < -5*time.Second {
		fmt.Printf("State change detected: Scrubbed (end time changed by: %v)\n", endTimeDiff)
		return true
	}

	// No significant change detected
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
	player.previousPlaying = playerState.Playing
}

// Get the previous playing state
func (player *Player) getPreviousPlayingState() bool {
	return player.previousPlaying
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
