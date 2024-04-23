package subscriber

import (
	"sync"
	"time"
)

type command string

const (
	Play  command = "Play"
	Pause command = "Pause"
)

var (
	actionInstance action
	actionOnce     sync.Once
)

type Subscriber interface {
	Play()
	Pause()
	Routine(func())
}

type action struct {
	command chan command
}

func GetAction() action {
	actionOnce.Do(func() {
		actionInstance = action{}
	})

	return actionInstance
}

func (a *action) Play() {
	a.command <- Play
}

func (a *action) Pause() {
	a.command <- Pause
}

func (a *action) Routine(callback func(), seconds time.Duration) {
	state := Pause

	for {
		time.Sleep(time.Second * seconds)
		select {
		case c := <-a.command:
			switch c {
			case Play:
				state = Play
			case Pause:
				state = Pause
			}
		default:
			if state == Play {
				callback()
			}
		}
	}
}
