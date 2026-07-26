// Demo harness. Mocks EventSource so both players render static track data with
// no SSE server, then leaves the two layouts (row + cover) side by side to prove
// they come from identical markup with only CSS differences.
import "./src/main"; // self-registers <spotify-player>

const MOCK = {
  track: "Deeper Well",
  url: "#",
  album: "Deeper Well",
  albumUrl: "#",
  cover:
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>
        <rect width='400' height='400' fill='#4a7c59'/>
        <text x='200' y='230' font-size='120' text-anchor='middle' fill='#ffffff'>&#9834;</text>
      </svg>`
    ),
  artists: "Kacey Musgraves",
  artistUrl: "#",
  progress: 46000,
  duration: 192000,
  playing: true,
  time: "",
  destroy: false,
};

// Minimal EventSource stand-in that emits one message shortly after construction.
class MockEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  constructor(_url: string) {
    setTimeout(() => {
      this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(MOCK) }));
    }, 50);
  }
  close() {}
}
// @ts-expect-error swap in the mock for the demo only
window.EventSource = MockEventSource;
