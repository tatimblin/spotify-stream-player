import Timestamp from "./timestamp.ts";

import classes from './style.module.css'

interface EventResponse extends Event {
  data: Response,
}

declare global {
  interface EventSourceEventMap {
    ['my-event']: MessageEvent<EventResponse>;
  }
}

interface Link {
  label: string,
  url?: string,
}

interface Response {
  track: Link,
  album: Link,
  artist: Link,
  cover: string,
  progress: number,
  duration: number,
  preview?: string,
}

class SpotifyPlayer extends HTMLElement {
  #source: string;
  #data: Response;

  constructor() {
    super();

    this.#source = "http://localhost:8080/";
    this.#data = {
      track: { label: "test" },
      album: { label: "test" },
      artist: { label: "test" },
      cover: "",
      progress: 0,
      duration: 0,
    };

    // setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
  }

  connectedCallback() {
    // this.attachShadow({ mode: "open" });

    const evtSource = new EventSource(this.#source);
    evtSource.onmessage = (event: Event) => {
      const messageEvent = (event as MessageEvent);
      this.#data = JSON.parse(messageEvent.data);
      this.render()
    }

    evtSource.addEventListener
  }

  render() {
    this.innerHTML = `
        <div class="${classes.details}">
          <img class="${classes.details_album}" src="${this.#data.cover}"/>
          <div>
            <span class="${classes.details_head}">${this.#data.track.label}</span>
            <br/>
            <span class="${classes.details_rib}">${this.#data.artist.label} – ${this.#data.album.label}</span>
          </div>
        </div>
        <div class="${classes.progress}">
          <progress
            class="${classes.progress_bar}"
            value="${this.#data.progress}"
            max="${this.#data.duration}"
          >
              ${this.getProgress()}%
          </progress>
          <div class="${classes.progress_duration}">
            ${Timestamp({
              className: classes.progress_duration_timestamp,
              milliseconds: this.#data.progress,
            })}
            ${Timestamp({
              className: classes.progress_duration_timestamp,
              milliseconds: this.#data.duration,
            })}
          </div>
        </div>
      `;
  }

  getProgress(): number {
    return Math.floor((this.#data.progress / this.#data.duration) * 100);
  }
}

customElements.define("spotify-player", SpotifyPlayer);
