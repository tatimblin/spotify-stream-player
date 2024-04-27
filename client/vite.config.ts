import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      name: "SpotifyPlayer",
      entry: path.resolve(__dirname, "src/main.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => `index.${format}.js`,
      
    }
  }
})
