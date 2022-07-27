import * as chokidar from "chokidar";
import path from "node:path";
import { buildLanguageFiles, buildLanguageFile } from "./help-lang.mjs";
import { ViteLoggerPF } from "./vite-logger.mjs";

/** @type {import ("vite").ViteDevServer} */
let server;
/** @type {import ("chokidar").FSWatcher} */
let watcher;
/** @type {ViteLoggerPF} */
let logger;

const resolve = (root) => (target) => path.resolve(root, target);

/**
 * A plugin that watches the `lang` and `help` directories for changes, triggering a hot reload within Foundry
 *
 * @returns {import("vite").Plugin}
 */
export default function langReload() {
  return {
    name: "lang-hot-reload",
    configureServer(resolvedServer) {
      server = resolvedServer;
    },

    async configResolved(config) {
      logger = new ViteLoggerPF(config.logger);
      // Set up watcher
      const resolveRoot = resolve(config.root);
      const watchPaths = ["lang/**/*.json", "help/**/*.md"].map(resolveRoot);
      watcher = chokidar.watch(watchPaths, { ignoreInitial: true });
      watcher.on("change", async (file) => {
        /** @type {string} */
        let language;
        if (file.endsWith(".md")) {
          language = path.relative(config.root, file).split(path.sep)[1];
        } else if (file.endsWith(".json")) {
          language = path.basename(file, ".json");
        }

        const reloadedLanguage = await buildLanguageFile(language, { logger: logger });

        if ("content" in reloadedLanguage) {
          // Trigger hot reload within dev server/Foundry
          server.ws.send({
            type: "custom",
            event: "hotLangs:update",
            data: reloadedLanguage,
          });
          logger.info(`Hot Reloading ${language}.json`);
        }
      });
    },

    async buildStart() {
      // Trigger a build of language files when building the system
      await buildLanguageFiles({ logger });
    },

    async buildEnd() {
      await watcher.close();
    },
  };
}
