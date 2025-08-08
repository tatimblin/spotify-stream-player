import classes from "./details.module.css";

export interface TrackInterface {
  track: string,
  url: string,
  album: string,
  albumUrl: string,
  artists: string,
  artistUrl: string,
  cover?: string,
}

export default function(props: Partial<TrackInterface>) {
  return `
    <div class="${classes.details}">
      ${props.cover && `<a href="${props.albumUrl}">
        <img class="${classes.album}" src="${props.cover}"/>
      </a>`}
      <div class="${classes.details_text}">
        <a href="${props.url}" class="${classes.head}">${props.track}</a>
        <p class="${classes.rib}">
          <a href="${props.artistUrl}">${props.artists}</a> – <a href="${props.albumUrl}">${props.album}</a>
        </p>
      </div>
    </div>
  `;
}
