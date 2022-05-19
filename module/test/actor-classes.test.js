import { createTestActor, addCompendiumItemToActor } from "./actor-utils.js";

export const registerActorItemClassTests = () => {
  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.items.class",
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
          after(async () => {
            for (const c of Object.values(cls)) {
              await c.delete();
            }
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

        // ---------------------------------- //
        // Wizard/Fighter/Hunter              //
        // ---------------------------------- //
        describe("add Wizard/Fighter/Hunter", function () {
          const cls = {};
          before(async () => {
            cls.fighter = await addCompendiumItemToActor(actor, "pf1.classes", "Fighter", { data: { level: 2 } });
            cls.wizard = await addCompendiumItemToActor(actor, "pf1.classes", "Wizard", { data: { level: 5 } });
            cls.hunter = await addCompendiumItemToActor(actor, "pf1.classes", "Hunter", { data: { level: 9 } });
          });
          after(async () => {
            for (const c of Object.values(cls)) {
              await c.delete();
            }
          });

          it("add classes", function () {
            expect(actor.itemTypes.class).to.be.an("array").with.lengthOf(3);
            expect(actor.itemTypes.class.find((o) => o === cls.fighter).name).to.equal("Fighter");
            expect(actor.itemTypes.class.find((o) => o === cls.wizard).name).to.equal("Wizard");
            expect(actor.itemTypes.class.find((o) => o === cls.hunter).name).to.equal("Hunter");
            expect(cls.fighter.data.data.level).to.equal(2);
            expect(cls.wizard.data.data.level).to.equal(5);
            expect(cls.hunter.data.data.level).to.equal(9);
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
             * HP should be 122
             */
            it("should be 122", function () {
              expect(actor.data.data.attributes.hp.max).to.equal(122);
            });
          });

          describe("has appropriate BAB", function () {
            describe("under regular rules", function () {
              const prevSetting = game.settings.get("pf1", "useFractionalBaseBonuses");
              before(async () => {
                if (prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", false);
              });
              after(async () => {
                if (prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", true);
              });

              it("has appropriate BAB", function () {
                expect(actor.data.data.attributes.bab.total).to.equal(10);
              });
            });

            describe("under Fractional Base Bonuses", function () {
              const prevSetting = game.settings.get("pf1", "useFractionalBaseBonuses");
              before(async () => {
                if (!prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", true);
              });
              after(async () => {
                if (!prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", false);
              });

              it("has appropriate BAB", function () {
                expect(actor.data.data.attributes.bab.total).to.equal(11);
              });
            });
          });

          describe("has appropriate saving throws", function () {
            describe("under regular rules", function () {
              const prevSetting = game.settings.get("pf1", "useFractionalBaseBonuses");
              before(async () => {
                if (prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", false);
              });
              after(async () => {
                if (prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", true);
              });

              it("has appropriate Fortitude", function () {
                expect(actor.data.data.attributes.savingThrows.fort.total).to.equal(13);
              });
              it("has appropriate Reflex", function () {
                expect(actor.data.data.attributes.savingThrows.ref.total).to.equal(9);
              });
              it("has appropriate Will", function () {
                expect(actor.data.data.attributes.savingThrows.will.total).to.equal(9);
              });
            });

            describe("under Fractional Base Bonuses", function () {
              const prevSetting = game.settings.get("pf1", "useFractionalBaseBonuses");
              before(async () => {
                if (!prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", true);
              });
              after(async () => {
                if (!prevSetting) await game.settings.set("pf1", "useFractionalBaseBonuses", false);
              });

              it("has appropriate Fortitude", function () {
                expect(actor.data.data.attributes.savingThrows.fort.total).to.equal(12);
              });
              it("has appropriate Reflex", function () {
                expect(actor.data.data.attributes.savingThrows.ref.total).to.equal(10);
              });
              it("has appropriate Will", function () {
                expect(actor.data.data.attributes.savingThrows.will.total).to.equal(10);
              });
            });
          });
        });
      });
    },
    { displayName: "PF1: Actor Class Item Tests" }
  );
};
