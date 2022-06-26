import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "node:path";
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

const COPY_FILES = ["CREDITS.md", "LICENSE.txt", "CHANGELOG.md", "OGL.txt", "help"];

const config = defineConfig(({ command, mode }) => {
  return {
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
    build: {
      // Slower than esbuild, but required for options
      minify: mode === "development" ? false : "terser",
      // Keep class and function symbol names for sane console output
      terserOptions:
        mode === "development"
          ? undefined
          : {
              keep_classnames: true,
              keep_fnames: true,
            },
      outDir: resolve("dist"),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          // Relative paths start with a `../`, resulting in the `pf1` missing
          sourcemapPathTransform: (relative) => path.join("/systems/pf1/pf1/", relative),
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
    css: {
      preprocessorOptions: {
        // the usual urls in less will work within Foundry due to file placement,
        // but the dev server would resolve them from the root instead of relative to the file
        less: {
          rootpath: command === "serve" ? "systems/pf1/" : "",
          rewriteUrls: command === "serve" ? "all" : "",
        },
      },
    },
    plugins: [
      visualizer({
        sourcemap: true,
        template: "treemap",
      }),
      copy({ targets: [{ src: COPY_FILES, dest: resolve("dist") }], hook: "writeBundle" }),
      handlebarsReload(),
    ],
  };
});

export default config;
