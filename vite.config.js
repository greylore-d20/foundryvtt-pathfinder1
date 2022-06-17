import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
//import checker from "vite-plugin-checker";
import path from "path";
import { copy } from "@guanghechen/rollup-plugin-copy";
import handlebarsReload from "./tools/handlebars-reload.mjs";

/**
 * Returns an absolute path
 *
 * @param {string} relativePath - A path relative to the project root
 * @returns {string} An absolute path
 */
function resolve(relativePath) {
  return path.resolve(__dirname, relativePath);
}

const COPY_FILES = ["CREDITS.md", "LICENSE.txt", "CHANGELOG.md", "OGL.text", "help"].map(resolve);

const config = defineConfig({
  root: ".",
  base: "/systems/pf1/",
  publicDir: resolve("public"),
  server: {
    port: 30001,
    open: true,
    proxy: {
      "^(?!/systems/pf1)": "http://localhost:30000/",
      "/socket.io": {
        target: "ws://localhost:30000",
        ws: true,
      },
    },
  },
  esbuild: {
    minifySyntax: true,
    //minifyWhitespace: true,
    keepNames: true,
  },
  build: {
    outDir: resolve("dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        sourcemapPathTransform: (relative) => path.join("/systems/pf1", relative),
      },
    },
    reportCompressedSize: true,
    lib: {
      name: "pf1",
      entry: resolve("pf1.js"),
      formats: ["es"],
      fileName: () => "pf1.js",
    },
  },
  plugins: [
    // checker({
    //   typescript: true,
    // }),
    visualizer({
      gzipSize: true,
      template: "treemap",
    }),
    copy({ targets: [{ src: COPY_FILES, dest: resolve("dist") }], hook: "writeBundle" }),
    handlebarsReload(),
  ],
});

export default config;
