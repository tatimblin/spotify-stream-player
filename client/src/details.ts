export interface TrackInterface {
  track: string,
  url: string,
  album: string,
  albumUrl: string,
  artists: string,
  artistUrl: string,
  cover?: string,
}

export default function (props: Partial<TrackInterface>) {
  return `
    <div class="details" part="details">
      ${props.cover ? `<a class="album" part="album" href="${props.albumUrl ?? "#"}">
        <img class="art" part="art" src="${props.cover}" alt="${props.album ?? ""}"/>
      </a>` : ""}
      <div class="text">
        <a class="title" part="title" href="${props.url ?? "#"}">${props.track ?? ""}</a>
        <p class="artist" part="artist"><a href="${props.artistUrl ?? "#"}">${props.artists ?? ""}</a></p>
        <p class="album-text" part="album-text">${props.album ? `<a href="${props.albumUrl ?? "#"}">${props.album}</a>` : ""}</p>
      </div>
    </div>
  `;
}
