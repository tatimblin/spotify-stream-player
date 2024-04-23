import classes from "./details.module.css";

export interface TrackInterface {
  track: string,
  album: string,
  artists: string,
  cover?: string,
  preview?: string,
}

export default function(props: Partial<TrackInterface>) {
  return `
    <div class="${classes.details}">
      ${props.cover && `<img class="${classes.album}" src="${props.cover}"/>`}
      <div class="${classes.details_text}">
        <p class="${classes.head}">${props.track}</p>
        <p class="${classes.rib}">${props.artists} – ${props.album} ${props.artists} – ${props.album} ${props.artists} – ${props.album}</p>
      </div>
    </div>
  `;
}
