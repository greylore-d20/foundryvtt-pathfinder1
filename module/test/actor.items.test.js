import { createTestActor, addCompendiumItemToActor } from "./test.lib.js";

export const registerActorItemTests = (quench) => {
  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.items",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      /** @type {ActorPF} */
      let actor;
      before(async () => {
        actor = await createTestActor();
      });

      // ---------------------------------- //
      // Race                               //
      // ---------------------------------- //
      describe("add race", function () {
        it("add Human", async function () {
          await addCompendiumItemToActor(actor, "pf1.races", "Human");
        });
        it("replace with Elf", async function () {
          await addCompendiumItemToActor(actor, "pf1.races", "Elf");
        });
        it("has only 1 race", function () {
          const races = actor.items.filter((o) => o.type === "race");
          expect(races.length).to.equal(1);
        });

        describe("has Elf stats", function () {
          it("has 12 Dex", function () {
            console.log(actor.data.data.abilities.dex.total);
            expect(actor.data.data.abilities.dex.total).to.equal(12);
          });
          it("has 12 Int", function () {
            expect(actor.data.data.abilities.int.total).to.equal(12);
          });
          it("has 8 Con", function () {
            expect(actor.data.data.abilities.con.total).to.equal(8);
          });
        });
      });

      // ---------------------------------- //
      // Class                              //
      // ---------------------------------- //
      describe("add class", function () {
        let cls;
        describe("add Fighter", async function () {
          before(async () => {
            cls = await addCompendiumItemToActor(actor, "pf1.classes", "Fighter");
          });

          it("has 1 BAB", function () {
            expect(actor.data.data.attributes.bab.total).to.equal(1);
          });

          describe("has appropriate saving throws", function () {
            /**
             * Combined with the Elf stats from above (-2 Con, +2 Dex),
             * Fort should be 1, Reflex should be 1 and Will should be 0
             */
            it("has appropriate Fortitude", function () {
              expect(actor.data.data.attributes.savingThrows.fort.total).to.equal(1);
            });
            it("has appropriate Reflex", function () {
              expect(actor.data.data.attributes.savingThrows.ref.total).to.equal(1);
            });
            it("has appropriate Will", function () {
              expect(actor.data.data.attributes.savingThrows.will.total).to.equal(0);
            });
          });

          describe("has appropriate hit points", function () {
            const previousHealthConfig = game.settings.get("pf1", "healthConfig");
            before(async () => {
              // Set HP to automatic calculation
              await game.settings.set(
                "pf1",
                "healthConfig",
                mergeObject(
                  previousHealthConfig,
                  {
                    continuity: "continuous",
                    rounding: "up",
                    hitdice: {
                      PC: { auto: true, rate: 0.5, maximized: 1 },
                    },
                  },
                  { inplace: false }
                )
              );
            });
            after(async () => {
              await game.settings.set("pf1", "healthConfig", previousHealthConfig);
            });
            /**
             * Combined with the Elf stats from above (-2 Con),
             * HP should be 9
             */
            it("should be 9", function () {
              expect(actor.data.data.attributes.hp.max).to.equal(9);
            });
          });
        });
      });
    },
    { displayName: "PF1: Actor Item Tests" }
  );
};
