import * as chokidar from "chokidar";
import path from "node:path";
import fs from "fs-extra";
import { ViteLoggerPF } from "./vite-logger.mjs";
import { removePrefix } from "./foundry-config.mjs";

/** @type {import ("vite").ViteDevServer | undefined} */
let server;
/** @type {import ("chokidar").FSWatcher | undefined} */
let watcher;

/**
 * A plugin that watches the `publicDir` for changes to `.hbs` files, triggering a hot reload within Foundry
 *
 * @returns {import("vite").Plugin}
 */
export default function handlebarsReload() {
  return {
    name: "handlebars-hot-reload",
    configureServer(resolvedServer) {
      server = resolvedServer;
    },

    configResolved(config) {
      // Don't do anything for full builds
      if (config.command !== "serve") return;

      const logger = new ViteLoggerPF(config.logger);
      const watchPath = path.resolve(config.publicDir, "**/*.hbs");
      watcher = chokidar.watch(watchPath);
      // Clean up base dir to determine file placement within Foundry
      const foundryBaseDir = config.base
        .split(path.sep)
        .join(path.posix.sep)
        .replace(/^\/+|\/+$/g, "");

      /**
       * Handle an individual file change, triggering a hot reload within Foundry
       *
       * @param {string} file - The file that changed
       * @returns {Promise<void>}
       */
      const fileHandler = async (file) => {
        if (file.endsWith("hbs")) {
          // Transform OS path into Foundry-suitable path
          const filepathUrl = path
            .relative(config.publicDir, file)
            .split(path.sep)
            .join(path.posix.sep)
            .replace(/^\/+|\/+$/g, "");
          const foundryPath = `${removePrefix(foundryBaseDir)}/${filepathUrl}`;

          // Shortened relative path for display purposes
          const fileFromRoot = path.relative(config.root, file);

          // Trigger hot reload within dev server/Foundry
          const content = await fs.readFile(file, { encoding: "utf8" });
          logger.info(`Hot-reloading ${fileFromRoot} as ${foundryPath}`);
          server?.ws.send({
            type: "custom",
            event: "hotHandle:update",
            data: { file: foundryPath, content },
          });

          // Also copy template to `dist` to persist the change
          const distFile = path.resolve(config.build.outDir, path.relative(config.publicDir, file));
          await fs.copy(file, distFile);
          logger.info(`Copied ${fileFromRoot} to ${path.relative(config.root, distFile)}`);
        }
      };

      // Handle newly created files not already copied over
      watcher.on("add", async (file) => {
        // Only handle .hbs files
        if (!file.endsWith("hbs")) return;
        const fileFromPublic = path.relative(config.publicDir, file);
        const fileFromDist = path.resolve(config.build.outDir, fileFromPublic);

        // Don't spam the console with messages about files that are already in the dist directory
        if (!(await fs.pathExists(fileFromDist))) {
          return fileHandler(file);
        }
      });
      // Handle changed files
      watcher.on("change", fileHandler);
    },

    async buildEnd() {
      if (watcher) await watcher.close();
    },
  };
}
