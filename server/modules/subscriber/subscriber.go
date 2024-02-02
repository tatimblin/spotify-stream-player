package subscriber

import (
	"fmt"
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
	fmt.Println("playing")
	a.command <- Play
}

func (a *action) Pause() {
	fmt.Println("pausing")
	a.command <- Pause
}

func (a *action) Routine(callback func(), seconds time.Duration) {
	state := Pause

	for {
		time.Sleep(time.Second * seconds)
		fmt.Println("state:", state)
		select {
		case c := <-a.command:
			fmt.Println("dummy")
			switch c {
			case Play:
				fmt.Println("recieved play")
				state = Play
			case Pause:
				fmt.Println("recieved pause")
				state = Pause
			default:
				fmt.Println("errrrrror")
			}
		default:
			if state == Play {
				callback()
			}
		}
	}
}
