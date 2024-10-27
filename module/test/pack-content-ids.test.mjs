export function registerPackContentTests() {
  quench.registerBatch(
    "pf1.packs",
    (context) => {
      const { describe, it, expect, before, beforeEach, after, assert } = context;

      let classIndex, classIds, spellIndex;

      describe("foo", function () {
        before(async function () {
          const cpack = game.packs.get("pf1.classes");
          classIndex = await cpack.getIndex({ fields: ["system.tag", "system.subType"] });

          const classIds = new Set();
          classIndex.forEach((c) => {
            if (!c.system.tag) return;
            classIds.add(c.system.tag);
          });

          const spack = game.packs.get("pf1.spells");
          spellIndex = await spack.getIndex({ fields: ["system.learnedAt.class"] });
        });

        it(`Found Classes`, function () {
          expect(classIds.size).to.be.greaterThan(0);
        });

        it(`Found Spells`, function () {
          expect(classIndex.length).to.be.greaterThan(0);
        });

        describe("Spells", function () {
          for (const e of spellIndex) {
            describe(e.name, () => {
              it("Class Associations", function () {
                const assocs = e.system?.learnedAt?.class;
                if (!assocs) return;
                const classes = Object.keys(assocs);
                const failingIds = classes.filter((id) => !classIds.has(id));
                assert(!classIds.has(failingIds), `Invalid class ID(s): ${failingIds.join(", ")}`);
              });
            });
          }
        });
      });
    },
    {
      displayName: "PF1: Compendium Content",
    }
  );
}
