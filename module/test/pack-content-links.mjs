/**
 * Content link validation
 */

export function registerPackContentLinks() {
  quench.registerBatch(
    "pf1.pack.contentLinks",
    (context) => {
      const { describe, it, expect, before, after, assert } = context;

      const packs = game.packs.filter((p) => p.metadata.packageType === "system");
      let index;

      // This is actually not awaited before the describe bits
      before(async function () {
        const p = [packs.map((p) => p.getIndex({ fields: ["system.description"] }))];
        await Promise.all(p);
      });

      describe("Compendiums (⚠️ needs re-run ⚠️)", function () {
        const out = false;
        for (const pack of packs) {
          describe(`${pack.metadata.label} (${pack.metadata.id})`, function () {
            let fails = 0;
            // before() above has not run yet, this will not work correctly
            for (const entry of pack.index) {
              // Despite indexing above, the index is not yet actually indexed, requires second run of the test
              const desc = entry.system?.description?.value;
              if (!desc) continue;
              if (!/@(Compendium|UUID)/.test(desc)) continue;

              // TODO: Check effect notes and footnotes, too
              // TODO: Check unindentified description

              let html;
              before(async function () {
                html = document.createElement("template");
                html.innerHTML = await TextEditor.enrichHTML(desc, { async: true });
              });

              it(entry.name, function () {
                const invalids = [];
                for (const link of html.content.querySelectorAll("a.content-link.broken")) {
                  invalids.push(`"${link.dataset.uuid}" [${link.textContent}] is invalid`);
                }

                assert(invalids.length == 0, "\n" + invalids.join("\n"));
                if (invalids.length > 0) fails += 1;
              });
            }

            // Secondary run is unavailable without this
            if (fails == 0) it("All OK", () => true);
          });
        }
      });
    },
    {
      displayName: "PF1: Compendiums – Content Links",
      preSelected: false, // These tests are too heavy
    }
  );
}
