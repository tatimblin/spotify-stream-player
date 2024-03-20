class SpotifyPlayer extends HTMLElement {
  connectedCallback() {
    const now = new Date();
    this.textContent = now.toLocaleDateString() + "hey there mr dog";
  }
}

customElements.define("spotify-player", SpotifyPlayer);
