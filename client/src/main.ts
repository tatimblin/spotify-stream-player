import Reactive from "./reactive";
import Details from "./details";
import type { TrackInterface } from "./details";
import Progress from "./progress";
import type { ProgressInterface } from "./progress";
import SkeletonDetails from "./skeleton-details";
import SkeletonProgress from "./skeleton-progress";

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
  cover?: string,
  artists: string,
  progress: number,
  duration: number,
  preview?: string,
  playing: boolean,
  time: string,
  destroy: boolean,
}

export default class SpotifyPlayer extends HTMLElement {
  #details: Reactive<TrackInterface>;
  #progress: Reactive<ProgressInterface>;
  #hasReceivedData: boolean = false;
  #playing: boolean = false;
  #start = 0;
  #duration = 0;
  #animationID?: number;
  #eventSource?: EventSource;
  #idleTimeout?: number;
  #idleTimeoutDuration = 30 * 60 * 1000; // 30 minutes

  observedAttributes = ["src"];

  constructor() {
    super();

    this.#details = new Reactive<TrackInterface>("details", null, Details);
    this.#progress = new Reactive<ProgressInterface>("progress", null, Progress);

    this.#renderSkeleton();
  }

  connectedCallback() {
    this.#renderSkeleton();
    this.#subscribe();
    this.#setupVisibilityHandling();
    this.#startIdleTimer();
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  render(...components: Reactive<any>[]) {
    if (this.#hasReceivedData) {
      this.#renderContent(...components);
      requestAnimationFrame(() => {
        components.forEach(component => {
          try {
            component.render();
          } catch (error) {
            console.warn('Component render failed:', error);
          }
        });
      });
    } else {
      this.#renderSkeleton();
    }
  }

  #renderContent(...components: Reactive<any>[]) {
    const [Details, Progress] = components;

    this.innerHTML = `
      <div class="content-transition">
        ${Details.create()}
        ${Progress.create()}
      </div>
    `;
  }

  #renderSkeleton() {
    this.innerHTML = `
      <div class="content-transition">
        ${SkeletonDetails()}
        ${SkeletonProgress()}
      </div>
    `;
  }

  #subscribe() {
    if (!this.src) {
      return;
    }

    this.#cleanup();

    this.#eventSource = new EventSource(this.src);

    this.#eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
    };

    this.#eventSource.onmessage = (event: MessageEvent) => {
      this.#resetIdleTimer();

      if (!event.data || event.data.trim() === '') {
        console.warn('Received empty data from server');
        return;
      }

      let data: Response;
      try {
        data = JSON.parse(event.data) as Response;
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        console.error('Raw data:', event.data);
        return;
      }

      if (!this.#hasReceivedData) {
        this.#hasReceivedData = true;
        this.render(this.#details, this.#progress);
      }

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

      const now = new Date().getTime();

      this.#start = now - data.progress;
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
      const progress = Math.max(0, now - this.#start);

      if (progress > this.#duration) {
        this.#clearTimer();
        return;
      }

      const percent = Math.min(100, (progress / this.#duration) * 100);
      if (window.progress) {
        window.progress.value = percent;
        window.progress.innerText = `${percent.toFixed(1)}%`;
      }

      if (window.time) {
        window.time.innerText = this.#getPrettyTime(progress);
      }

      if (this.#playing && percent < 100) {
        this.#animationID = window.requestAnimationFrame(this.#timer);
      }
    }
  }

  #setupVisibilityHandling() {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.#cleanup();
      } else {
        this.#hasReceivedData = false;
        this.#renderSkeleton();
        this.#subscribe();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  #startIdleTimer() {
    this.#idleTimeout = window.setTimeout(() => {
      this.#cleanup();
    }, this.#idleTimeoutDuration);
  }

  #resetIdleTimer() {
    if (this.#idleTimeout) {
      window.clearTimeout(this.#idleTimeout);
    }
    this.#startIdleTimer();
  }

  #cleanup() {
    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = undefined;
    }

    if (this.#idleTimeout) {
      window.clearTimeout(this.#idleTimeout);
      this.#idleTimeout = undefined;
    }

    this.#hasReceivedData = false;
    this.#clearTimer();
    this.#renderSkeleton();
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
