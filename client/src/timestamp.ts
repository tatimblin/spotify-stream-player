export interface TimestampInterface {
  className: string
  milliseconds: number
}

export default function Timestamp (props: Partial<TimestampInterface>) {
  if (!props.milliseconds) {
    return ``;
  }

  return `<span class="${props.className}">${duration(props.milliseconds)}</span>`;
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
