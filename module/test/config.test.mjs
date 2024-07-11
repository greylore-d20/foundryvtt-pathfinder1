export function registerConfigTests() {
  quench.registerBatch(
    "pf1.config",
    async (context) => {
      const { describe, it, expect, after, assert } = context;

      describe("i18n", function () {
        it("No untranslated strings", function () {
          const flatConfig = foundry.utils.flattenObject(pf1.config);
          // Log bad values first
          for (const [path, value] of Object.entries(flatConfig)) {
            //
            if (typeof value === "string") {
              if (value.startsWith("PF1.")) {
                console.log("Missing:", path, value);
              }
            }
          }

          Object.entries(flatConfig)
            .filter(([_, value]) => typeof value === "string")
            .every(([path, value]) =>
              expect(value).to.not.match(/^PF1\./, `"${value}" at "${path}" is not valid or translated.`)
            );
        });

        it("Valid translations", function () {
          // Ignore paths, these include mostly internal IDs.
          const ignore = [
            /buffTargets\..*category$/,
            /contextNoteTargets\..*category$/,
            /^classCasterType\./,
            /favouredClassBonusIcons\./,
            /levelAbilityScoreFeature\./,
            /measureTemplateTypes\./, // Foundry doesn't provide translations for these
            /sizeChart\./,
            /^sheetSections/, // gives false positives for raw item data
          ];

          const configi18n = Object.entries(foundry.utils.flattenObject(pf1.config)).filter(([path, value]) => {
            if (typeof value !== "string") return false;

            if (value.length === 0) return false;

            if (ignore.some((re) => re.test(path))) return false;

            // Catch paths
            if (/\/.*\.\w+$/.test(value)) return false;

            try {
              if (fromUuidSync(value)) return false;
            } catch (e) {
              return false; // Embedded document link
            }

            // Assume strings that can be parsed as formulas are not i18n strings
            try {
              const roll = Roll.defaultImplementation.create(value).evaluateSync({ maximize: true });
              return false;
            } catch (e) {
              /* nop */
            }
            console.log(path, value); // Log everything for faster mass correction
            return true;
          });

          const sysi18n = new Set(Object.values(foundry.utils.flattenObject(game.i18n.translations)));

          configi18n.every(([path, value]) =>
            expect(sysi18n).to.contain(value, `"${value}" at "${path}" is not valid.`)
          );
        });
      });
    },
    {
      displayName: "PF1: Config Global",
    }
  );
}
