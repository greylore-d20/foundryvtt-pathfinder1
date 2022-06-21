import * as chokidar from "chokidar";
import path from "node:path";
import fs from "fs-extra";

/** @type {import ("vite").ViteDevServer} */
let server;
/** @type {import ("chokidar").FSWatcher} */
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
      const watchPath = path.resolve(config.publicDir, "**/*.hbs");
      watcher = chokidar.watch(watchPath);
      // Clean up base dir to determine file placement within Foundry
      const foundryBaseDir = config.base
        .split(path.sep)
        .join(path.posix.sep)
        .replace(/^\/+|\/+$/g, "");

      watcher.on("change", async (file) => {
        if (file.endsWith("hbs")) {
          // Transform OS path into Foundry-suitable path
          const filepathUrl = path
            .relative(config.publicDir, file)
            .split(path.sep)
            .join(path.posix.sep)
            .replace(/^\/+|\/+$/g, "");
          const foundryPath = `${foundryBaseDir}/${filepathUrl}`;

          // Shortened relative path for display purposes
          const fileFromRoot = path.relative(config.root, file);

          // Trigger hot reload within dev server/Foundry
          const content = await fs.readFile(file, { encoding: "utf8" });
          config.logger.info(`Reload ${fileFromRoot} as ${foundryPath}`);
          server.ws.send({
            type: "custom",
            event: "hotHandle:update",
            data: { file: foundryPath, content },
          });

          // Also copy template to `dist` to persist the change
          const distFile = path.resolve(config.build.outDir, path.relative(config.publicDir, file));
          await fs.copy(file, distFile);
          config.logger.info(`Copied ${fileFromRoot} to ${path.relative(config.root, distFile)}`);
        }
      });
    },

    async buildEnd() {
      await watcher.close();
    },
  };
}
