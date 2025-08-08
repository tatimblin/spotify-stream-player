package player

import (
	"fmt"
	"strings"
	"time"

	"github.com/zmb3/spotify/v2"
)

type PlayerState struct {
	Track     string    `json:"track"`
	Album     string    `json:"album"`
	Cover     string    `json:"cover"`
	Artists   string    `json:"artists"`
	ArtistURL string    `json:"artistUrl"`
	Progress  int       `json:"progress"`
	Duration  int       `json:"duration"`
	Preview   string    `json:"preview"`
	URL       string    `json:"url"`
	Playing   bool      `json:"playing"`
	Epoch     time.Time `json:"time"`
	Destroy   bool      `json:"destroy"`
}

type PlayerStateInterface interface {
	SetPlayerState(*spotify.CurrentlyPlaying) error
	GetFingerprint() Fingerprint
}

func (state *PlayerState) SetPlayerStateCurrent(currentlyPlaying *spotify.CurrentlyPlaying) {
	state.setTrackName(currentlyPlaying.Item.Name)
	state.setAlbum(currentlyPlaying.Item.Album)
	state.setArtists(currentlyPlaying.Item.Artists)
	state.setArtistURL(currentlyPlaying.Item.Artists)

	state.setPreview(currentlyPlaying.Item.PreviewURL)
	state.setURL(currentlyPlaying.Item.ExternalURLs, currentlyPlaying.Item.ID, currentlyPlaying.Item.Album)

	state.setPlayState(currentlyPlaying.Playing)

	state.setProgress(currentlyPlaying.Progress, currentlyPlaying.Item.TimeDuration().Milliseconds())
	state.setEpoch(time.UnixMilli(currentlyPlaying.Timestamp).UTC()) // Use Spotify's original timestamp
}

func (state *PlayerState) SetPlayerStateRecent(track *spotify.SimpleTrack) {
	state.setTrackName(track.Name)
	state.setAlbum(track.Album)
	state.setArtists(track.Artists)
	state.setArtistURL(track.Artists)

	state.setPreview(track.PreviewURL)
	state.setURL(track.ExternalURLs, track.ID, track.Album)

	state.setPlayState(false)
	state.setProgress(track.Duration, track.TimeDuration().Milliseconds())
	state.setEpoch(time.Now().UTC())
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

func (state *PlayerState) setArtistURL(artists []spotify.SimpleArtist) error {
	if len(artists) == 0 {
		state.ArtistURL = ""
		return nil
	}

	// Use the first artist's Spotify URL
	if url, ok := artists[0].ExternalURLs["spotify"]; ok {
		state.ArtistURL = url
	} else {
		state.ArtistURL = ""
	}
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
	return state.Epoch.IsZero() &&
		state.Track == ""
}

func (state *PlayerState) GetFingerprint() (Fingerprint, error) {
	if state.isNil() {
		return Fingerprint{}, fmt.Errorf("incomplete data")
	}

	// Calculate expected end time: current time + remaining duration
	remainingMs := state.Duration - state.Progress
	expectedEndTime := time.Now().Add(time.Duration(remainingMs) * time.Millisecond)

	return Fingerprint{
		uuid:            state.URL,
		epoch:           state.Epoch,
		expectedEndTime: expectedEndTime,
	}, nil
}
