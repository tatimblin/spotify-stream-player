package player

import (
	"fmt"
	"strings"
	"time"

	"github.com/zmb3/spotify/v2"
)

type PlayerStateFingerprint struct {
	uuid  string
	epoch time.Time
}

type PlayerState struct {
	Track    string `json:"track"`
	Album    string `json:"album"`
	Artists  string `json:"artists"`
	Cover    string `json:"cover"`
	Progress int    `json:"progress"`
	Duration int    `json:"duration"`
	Preview  string `json:"preview"`
	URL      string `json:"url"`
	epoch    time.Time
}

type PlayerStateInterface interface {
	SetPlayerState(*spotify.CurrentlyPlaying) error
	GetFingerprint() PlayerStateFingerprint
}

func (state *PlayerState) SetPlayerState(currentlyPlaying *spotify.CurrentlyPlaying) {
	state.setTrack(currentlyPlaying.Item)
	state.setAlbum(currentlyPlaying.Item)
	state.setArtist(currentlyPlaying.Item)
	state.setPreview(currentlyPlaying.Item)
	state.setDuration(currentlyPlaying.Item)
	state.setURL(currentlyPlaying.Item)
	state.setProgress(currentlyPlaying)
}

func (state *PlayerState) setTrack(track *spotify.FullTrack) error {
	state.Track = track.Name
	return nil
}

func (state *PlayerState) setAlbum(track *spotify.FullTrack) error {
	state.Album = track.Album.Name
	return nil
}

func (state *PlayerState) setArtist(track *spotify.FullTrack) error {
	var artists []string
	for _, artist := range track.Artists {
		artists = append(artists, artist.Name)
	}
	state.Artists = strings.Join(artists, ", ")
	return nil
}

func (state *PlayerState) setProgress(currentlyPlaying *spotify.CurrentlyPlaying) error {
	state.Progress = currentlyPlaying.Progress

	currentTime := time.UnixMilli(currentlyPlaying.Timestamp)
	state.epoch = currentTime.Add(time.Duration(state.Progress))

	return nil
}

func (state *PlayerState) setDuration(track *spotify.FullTrack) error {
	state.Duration = track.Duration
	return nil
}

func (state *PlayerState) setURL(track *spotify.FullTrack) error {
	if url, ok := track.Album.ExternalURLs["spotify"]; ok {
		state.URL = url
		if track.ID != "" {
			state.URL = fmt.Sprintf("%s?highlight=spotify:track:%s", state.URL, track.ID)
		}
		return nil
	}

	state.URL = track.ExternalURLs["spotify"]
	return nil
}

func (state *PlayerState) setPreview(track *spotify.FullTrack) error {
	state.Preview = track.PreviewURL
	return nil
}

func (state *PlayerState) GetFingerprint() (PlayerStateFingerprint, error) {
	if state.URL == "" || state.epoch.IsZero() {
		return PlayerStateFingerprint{}, fmt.Errorf("incomplete data")
	}

	return PlayerStateFingerprint{
		uuid:  state.URL,
		epoch: state.epoch,
	}, nil
}
