package player

import (
	"fmt"
	"strings"
	"time"

	"github.com/zmb3/spotify/v2"
)

type PlayerState struct {
	Track    string    `json:"track"`
	Album    string    `json:"album"`
	Cover    string    `json:"cover"`
	Artists  string    `json:"artists"`
	Progress int       `json:"progress"`
	Preview  string    `json:"preview"`
	URL      string    `json:"url"`
	Playing  bool      `json:"playing"`
	Cursor   int       `json:"elapsed"`
	Duration int       `json:"duration"`
	Epoch    time.Time `json:"epoch"`
	Destroy  bool      `json:"destroy"`
}

type PlayerStateInterface interface {
	SetPlayerState(*spotify.CurrentlyPlaying) error
	GetFingerprint() Fingerprint
}

func (state *PlayerState) SetPlayerState(currentlyPlaying *spotify.CurrentlyPlaying) {
	state.setTrackName(currentlyPlaying.Item.Name)
	state.setAlbum(currentlyPlaying.Item.Album)
	state.setArtists(currentlyPlaying.Item.Artists)

	state.setPreview(currentlyPlaying.Item.PreviewURL)
	state.setURL(currentlyPlaying.Item.ExternalURLs, currentlyPlaying.Item.ID, currentlyPlaying.Item.Album)

	state.setPlayState(currentlyPlaying.Playing)
	state.setProgress(currentlyPlaying.Progress, currentlyPlaying.Item.TimeDuration().Milliseconds())
	state.setEpoch(time.UnixMilli(currentlyPlaying.Timestamp).UTC())
}

func (state *PlayerState) SetPlayerStateSimple(track *spotify.SimpleTrack) {
	state.setTrackName(track.Name)
	state.setAlbum(track.Album)
	state.setArtists(track.Artists)

	state.setPreview(track.PreviewURL)
	state.setURL(track.ExternalURLs, track.ID, track.Album)

	state.setPlayState(false)
	state.setProgress(track.Duration, track.TimeDuration().Milliseconds())
	state.setEpoch(time.Now())
}

func (state *PlayerState) setTrackName(name string) error {
	state.Track = name
	return nil
}

func (state *PlayerState) setAlbum(album spotify.SimpleAlbum) error {
	state.Album = album.Name
	if albumCover, err := getAlbumCover(album); err == nil {
		state.Cover = albumCover
	}
	return nil
}

func getAlbumCover(album spotify.SimpleAlbum) (string, error) {
	if len(album.Images) == 0 {
		return "", fmt.Errorf("no image for song")
	}

	lastImageIndex := len(album.Images) - 1
	return album.Images[lastImageIndex].URL, nil
}

func (state *PlayerState) setArtists(artists []spotify.SimpleArtist) error {
	var artistNames []string
	for _, artist := range artists {
		artistNames = append(artistNames, artist.Name)
	}
	state.Artists = strings.Join(artistNames, ", ")
	return nil
}

func (state *PlayerState) setPlayState(playing bool) error {
	state.Playing = playing

	return nil
}

func (state *PlayerState) setProgress(elapsed_ms int, total_ms int64) error {
	state.Progress = elapsed_ms
	state.Duration = int(total_ms)

	return nil
}

func (state *PlayerState) setEpoch(epoch time.Time) error {
	state.Epoch = epoch

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
	if state.URL == "" || state.Cursor == 0 {
		return Fingerprint{}, fmt.Errorf("incomplete data")
	}

	return Fingerprint{
		uuid:         state.URL,
		epoch:        state.Epoch,
		offset_epoch: time.Now(),
	}, nil
}
