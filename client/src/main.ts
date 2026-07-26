import Reactive from "./reactive";
import Details from "./details";
import type { TrackInterface } from "./details";
import Progress from "./progress";
import type { ProgressInterface } from "./progress";
import SkeletonDetails from "./skeleton-details";
import SkeletonProgress from "./skeleton-progress";
import styles from "./styles.css?inline";

interface Response {
  track: string,
  url: string,
  album: string,
  albumUrl: string,
  cover?: string,
  artists: string,
  artistUrl: string,
  progress: number,
  duration: number,
  playing: boolean,
  time: string,
  destroy: boolean,
}

// One CSSStyleSheet shared by every <spotify-player> instance on the page.
let sheet: CSSStyleSheet | undefined;
function getSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
  }
  return sheet;
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

  static observedAttributes = ["src", "layout"];

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [getSheet()];

    // Reactive queries the shadow root (not document) for its mount points.
    this.#details = new Reactive<TrackInterface>("details", null, Details, shadow);
    this.#progress = new Reactive<ProgressInterface>("progress", null, Progress, shadow);

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

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) {
      return;
    }
    if (name === "src" && this.isConnected) {
      this.#hasReceivedData = false;
      this.#renderSkeleton();
      this.#subscribe();
    }
    if (name === "layout") {
      this.#applyLayout();
    }
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

  // The persistent shadow wrapper. Created once and reused so adoptedStyleSheets
  // and the layout class survive innerHTML rewrites of its contents.
  #root(): HTMLElement {
    let root = this.shadowRoot!.querySelector<HTMLElement>('[part~="root"]');
    if (!root) {
      root = document.createElement("div");
      root.setAttribute("part", "root");
      root.className = "player";
      this.shadowRoot!.appendChild(root);
      this.#applyLayout();
    }
    return root;
  }

  #applyLayout() {
    const root = this.shadowRoot?.querySelector<HTMLElement>('[part~="root"]');
    if (!root) {
      return;
    }
    const cover = this.getAttribute("layout") === "cover";
    root.classList.toggle("player--cover", cover);
    root.classList.toggle("player--row", !cover);
  }

  #renderContent(...components: Reactive<any>[]) {
    const [details, progress] = components;
    this.#root().innerHTML = `${details.create()}${progress.create()}`;
  }

  #renderSkeleton() {
    this.#root().innerHTML = `${SkeletonDetails()}${SkeletonProgress()}`;
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
        url: data.url,
        album: data.album,
        albumUrl: data.albumUrl,
        artists: data.artists,
        artistUrl: data.artistUrl,
        cover: data.cover,
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
      const bar = this.shadowRoot!.getElementById("ssp-progress") as HTMLProgressElement | null;
      if (bar) {
        bar.value = percent;
        bar.textContent = `${percent.toFixed(1)}%`;
      }

      const time = this.shadowRoot!.getElementById("ssp-time");
      if (time) {
        time.textContent = this.#getPrettyTime(progress);
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

// Self-register on import so consumers can `import "@tristimb/spotify-stream-player"`
// and use <spotify-player> directly. Guarded so a manual customElements.define
// (or a second import) doesn't throw on re-registration.
if (
  typeof customElements !== "undefined" &&
  !customElements.get("spotify-player")
) {
  customElements.define("spotify-player", SpotifyPlayer);
}
