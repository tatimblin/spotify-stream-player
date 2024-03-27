import styleLoader from 'bun-style-loader';

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  plugins: [styleLoader()],
  minify: true,
});
