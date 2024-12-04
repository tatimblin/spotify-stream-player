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
	state.setTrack(currentlyPlaying.Item.Name)
	state.setAlbum(currentlyPlaying.Item.Album)
	state.setCover(currentlyPlaying.Item.Album)
	state.setArtist(currentlyPlaying.Item.Artists)
	state.setPreview(currentlyPlaying.Item.PreviewURL)
	state.setDuration(currentlyPlaying.Item.Duration)
	state.setURL(currentlyPlaying.Item.ExternalURLs, currentlyPlaying.Item.ID, currentlyPlaying.Item.Album)
	state.setPlaying(currentlyPlaying.Playing)
	state.setProgressMS(currentlyPlaying.Progress, currentlyPlaying.Timestamp)
}

func (state *PlayerState) SetPlayerStateSimple(track *spotify.SimpleTrack) {
	state.setTrack(track.Name)
	state.setCover(track.Album)
	state.setArtist(track.Artists)
	state.setPreview(track.PreviewURL)
	state.setDuration(track.Duration)
	state.setURL(track.ExternalURLs, track.ID, track.Album)
	state.setPlaying(false)
	state.setProgressMS(track.Duration, time.Now().Unix())
}

func (state *PlayerState) setTrack(name string) error {
	state.Track = name
	return nil
}

func (state *PlayerState) setAlbum(album spotify.SimpleAlbum) error {
	state.Album = album.Name
	return nil
}

func (state *PlayerState) setCover(album spotify.SimpleAlbum) error {
	if len(album.Images) == 0 {
		return fmt.Errorf("no image for song")
	}

	lastImageIndex := len(album.Images) - 1
	state.Cover = album.Images[lastImageIndex].URL
	return nil
}

func (state *PlayerState) setArtist(artists []spotify.SimpleArtist) error {
	var artistNames []string
	for _, artist := range artists {
		artistNames = append(artistNames, artist.Name)
	}
	state.Artists = strings.Join(artistNames, ", ")
	return nil
}

func (state *PlayerState) setPlaying(playing bool) error {
	state.Playing = playing

	return nil
}

func (state *PlayerState) setProgressMS(progress int, timestamp int64) error {
	state.Progress = progress
	state.Cursor = time.UnixMilli(timestamp).UTC()

	return nil
}

func (state *PlayerState) setDuration(duration int) error {
	state.Duration = duration
	return nil
}

func (state *PlayerState) setURL(urls map[string]string, id spotify.ID, album spotify.SimpleAlbum) error {
	if url, ok := album.ExternalURLs["spotify"]; ok {
		state.URL = url
		if id != "" {
			state.URL = fmt.Sprintf("%s?highlight=spotify:track:%s", url, id)
		}
		return nil
	}

	state.URL = urls["spotify"]
	return nil
}

func (state *PlayerState) setPreview(url string) error {
	state.Preview = url
	return nil
}

func (state *PlayerState) isNil() bool {
	return state.Track == ""
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
