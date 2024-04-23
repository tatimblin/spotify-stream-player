import Timestamp from "./timestamp";
import classes from "./progress.module.css";

export interface ProgressInterface {
  progress: number,
  duration: number,
  isPlaying: boolean,
}

export default function(props: Partial<ProgressInterface>) {
  if (!props.duration || !props.progress) {
    return ``;
  }  

  return `
    <div class="${classes.progress}">
      ${Timestamp({
        className: classes.progress_timestamp,
        milliseconds: props.progress,
        active: true,
      })}
      <progress
        id="progress"
        class="${classes.progress_bar}"
        value="${(props.progress / props.duration) * 100}"
        max="${100}"
      >
          ${getPercent(props.progress, props.duration)}%
      </progress>
      ${Timestamp({
        className: classes.progress_timestamp,
        milliseconds: props.duration,
      })}
    </div>
  `;
}

function getPercent(progress: number, duration: number): number {
  return Math.floor((progress / duration) * 100);
}
