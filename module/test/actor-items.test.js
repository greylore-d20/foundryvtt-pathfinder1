import { ActorPF } from "../actor/entity.js";
import { ItemClassPF } from "../item/types/class.js";
import { createTestActor, addCompendiumItemToActor } from "./actor-utils.js";

/**
 * @param {import("@ethaks/fvtt-quench").Quench} quench - The singleton Quench instance
 */
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
        actor = await createTestActor({}, { temporary: false });
      });
      after(async () => {
        await actor.delete();
      });

      // ---------------------------------- //
      // Race                               //
      // ---------------------------------- //
      describe("add race", function () {
        let race;
        before(async () => {
          race = await addCompendiumItemToActor(actor, "pf1.races", "Human");
        });
        after(async () => {
          await actor.race.delete();
        });

        it("add Human", function () {
          const race = actor.itemTypes.race[0];
          expect(race.name).to.equal("Human");
        });

        it("replace with Elf", async function () {
          await addCompendiumItemToActor(actor, "pf1.races", "Elf");
          expect(actor.itemTypes.race).to.be.an("array").with.lengthOf(1);
          expect(actor.itemTypes.race[0].name).to.equal("Elf");
        });

        describe("has Elf stats", function () {
          it("has appropriate Dex", function () {
            expect(actor.data.data.abilities.dex.total).to.equal(16);
          });
          it("has appropriate Int", function () {
            expect(actor.data.data.abilities.int.total).to.equal(15);
          });
          it("has appropriate Con", function () {
            expect(actor.data.data.abilities.con.total).to.equal(14);
          });
        });
      });

      // ---------------------------------- //
      // Class                              //
      // ---------------------------------- //
      describe("add classes", function () {
        // ---------------------------------- //
        // Fighter                            //
        // ---------------------------------- //
        describe("add Fighter", async function () {
          const cls = {};
          before(async () => {
            cls.fighter = await addCompendiumItemToActor(actor, "pf1.classes", "Fighter");
          });

          it("add Fighter", function () {
            expect(actor.itemTypes.class).to.be.an("array").with.lengthOf(1);
            expect(actor.itemTypes.class.find((o) => o === cls.fighter).name).to.equal("Fighter");
          });

          it("has 1 BAB", function () {
            expect(actor.data.data.attributes.bab.total).to.equal(1);
          });

          describe("has appropriate saving throws", function () {
            /**
             * Fort should be 5, Reflex should be 2 and Will should be 2
             */
            it("has appropriate Fortitude", function () {
              expect(actor.data.data.attributes.savingThrows.fort.total).to.equal(5);
            });
            it("has appropriate Reflex", function () {
              expect(actor.data.data.attributes.savingThrows.ref.total).to.equal(2);
            });
            it("has appropriate Will", function () {
              expect(actor.data.data.attributes.savingThrows.will.total).to.equal(2);
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
             * Combined with base Con (16),
             * HP should be 13
             */
            it("should be 13", function () {
              expect(actor.data.data.attributes.hp.max).to.equal(13);
            });
          });
        });
      });
    },
    { displayName: "PF1: Actor Item Tests" }
  );
};
