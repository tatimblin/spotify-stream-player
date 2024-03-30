import styles from './main.module.css'

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
  }

  connectedCallback() {
    const template = document.getElementById('my-template');
    console.log(template)
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
        <div class="${styles.details}">
          <img src="${this.#data.cover}"/>hi
          <div>
            <span>${this.#data.track.label}</span><br/>
            <span>${this.#data.artist.label} – ${this.#data.album.label}</span>
          </div>
        </div>
        <div class="${styles.progress}">
          <progress
            class="${styles["progress-bar"]}"
            value="${this.#data.progress}"
            max="${this.#data.duration}"
          >
              ${this.getProgress()}%
          </progress>
        </div>
      `;
  }

  getProgress(): number {
    return Math.floor((this.#data.progress / this.#data.duration) * 100);
  }
}

customElements.define("spotify-player", SpotifyPlayer);
