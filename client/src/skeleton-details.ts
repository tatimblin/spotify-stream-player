import classes from "./details.module.css";

export interface SkeletonDetailsInterface {
  // No props needed - static skeleton display
}

export default function SkeletonDetails(): string {
  return `
    <div class="${classes.details} ${classes.skeleton}">
      <div class="${classes.album}">&nbsp;</div>
      <div class="${classes.details_text}">
        <div class="${classes.head}">&nbsp;</div>
        <div class="${classes.rib}">&nbsp;</div>
      </div>
    </div>
  `;
}