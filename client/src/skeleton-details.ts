import classes from "./details.module.css";

export interface SkeletonDetailsInterface {
  // No props needed - static skeleton display
}

export default function SkeletonDetails(): string {
  return `
    <div class="${classes.details} ${classes.skeleton}">
      <div class="${classes.album}">
        <img src="/placeholder.svg" alt="Music placeholder" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.3;" />
      </div>
      <div class="${classes.details_text}">
        <div class="${classes.head}">&nbsp;</div>
        <div class="${classes.rib}">&nbsp;</div>
      </div>
    </div>
  `;
}