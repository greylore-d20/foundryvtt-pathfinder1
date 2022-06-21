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
      const foundryBaseDir = config.base
        .split(path.sep)
        .join(path.posix.sep)
        .replace(/^\/+|\/+$/g, "");
      watcher.on("change", (file) => {
        if (file.endsWith("hbs")) {
          const filepathUrl = path
            .relative(config.publicDir, file)
            .split(path.sep)
            .join(path.posix.sep)
            .replace(/^\/+|\/+$/g, "");
          const foundryPath = `${foundryBaseDir}/${filepathUrl}`;
          const content = fs.readFileSync(file, { encoding: "utf8" });
          config.logger.info(`Reload ${file} as ${foundryPath}`);
          server.ws.send({
            type: "custom",
            event: "hotHandle:update",
            data: { file: foundryPath, content },
          });
        }
      });
    },

    async buildEnd() {
      await watcher.close();
    },
  };
}
