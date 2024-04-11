import classes from "./details.module.css";

export interface TrackInterface {
  track: string,
  album: string,
  artists: string,
  cover?: string,
  preview?: string,
}

export default function(props: TrackInterface) {
  return `
    <div class="${classes.details}">
      ${props.cover && `<img class="${classes.album}" src="${props.cover}"/>`}
      <div>
        <span class="${classes.head}">${props.track}</span>
        <br/>
        <span class="${classes.rib}">${props.artists} – ${props.album}</span>
      </div>
    </div>
  `;
}
