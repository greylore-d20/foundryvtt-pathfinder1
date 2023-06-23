import path from "node:path";
import url from "node:url";

import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { copy } from "@guanghechen/rollup-plugin-copy";
import tsconfigPaths from "vite-tsconfig-paths";

import { resolveUrl, FOUNDRY_CONFIG } from "./tools/foundry-config.mjs";
import handlebarsReload from "./tools/handlebars-reload.mjs";
import langReload from "./tools/lang-reload.mjs";
import forceMinifyEsm from "./tools/minify.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
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
    base: resolveUrl("systems/pf1/"),
    publicDir: resolve("public"),
    server: {
      port: 30001,
      open: FOUNDRY_CONFIG.openBrowser ?? false,
      proxy: {
        [`^(?!${resolveUrl("systems/pf1")})`]: "http://localhost:30000/",
        [resolveUrl("socket.io/")]: {
          target: "ws://localhost:30000",
          ws: true,
        },
      },
    },
    build: {
      minify: false,
      target: "es2022",
      outDir: resolve("dist"),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        external: /^(..\/..\/)?(fonts|ui|icons)\//,
        output: {
          sourcemapPathTransform: (relative) => {
            // Relative paths start with a `../`, which moves the path out of the `systems/pf1` directory.
            if (relative.startsWith("../")) relative = relative.replace("../", "");
            return relative;
          },
          assetFileNames: (assetInfo) => {
            // Forcibly rename style file so that it does not share Foundry's CSS file name
            if (assetInfo.name === "style.css") return "pf1.css";
          },
        },
      },
      reportCompressedSize: true,
      lib: {
        name: "pf1",
        entry: resolve("pf1.mjs"),
        formats: ["es"],
        fileName: () => "pf1.js",
      },
    },
    css: {
      devSourcemap: true,
      preprocessorOptions: {
        // the usual urls in less will work within Foundry due to file placement,
        // but the dev server would resolve them from the root instead of relative to the file
        less: {
          rootpath: command === "serve" ? "systems/pf1/" : "",
          rewriteUrls: command === "serve" ? "all" : "off",
        },
      },
    },
    plugins: [
      tsconfigPaths({
        root: resolve("."),
        projects: ["jsconfig.json"],
      }),
      forceMinifyEsm(),
      visualizer({
        sourcemap: true,
        template: "treemap",
      }),
      copy({ targets: [{ src: COPY_FILES, dest: resolve("dist") }], hook: "writeBundle" }),
      handlebarsReload(),
      langReload(),
    ],
  };
});

export default config;
