const ignorePaths = [/^sheetSections\./, /^currency\.(standard|base)$/];

export function registerConfigTests() {
  quench.registerBatch(
    "pf1.config",
    async (context) => {
      const { describe, it, expect, after, assert } = context;

      describe("i18n", function () {
        it("No untranslated strings", function () {
          let fails = 0;
          const flatConfig = foundry.utils.flattenObject(pf1.config);
          // Log bad values first
          for (const [path, value] of Object.entries(flatConfig)) {
            if (typeof value !== "string") continue;

            if (ignorePaths.some((ign) => ign.test(path))) continue;

            if (value.startsWith("PF1.")) {
              fails++;
              console.log("Missing:", path, value);
            }
          }

          Object.entries(flatConfig)
            .filter(([path, value]) => typeof value === "string" && !ignorePaths.some((ign) => ign.test(path)))
            .every(([path, value]) =>
              expect(value).to.not.match(/^PF1\./, `"${value}" at "${path}" is not valid or translated.`)
            );

          expect(fails).to.equal(0);
        });

        it("Valid translations", function () {
          // Ignore paths, these include mostly internal IDs.
          const ignore = [
            /buffTargets\..*category$/,
            /contextNoteTargets\..*category$/,
            /^classCasterType\./,
            /favouredClassBonusIcons\./,
            /levelAbilityScoreFeature\./,
            /^classNames\./,
            /^currency.(base|standard)$/,
            /measureTemplateTypes\./, // Foundry doesn't provide translations for these
            /sizeChart\./,
            /^sheetSections\./, // gives false positives for raw item data
          ];

          const sysi18n = new Set(Object.values(foundry.utils.flattenObject(game.i18n.translations)));

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

            if (!sysi18n.has(value)) console.log("Missing:", path, value); // Log everything for faster mass correction
            return true;
          });

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
