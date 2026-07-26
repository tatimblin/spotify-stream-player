export interface TimestampInterface {
  milliseconds: number
  active: boolean
}

export default function Timestamp (props: Partial<TimestampInterface>) {
  if (!props.milliseconds) {
    return ``;
  }

  const id = props.active ? `id="ssp-time"` : ``;
  const part = props.active ? `elapsed` : `remaining`;

  return `<span ${id} class="timestamp" part="${part}">${duration(props.milliseconds)}</span>`;
}

function duration (milliseconds: number) {
  const minutes = Math.floor(milliseconds / 1000 / 60);
  const seconds = Math.floor(milliseconds / 1000 % 60);

  let prepend = "";
  if (seconds < 10) {
    prepend = "0";
  }

  return `${minutes}:${prepend}${seconds}`;
}
