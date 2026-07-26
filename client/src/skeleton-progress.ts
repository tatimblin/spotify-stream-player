export default function SkeletonProgress(): string {
  return `
    <div class="progress skeleton" part="progress">
      <span class="timestamp" part="elapsed"></span>
      <progress
        class="progress-bar"
        part="progress-bar"
        value="0"
        max="100"
      ></progress>
      <span class="timestamp" part="remaining"></span>
    </div>
  `;
}
