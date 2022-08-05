import { createMatchPath, loadConfig } from "tsconfig-paths";

/**
 * A plugin that rewrites `@foundry` imports to `../../` relative paths so that they are always
 * resolved from the root of the Foundry instance at runtime (regardless of routePrefix).
 *
 * @returns {import("vite").Plugin} - A Vite plugin
 */
export default function rewriteFoundryImports() {
  let matcher;
  return {
    name: "vite-rewrite-foundry-imports",
    configResolved(config) {
      // Add `@foundry` to externals to avoid Foundry imports being bundled
      const rollupOptions = (config.build.rollupOptions ??= {});
      (rollupOptions.external ??= []).push("@foundry");
      const jsConfig = loadConfig();
      if (jsConfig.resultType === "success") {
        matcher = createMatchPath(config.root, jsConfig.paths, undefined, true);
      }
    },
    resolveId(id) {
      if (!id.startsWith("@") || id.includes("\0")) return;
      if (id.startsWith("@foundry/")) {
        // The result of this replacement differs between a rollup `build` and a dev server `serve`:
        //   - `build` will generate imports relative to `pf1.mjs`, resulting in `../../`
        //   - `serve` uses absolute paths with the routePrefix prepended, resulting in `${routePrefix}/systems/pf1/../../`
        return { id: id.replace("@foundry/", "../../"), external: true };
      } else {
        const result = matcher(id);
        if (result) return { id: result };
      }
    },
  };
}
