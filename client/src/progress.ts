import Timestamp from "./timestamp";
import classes from "./progress.module.css";

export interface ProgressInterface {
  progress: number,
  duration: number,
}

export default function(props: ProgressInterface) {
  return `
    <div class="${classes.progress}">
      ${Timestamp({
        className: classes.progress_timestamp,
        milliseconds: props.progress,
      })}
      <progress
        class="${classes.progress_bar}"
        value="${props.progress}"
        max="${props.duration}"
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
