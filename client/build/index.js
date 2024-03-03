class c extends HTMLElement{constructor(){super(...arguments)}connectedCallback(){const e=new Date;this.textContent=e.toLocaleDateString()}}customElements.define("spotify-player",c);
