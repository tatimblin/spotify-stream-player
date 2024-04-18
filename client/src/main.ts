// import Timestamp from "./timestamp.ts";
import Reactive from "./reactive";
import Details from "./details";
import type { TrackInterface } from "./details";
import Progress from "./progress";
import type { ProgressInterface } from "./progress";

interface EventResponse extends Event {
  data: Response,
}

declare global {
  interface EventSourceEventMap {
    ['my-event']: MessageEvent<EventResponse>;
  }
}

interface Response {
  track: string,
  album: string,
  artists: string,
  cover?: string,
  progress: number,
  duration: number,
  preview?: string,
  playing: boolean,
}

class SpotifyPlayer extends HTMLElement {
  #source: string;
  #details: Reactive<TrackInterface>;
  #progress: Reactive<ProgressInterface>;
  #playing: boolean = false;

  constructor() {
    super();

    this.#details = new Reactive<TrackInterface>("details", null, Details);
    this.#progress = new Reactive<ProgressInterface>("progress", null, Progress);

    this.render(this.#details, this.#progress);

    this.#source = "http://localhost:8080/";
  }

  connectedCallback() {
    const evtSource = new EventSource(this.#source);
    evtSource.onmessage = (event: Event) => {
      const messageEvent = (event as MessageEvent);
      const data = JSON.parse(messageEvent.data) as Response;
      this.#details.set({
        track: data.track,
        album: data.album,
        artists: data.artists,
        cover: data.cover,
        preview: data.preview,
      });
      this.#progress.set({
        progress: data.progress,
        duration: data.duration,
        isPlaying: data.playing,
      });
      this.#playing = data.playing;
    }

    // wip
    let running = false;
    const interval = setInterval(() => {
      const { progress, duration } = this.#progress.get();
      console.log(progress && duration && (progress < duration))
      if (progress && duration && progress < duration) {
        running = true
        console.log("test")
        this.#progress.set({
          progress: progress + 1000,
        });
      } else if (running) {
        clearInterval(interval);
      }
    }, 1000)
  }

  render(...components: Reactive<any>[]) {
    const [Details, Progress] = components;

    this.innerHTML = `
      ${Details.create()}
      ${Progress.create()}
    `;
  }
}

customElements.define("spotify-player", SpotifyPlayer);
