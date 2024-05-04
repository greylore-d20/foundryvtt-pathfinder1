export function registerConfigTests() {
  quench.registerBatch(
    "pf1.config",
    async (context) => {
      const { describe, it, expect, after, assert } = context;

      describe("i18n", function () {
        it("Pre-translation", function () {
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

          Object.values(flatConfig)
            .filter((value) => typeof value === "string")
            .every((value) => expect(value).to.not.match(/^PF1\./, "Not valid or translated."));
        });
      });
    },
    {
      displayName: "PF1: Config Global",
    }
  );
}
