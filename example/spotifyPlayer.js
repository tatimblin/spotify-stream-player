class SpotifyPlayer extends HTMLElement {
  connectedCallback() {
    const now = new Date();
    this.textContent = now.toLocaleDateString();
  }
}

customElements.define("spotify-player", SpotifyPlayer);
