package player

import (
	"context"
	"strings"

	"github.com/zmb3/spotify/v2"
)

type Player struct {
	client *spotify.Client
	ctx    context.Context
}

func NewPlayer() *Player {
	ctx := context.Background()

	return &Player{
		client: GetInstance(ctx),
		ctx:    ctx,
	}
}

type PlayerInterface interface {
	NowPlaying() (*spotify.CurrentlyPlaying, error)
}

type link struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type PlayerActivity struct {
	Track    link   `json:"track"`
	Album    link   `json:"album"`
	Artist   link   `json:"artist"`
	Cover    string `json:"cover"`
	Progress int    `json:"progress"`
	Duration int    `json:"duration"`
	Preview  string `json:"preview"`
}

func (player *Player) NowPlaying() (PlayerActivity, error) {
	playerActivity := PlayerActivity{}

	nowPlaying, err := player.client.PlayerCurrentlyPlaying(player.ctx)
	if err != nil {
		return playerActivity, err
	}

	parsePlayerActivity(nowPlaying, &playerActivity)

	return playerActivity, nil
}

func parsePlayerActivity(currentlyPlaying *spotify.CurrentlyPlaying, playerActivity *PlayerActivity) {
	playerActivity.Track = link{
		Label: currentlyPlaying.Item.Name,
	}

	playerActivity.Album = link{
		Label: currentlyPlaying.Item.Album.Name,
	}

	var artists []string
	for _, artist := range currentlyPlaying.Item.Artists {
		artists = append(artists, artist.Name)
	}
	playerActivity.Artist = link{
		Label: strings.Join(artists, ", "),
	}

	lastImageIndex := len(currentlyPlaying.Item.Album.Images) - 1
	playerActivity.Cover = currentlyPlaying.Item.Album.Images[lastImageIndex].URL

	playerActivity.Progress = currentlyPlaying.Progress

	playerActivity.Duration = currentlyPlaying.Item.Duration

	playerActivity.Preview = currentlyPlaying.Item.PreviewURL
}
