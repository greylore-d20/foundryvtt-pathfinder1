import { createTestActor } from "./test.lib.js";

export const registerActorBaseTests = (quench) => {
  // ---------------------------------- //
  // Actor basics                       //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.basic-tests",
    async (context) => {
      const { describe, it, expect, before, after } = context;
      /** @type {ActorPF} */
      let actor;
      before(async () => {
        actor = await createTestActor();
      });

      describe("ActorPF basic rolls", function () {
        // ---------------------------------- //
        // BAB                                //
        // ---------------------------------- //
        describe("#rollBAB", function () {
          /** @type {ChatMessage} */
          let roll;
          before(async () => {
            roll = await actor.rollBAB();
          });

          it("between 1 and 20", function () {
            expect(roll?.roll?.total).to.be.within(1, 20);
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof ChatMessage).to.be.true;
          });
        });

        // ---------------------------------- //
        // CMB                                //
        // ---------------------------------- //
        describe("#rollCMB", function () {
          /** @type {ChatMessage} */
          let roll;
          before(async () => {
            roll = await actor.rollCMB();
          });

          it("between 1 and 20", function () {
            expect(roll?.roll?.total).to.be.within(1, 20);
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof ChatMessage).to.be.true;
          });
        });

        // ---------------------------------- //
        // Attack                             //
        // ---------------------------------- //
        describe("#rollAttack", function () {
          /** @type {ChatMessage} */
          let roll;
          before(async () => {
            roll = await actor.rollAttack();
          });

          it("between 1 and 20", function () {
            expect(roll?.roll?.total).to.be.within(1, 20);
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof ChatMessage).to.be.true;
          });
        });

        // ---------------------------------- //
        // Saving Throws                      //
        // ---------------------------------- //
        describe("#rollSavingThrow", function () {
          describe("Fortitude", function () {
            /** @type {ChatMessage} */
            let roll;
            before(async () => {
              roll = await actor.rollSavingThrow("fort", { skipDialog: true });
            });

            it("between 1 and 20", function () {
              expect(roll?.roll?.total).to.be.within(1, 20);
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessage).to.be.true;
            });
          });

          describe("Reflex", function () {
            /** @type {ChatMessage} */
            let roll;
            before(async () => {
              roll = await actor.rollSavingThrow("ref", { skipDialog: true });
            });

            it("between 1 and 20", function () {
              expect(roll?.roll?.total).to.be.within(1, 20);
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessage).to.be.true;
            });
          });

          describe("Will", function () {
            /** @type {ChatMessage} */
            let roll;
            before(async () => {
              roll = await actor.rollSavingThrow("will", { skipDialog: true });
            });

            it("between 1 and 20", function () {
              expect(roll?.roll?.total).to.be.within(1, 20);
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessage).to.be.true;
            });
          });
        });

        // ---------------------------------- //
        // Initiative                         //
        // ---------------------------------- //
        describe("#rollInitiative", function () {
          /** @type {Combat} */
          let combat;
          /** @type {Combatant} */
          let combatant;
          before(async () => {
            combat = await actor.rollInitiative({ createCombatants: true, skipDialog: true });
            combatant = combat.combatants.find((o) => o.actor.id === actor.id);
          });
          after(async () => {
            await combat.delete();
          });

          it("combat should be a Combat", function () {
            expect(combat instanceof Combat).to.be.true;
          });
          it("combatant should be a Combatant", function () {
            expect(combatant instanceof Combatant).to.be.true;
          });

          it("initiative between 1 and 20", function () {
            expect(combatant.initiative).to.be.within(1, 20);
          });
        });

        // ---------------------------------- //
        // Render sheet                       //
        // ---------------------------------- //
        describe("render sheet", function () {
          let sheet;
          before(() => {
            sheet = actor.sheet;
          });

          it("sheet should be an ActorSheet", function () {
            expect(sheet instanceof ActorSheet).to.be.true;
          });

          it("sheet should render", async function () {
            await sheet.render(true);
          });

          it("sheet should close", async function () {
            await new Promise((resolve) => {
              window.setTimeout(async () => {
                await sheet.close();
                resolve();
              }, 200);
            });
          });
        });
      });
    },
    { displayName: "PF1: Basic Actor Tests" }
  );

  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.conditions",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      /** @type {ActorPF} */
      let actor;
      before(async () => {
        actor = await createTestActor();
      });

      // ---------------------------------- //
      // Shaken                             //
      // ---------------------------------- //
      describe("shaken", function () {
        after(async () => {
          await actor.setCondition("shaken", false);
        });
        it("can enable", async function () {
          await actor.setCondition("shaken", true);
          expect(actor.hasCondition("shaken")).to.be.true;
        });

        describe("lowered saving throws", function () {
          it("lowered Fortitude", function () {
            expect(actor.data.data.attributes.savingThrows.fort.total).to.equal(-2);
          });
          it("lowered Reflex", function () {
            expect(actor.data.data.attributes.savingThrows.ref.total).to.equal(-2);
          });
          it("lowered Will", function () {
            expect(actor.data.data.attributes.savingThrows.will.total).to.equal(-2);
          });
        });

        it("lowered attack", function () {
          expect(actor.data.data.attributes.attack.general).to.equal(-2);
        });

        it("lowered skill checks", function () {
          expect(actor.data.data.skills.acr.mod).to.equal(-2);
          expect(actor.data.data.skills.clm.mod).to.equal(-2);
          expect(actor.data.data.skills.umd.mod).to.equal(-2);
        });

        it("lowered ability checks", function () {
          expect(actor.data.data.abilities.str.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.dex.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.con.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.int.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.wis.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.cha.checkMod).to.equal(-2);
        });
      });

      // ---------------------------------- //
      // Sickened                           //
      // ---------------------------------- //
      describe("sickened", function () {
        after(async () => {
          await actor.setCondition("sickened", false);
        });
        it("can enable", async function () {
          await actor.setCondition("sickened", true);
          expect(actor.hasCondition("sickened")).to.be.true;
        });

        describe("lowered saving throws", function () {
          it("lowered Fortitude", function () {
            expect(actor.data.data.attributes.savingThrows.fort.total).to.equal(-2);
          });
          it("lowered Reflex", function () {
            expect(actor.data.data.attributes.savingThrows.ref.total).to.equal(-2);
          });
          it("lowered Will", function () {
            expect(actor.data.data.attributes.savingThrows.will.total).to.equal(-2);
          });
        });

        it("lowered attack", function () {
          expect(actor.data.data.attributes.attack.general).to.equal(-2);
        });

        it("lowered weapon damage", function () {
          expect(actor.data.data.attributes.damage.weapon).to.equal(-2);
        });

        it("lowered skill checks", function () {
          expect(actor.data.data.skills.acr.mod).to.equal(-2);
          expect(actor.data.data.skills.clm.mod).to.equal(-2);
          expect(actor.data.data.skills.umd.mod).to.equal(-2);
        });

        it("lowered ability checks", function () {
          expect(actor.data.data.abilities.str.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.dex.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.con.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.int.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.wis.checkMod).to.equal(-2);
          expect(actor.data.data.abilities.cha.checkMod).to.equal(-2);
        });
      });
    },
    { displayName: "PF1: Actor Conditions Tests" }
  );
};
