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
  interface Window {
    progress: HTMLProgressElement | null;
    time: HTMLSpanElement | null;
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
  time: string,
  destroy: boolean,
}

class SpotifyPlayer extends HTMLElement {
  #details: Reactive<TrackInterface>;
  #progress: Reactive<ProgressInterface>;
  #playing: boolean = false;
  #start = 0;
  #duration = 0;
  #animationID?: number;

  observedAttributes = ["src"];

  constructor() {
    super();

    this.#details = new Reactive<TrackInterface>("details", null, Details);
    this.#progress = new Reactive<ProgressInterface>("progress", null, Progress);

    this.render(this.#details, this.#progress);
  }

  connectedCallback() {
    this.#subscribe();
  }

  render(...components: Reactive<any>[]) {
    const [Details, Progress] = components;

    this.innerHTML = `
      ${Details.create()}
      ${Progress.create()}
    `;
  }

  #subscribe() {
    if (!this.src) {
      return;
    }

    const evtSource = new EventSource(this.src);
    evtSource.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data) as Response;

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

      this.#start = new Date(data.time).getTime() - data.progress;
      this.#playing = data.playing;
      this.#duration = data.duration;

      this.#clearTimer();
      if (this.#playing && !data.destroy) {
        this.#animationID = window.requestAnimationFrame(this.#timer);
      }
    }
  }

  get #timer() {
    return () => {
      const now = new Date().getTime();
      const progress = now - this.#start;

      if (progress > this.#duration) {
        this.#clearTimer();
      }

      const percent = (progress / this.#duration) * 100;
      if (window.progress) {
        window.progress.value = percent;
        window.progress.innerText = `${percent}%`;
      }

      if (window.time) {
        window.time.innerText = this.#getPrettyTime(progress);
      }

      if (this.#playing && percent < 100) {
        window.requestAnimationFrame(this.#timer);
      }
    }
  }

  #clearTimer() {
    if (this.#animationID) {
      window.cancelAnimationFrame(this.#animationID);
      this.#animationID = undefined;
    }
  }

  #getPrettyTime(progress: number) {
    if (!progress) {
      return "0:00";
    }

    const min = Math.floor(progress / (1000 * 60));
    const sec = Math.floor(progress % (1000 * 60) / 1000);

    return `${min}:${sec < 10 ? `0${sec}` : sec}`;
  }

  get src(): string | null {
    return this.getAttribute("src");
  }

  set src(source: string) {
    if (source) {
      this.setAttribute("src", source);
    } else {
      this.removeAttribute("src");
    }
  }
}

customElements.define("spotify-player", SpotifyPlayer);
