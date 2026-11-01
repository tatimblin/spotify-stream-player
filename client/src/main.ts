import Reactive from "./reactive";
import Details from "./details";
import type { TrackInterface, Cover } from "./details";
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
  covers?: Cover[],
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
  // What the `playing` attribute and `playstatechange` last announced: null until
  // the first message says which state the track is in.
  #announced: boolean | null = null;
  #start = 0;
  #duration = 0;
  #tickID?: number;
  // Last values written by the clock, so a tick that changes nothing writes nothing.
  #lastTime = "";
  #lastValue = -1;
  #lastPercent = "";
  #eventSource?: EventSource;
  #onVisibilityChange?: () => void;
  #idleTimeout?: number;
  #idleTimeoutDuration = 30 * 60 * 1000; // 30 minutes
  #resizeObserver?: ResizeObserver;
  // Pristine innerHTML of each marquee-eligible line, captured before we wrap it
  // in a scrolling track so #setupMarquee() can restore it and stay idempotent.
  #marqueeOriginals = new WeakMap<HTMLElement, string>();

  static observedAttributes = ["src", "layout", "paused"];

  // The clock's rate. The elapsed text only changes once a second and the bar
  // moves a fraction of a pixel per second, so 4Hz is visually continuous while
  // costing a fifteenth of a per-frame loop.
  static readonly TICK_MS = 250;

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

    // Keep the art's `sizes` in sync with its rendered width so the browser
    // re-picks the best srcset candidate when the layout changes.
    if (typeof ResizeObserver !== "undefined" && !this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(() => {
        this.#updateArtSizes();
        // Overflow depends on the rendered width, so re-evaluate the marquee
        // whenever the element resizes (a line that now fits should stop
        // scrolling; one that no longer fits should start).
        this.#setupMarquee();
      });
      this.#resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    // Without this the listener outlives the element: a detached player would
    // resubscribe (and run its clock) on the next visibility change, and every
    // re-insertion would add another listener.
    if (this.#onVisibilityChange) {
      document.removeEventListener("visibilitychange", this.#onVisibilityChange);
      this.#onVisibilityChange = undefined;
    }
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
    if (name === "paused") {
      // Paused: the clock stops (the stream stays open, so the state is current
      // on resume). Resumed: catch the clock up at once, then carry on.
      this.#clearTimer();
      if (!this.paused) {
        this.#startClock();
      }
    }
  }

  /**
   * `paused` stops the progress clock without closing the stream — for a host
   * that knows the player is off screen. Reflects the `paused` attribute.
   */
  get paused(): boolean {
    return this.hasAttribute("paused");
  }

  set paused(value: boolean) {
    this.toggleAttribute("paused", Boolean(value));
  }

  /**
   * Whether a track is playing: null until the first message arrives. Reflected
   * as the `playing` attribute; each change fires `playstatechange`.
   */
  get playing(): boolean | null {
    return this.#announced;
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
        // The details component re-creates the <img> on every track change, so
        // re-run extraction + resize the srcset target against the fresh image.
        this.#extractCoverColor();
        this.#updateArtSizes();
        this.#setupMarquee();
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

  // Sample the current cover art and expose its average color as the
  // --ssp-cover-color custom property + a `coverchange` event. Fully defensive:
  // a cross-origin-tainted canvas throws on read, in which case we leave the
  // property unset so CSS `var(--ssp-cover-color, <fallback>)` keeps working.
  #extractCoverColor() {
    const img = this.shadowRoot?.querySelector<HTMLImageElement>('img.art');
    if (!img) {
      return;
    }

    if (img.complete && img.naturalWidth > 0) {
      this.#sampleCoverColor(img);
      return;
    }

    // Not ready yet — sample once the image loads. Guard against hooking the
    // same node twice (renders can re-invoke before load fires).
    if (img.dataset.sspHooked === "1") {
      return;
    }
    img.dataset.sspHooked = "1";
    img.addEventListener(
      "load",
      () => this.#sampleCoverColor(img),
      { once: true }
    );
  }

  #sampleCoverColor(img: HTMLImageElement) {
    try {
      if (!img.naturalWidth || !img.naturalHeight) {
        return;
      }

      const size = 16;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return; // canvas 2d unsupported — leave the property unset
      }

      ctx.drawImage(img, 0, 0, size, size);

      // Reading pixels from a canvas tainted by a cross-origin image throws a
      // SecurityError; any failure here means we simply don't set the color.
      const { data } = ctx.getImageData(0, 0, size, size);

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 128) {
          continue; // skip near-transparent pixels
        }
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      if (count === 0) {
        return;
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      const color = `rgb(${r} ${g} ${b})`;
      this.style.setProperty("--ssp-cover-color", color);
      this.dispatchEvent(
        new CustomEvent("coverchange", { detail: { color } })
      );
    } catch {
      // Tainted canvas or any other read failure — leave things unset.
      return;
    }
  }

  // Set the art <img>'s `sizes` to its actual rendered CSS width so the browser
  // resolves the srcset to the smallest candidate that still covers the display
  // size at the current device-pixel-ratio. No-op when there's no srcset.
  #updateArtSizes() {
    const img = this.shadowRoot?.querySelector<HTMLImageElement>('img.art');
    if (!img || !img.hasAttribute("srcset")) {
      return;
    }
    const width = Math.round(img.getBoundingClientRect().width);
    if (width > 0) {
      img.setAttribute("sizes", `${width}px`);
    }
  }

  // Car-radio marquee: for each single-line text row that overflows its box,
  // duplicate its content into a scrolling track that loops continuously; leave
  // rows that fit (or that the host lets wrap) untouched. Purely overflow-driven
  // — the component never forces single-line. Fully idempotent: every call first
  // restores each row to its pristine markup, then re-measures, so it's safe to
  // run on every render, track change, and resize.
  #setupMarquee() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const reduceMotion =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rows = root.querySelectorAll<HTMLElement>(".title, .artist");
    rows.forEach((el) => {
      // Restore any prior marquee wrapping so measurement sees the real text.
      const original = this.#marqueeOriginals.get(el);
      if (original !== undefined) {
        el.innerHTML = original;
        el.classList.remove("is-marquee");
        el.style.removeProperty("--ssp-marquee-shift");
        el.style.removeProperty("--ssp-marquee-duration");
        this.#marqueeOriginals.delete(el);
      }

      if (reduceMotion) {
        return; // static ellipsis (host styling) — no scrolling
      }

      // Only overflows when the host has constrained the row to a single line.
      const overflow = el.scrollWidth - el.clientWidth;
      if (overflow <= 1) {
        return;
      }

      // Wrap the existing content in a track and append an aria-hidden clone so
      // the loop is seamless. The gap between copies is read from CSS so hosts
      // can tune it via --ssp-marquee-gap.
      const content = el.innerHTML;
      this.#marqueeOriginals.set(el, content);

      const gapPx = this.#marqueeGapPx(el);
      const copyWidth = el.scrollWidth; // one copy's laid-out width
      const shift = copyWidth + gapPx;  // distance to travel for a seamless wrap

      el.classList.add("is-marquee");
      el.innerHTML =
        `<span class="marquee-track">` +
        `<span class="marquee-copy">${content}</span>` +
        `<span class="marquee-copy" aria-hidden="true">${content}</span>` +
        `</span>`;

      // Constant scroll speed: duration scales with distance travelled.
      const PX_PER_SEC = 40;
      const duration = Math.min(30, Math.max(4, shift / PX_PER_SEC));
      el.style.setProperty("--ssp-marquee-shift", `${shift}px`);
      el.style.setProperty("--ssp-marquee-duration", `${duration}s`);
    });
  }

  // Resolve the computed --ssp-marquee-gap for a row to pixels (falls back to a
  // 2em-equivalent when unset or non-px). Used to size the loop's wrap distance.
  #marqueeGapPx(el: HTMLElement): number {
    const raw = getComputedStyle(el).getPropertyValue("--ssp-marquee-gap").trim();
    const px = parseFloat(raw);
    if (raw.endsWith("px") && !Number.isNaN(px)) {
      return px;
    }
    const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
    return fontSize * 2;
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
        covers: data.covers,
      });

      // #details.set re-renders the <img> on every track change (not just the
      // first), so re-extract the tint color + re-fit the srcset target against
      // the new image each time. Deferred a frame so the new <img> is in the DOM.
      requestAnimationFrame(() => {
        this.#extractCoverColor();
        this.#updateArtSizes();
        this.#setupMarquee();
      });

      this.#progress.set({
        progress: data.progress,
        duration: data.duration,
        isPlaying: data.playing,
      });

      // Anchor progress to WHEN the server measured it (data.time, Spotify's
      // timestamp), not when this client received it. The broker replays its
      // cached last-event to every new connection, so a page reload mid-song
      // gets a `progress` that was captured when the song started — using the
      // receipt time would restart the bar near 0. Deriving #start from the
      // server epoch means `now - #start` yields the real elapsed time.
      // Falls back to receipt-time anchoring if the timestamp is unparseable.
      const now = new Date().getTime();
      const measuredAt = data.time ? new Date(data.time).getTime() : NaN;
      this.#start = Number.isNaN(measuredAt) ? now - data.progress : measuredAt - data.progress;
      this.#playing = Boolean(data.playing && !data.destroy);
      this.#duration = data.duration;

      // The progress template just re-rendered the bar and the elapsed text, so
      // the clock's change-detection starts over.
      this.#lastTime = "";
      this.#lastValue = -1;
      this.#lastPercent = "";

      this.#clearTimer();
      this.#announce(this.#playing && this.#elapsed() <= this.#duration);
      this.#startClock();
    }
  }

  #elapsed(): number {
    return Math.max(0, new Date().getTime() - this.#start);
  }

  // Start the clock if there is something for it to do: a playing track, on a
  // player nobody has paused.
  #startClock() {
    if (this.#playing && !this.paused && this.#tickID === undefined) {
      this.#tick();
    }
  }

  // One clock step: write the bar and the elapsed time if they changed, then
  // schedule the next step for the sooner of TICK_MS or the next whole second,
  // so the seconds still turn over on time.
  #tick = () => {
    this.#tickID = undefined;
    const progress = this.#elapsed();

    if (progress > this.#duration) {
      this.#announce(false);
      return;
    }

    const percent = Math.min(100, (progress / this.#duration) * 100);
    const bar = this.shadowRoot!.getElementById("ssp-progress") as HTMLProgressElement | null;
    if (bar) {
      const value = Math.round(percent * 100) / 100;
      if (value !== this.#lastValue) {
        bar.value = value;
        this.#lastValue = value;
      }
      // The fallback text, in the same whole percent the template renders.
      const fallback = `${Math.floor(percent)}%`;
      if (fallback !== this.#lastPercent) {
        bar.textContent = fallback;
        this.#lastPercent = fallback;
      }
    }

    const time = this.shadowRoot!.getElementById("ssp-time");
    if (time) {
      const text = this.#getPrettyTime(progress);
      if (text !== this.#lastTime) {
        time.textContent = text;
        this.#lastTime = text;
      }
    }

    if (this.#playing && !this.paused && percent < 100) {
      const toNextSecond = 1000 - (progress % 1000) + 1;
      this.#tickID = window.setTimeout(this.#tick, Math.min(SpotifyPlayer.TICK_MS, toNextSecond));
    }
  };

  // Reflect the play state as the `playing` attribute and fire
  // `playstatechange` when it changes, so a host need not watch the clock.
  #announce(playing: boolean | null) {
    if (playing === this.#announced) {
      return;
    }
    this.#announced = playing;
    this.toggleAttribute("playing", playing === true);
    this.dispatchEvent(
      new CustomEvent("playstatechange", { detail: { playing } })
    );
  }

  #setupVisibilityHandling() {
    if (this.#onVisibilityChange) {
      return; // already listening (connectedCallback runs on every re-insertion)
    }
    this.#onVisibilityChange = () => {
      if (document.hidden) {
        this.#cleanup();
      } else if (this.isConnected) {
        this.#hasReceivedData = false;
        this.#renderSkeleton();
        this.#subscribe();
      }
    };

    document.addEventListener('visibilitychange', this.#onVisibilityChange);
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
    this.#playing = false;
    this.#clearTimer();
    this.#renderSkeleton();
    // Back to the skeleton: nothing is known to be playing any more.
    if (this.#announced) {
      this.#announce(false);
    }
  }

  #clearTimer() {
    if (this.#tickID !== undefined) {
      window.clearTimeout(this.#tickID);
      this.#tickID = undefined;
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
