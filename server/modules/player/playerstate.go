package player

import (
	"strings"

	"github.com/zmb3/spotify/v2"
)

type PlayerState struct {
	Track    string `json:"track"`
	Album    string `json:"album"`
	Artists  string `json:"artists"`
	Cover    string `json:"cover"`
	Progress int    `json:"progress"`
	Duration int    `json:"duration"`
	Preview  string `json:"preview"`
}

type PlayerStateInterface interface {
	SetTrack(*spotify.FullTrack) error
	SetAlbum(*spotify.FullTrack) error
	SetArtist(*spotify.FullTrack) error
	SetProgress(*spotify.CurrentlyPlaying) error
	SetDuration() error
	SetPreview() error
}

func (state *PlayerState) SetTrack(track *spotify.FullTrack) error {
	state.Track = track.Name
	return nil
}

func (state *PlayerState) SetAlbum(track *spotify.FullTrack) error {
	state.Album = track.Album.Name
	return nil
}

func (state *PlayerState) SetArtist(track *spotify.FullTrack) error {
	var artists []string
	for _, artist := range track.Artists {
		artists = append(artists, artist.Name)
	}
	state.Artists = strings.Join(artists, ", ")
	return nil
}

func (state *PlayerState) SetProgress(currentlyPlaying *spotify.CurrentlyPlaying) error {
	state.Progress = currentlyPlaying.Progress
	return nil
}

func (state *PlayerState) SetDuration(track *spotify.FullTrack) error {
	state.Duration = track.Duration
	return nil
}

func (state *PlayerState) SetPreview(track *spotify.FullTrack) error {
	state.Preview = track.PreviewURL
	return nil
}
