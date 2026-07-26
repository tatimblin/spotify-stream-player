export interface Cover {
  url: string,
  width: number,
}

export interface TrackInterface {
  track: string,
  url: string,
  album: string,
  albumUrl: string,
  artists: string,
  artistUrl: string,
  cover?: string,
  covers?: Cover[],
}

// Build a srcset ("url 640w, url 300w, …") from the available cover sizes so the
// browser can pick the right image for the rendered size + device pixel ratio.
// The `sizes` attribute (the actual rendered width) is set by the component once
// it has measured the element (see main.ts); until then a conservative default
// keeps the browser from fetching the smallest image.
function buildSrcset(covers?: Cover[]): string {
  if (!covers || covers.length === 0) {
    return "";
  }
  return covers
    .filter((c) => c.url && c.width > 0)
    .map((c) => `${c.url} ${c.width}w`)
    .join(", ");
}

export default function (props: Partial<TrackInterface>) {
  const srcset = buildSrcset(props.covers);
  return `
    <div class="details" part="details">
      ${props.cover ? `<a class="album" part="album" href="${props.albumUrl ?? "#"}">
        <img class="art" part="art" crossorigin="anonymous" src="${props.cover}"${srcset ? ` srcset="${srcset}"` : ""} alt="${props.album ?? ""}"/>
      </a>` : ""}
      <div class="text">
        <a class="title" part="title" href="${props.url ?? "#"}">${props.track ?? ""}</a>
        <p class="artist" part="artist"><a href="${props.artistUrl ?? "#"}">${props.artists ?? ""}</a></p>
        <p class="album-text" part="album-text">${props.album ? `<a href="${props.albumUrl ?? "#"}">${props.album}</a>` : ""}</p>
      </div>
    </div>
  `;
}
