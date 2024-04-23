package player

import (
	"fmt"
	"strings"
	"time"

	"github.com/zmb3/spotify/v2"
)

type PlayerState struct {
	Playing  bool      `json:"playing"`
	Track    string    `json:"track"`
	Album    string    `json:"album"`
	Artists  string    `json:"artists"`
	Cover    string    `json:"cover"`
	Progress int       `json:"progress"`
	Duration int       `json:"duration"`
	Preview  string    `json:"preview"`
	URL      string    `json:"url"`
	Cursor   time.Time `json:"time"`
	Destroy  bool      `json:"destroy"`
}

type PlayerStateInterface interface {
	SetPlayerState(*spotify.CurrentlyPlaying) error
	GetFingerprint() Fingerprint
}

func (state *PlayerState) SetPlayerState(currentlyPlaying *spotify.CurrentlyPlaying) {
	state.setTrack(currentlyPlaying.Item)
	state.setAlbum(currentlyPlaying.Item)
	state.setCover(currentlyPlaying.Item)
	state.setArtist(currentlyPlaying.Item)
	state.setPreview(currentlyPlaying.Item)
	state.setDuration(currentlyPlaying.Item)
	state.setURL(currentlyPlaying.Item)
	state.setPlaying(currentlyPlaying)
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

func (state *PlayerState) setCover(track *spotify.FullTrack) error {
	if len(track.Album.Images) == 0 {
		return fmt.Errorf("no image for song")
	}

	lastImageIndex := len(track.Album.Images) - 1
	state.Cover = track.Album.Images[lastImageIndex].URL
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

func (state *PlayerState) setPlaying(currentlyPlaying *spotify.CurrentlyPlaying) error {
	state.Playing = currentlyPlaying.Playing

	return nil
}

func (state *PlayerState) setProgress(currentlyPlaying *spotify.CurrentlyPlaying) error {
	state.Progress = currentlyPlaying.Progress
	state.Cursor = time.UnixMilli(currentlyPlaying.Timestamp).UTC()

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

func (state *PlayerState) GetFingerprint() (Fingerprint, error) {
	if state.URL == "" || state.Cursor.IsZero() {
		return Fingerprint{}, fmt.Errorf("incomplete data")
	}

	return Fingerprint{
		uuid:         state.URL,
		epoch:        state.Cursor,
		offset_epoch: time.Now(),
	}, nil
}
