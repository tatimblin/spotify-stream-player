import Timestamp from "./timestamp";

export interface ProgressInterface {
  progress: number,
  duration: number,
  isPlaying: boolean,
}

export default function (props: Partial<ProgressInterface>) {
  if (!props.duration || !props.progress) {
    return ``;
  }

  return `
    <div class="progress" part="progress">
      ${Timestamp({
        milliseconds: props.progress,
        active: true,
      })}
      <progress
        id="ssp-progress"
        class="progress-bar"
        part="progress-bar"
        value="${(props.progress / props.duration) * 100}"
        max="${100}"
      >
          ${getPercent(props.progress, props.duration)}%
      </progress>
      ${Timestamp({
        milliseconds: props.duration,
      })}
    </div>
  `;
}

function getPercent(progress: number, duration: number): number {
  return Math.floor((progress / duration) * 100);
}
