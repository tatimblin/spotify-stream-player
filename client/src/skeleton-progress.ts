import classes from "./progress.module.css";

export interface SkeletonProgressInterface {
  // No props needed - static skeleton display
}

export default function SkeletonProgress(): string {
  return `
    <div class="${classes.progress} ${classes.skeleton}">
      <span class="${classes.progress_timestamp}"></span>
      <progress
        class="${classes.progress_bar}"
        value="0"
        max="100"
      ></progress>
      <span class="${classes.progress_timestamp}"></span>
    </div>
  `;
}