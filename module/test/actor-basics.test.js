import { ActorPF } from "../actor/entity";
import { ChatMessagePF } from "../sidebar/chat-message";
import { createTestActor } from "./actor-utils";

export const registerActorBasicTests = () => {
  // ---------------------------------- //
  // Actor basics                       //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.basic-tests",
    async (context) => {
      const { describe, it, expect, before, after } = context;
      /** @type {ActorPF} */
      let actor;
      const messages = [];
      before(async () => {
        // Requires actor to NOT be temporary for initiative rolls
        actor = await createTestActor({}, { temporary: false });
      });
      after(async () => {
        await actor.delete();

        // Clean messages
        CONFIG.ChatMessage.documentClass.deleteDocuments(messages.map((o) => o.id));
      });

      describe("ActorPF basic rolls", function () {
        // ---------------------------------- //
        // BAB                                //
        // ---------------------------------- //
        describe("#rollBAB with defaults", function () {
          /** @type {ChatMessagePF} */
          let roll;
          before(async () => {
            roll = await actor.rollBAB();
            messages.push(roll);
          });

          it("should have the correct formula", function () {
            expect(roll?.roll?.formula).to.equal("1d20 + 0[BAB]");
          });

          it("should produce a ChatMessage", function () {
            expect(roll instanceof ChatMessagePF).to.be.true;
          });

          it("should have the correct subject", function () {
            expect(roll?.data.flags.pf1?.subject?.core === "bab");
          });
        });

        // ---------------------------------- //
        // CMB                                //
        // ---------------------------------- //
        describe("#rollCMB with defaults", function () {
          /** @type {ChatMessage} */
          let roll;
          before(async () => {
            roll = await actor.rollCMB();
            messages.push(roll);
          });

          it("should have the correct formula", function () {
            expect(roll?.roll?.formula).to.equal("1d20 + 1[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof ChatMessagePF).to.be.true;
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
            messages.push(roll);
          });

          it("between 1 and 20", function () {
            expect(roll?.roll?.formula).to.equal("1d20 + 1[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof ChatMessagePF).to.be.true;
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
              messages.push(roll);
            });

            it("should have the correct formula", function () {
              expect(roll?.roll?.formula).to.equal("1d20 + 3[Constitution]");
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessagePF).to.be.true;
            });
          });

          describe("Reflex", function () {
            /** @type {ChatMessage} */
            let roll;
            before(async () => {
              roll = await actor.rollSavingThrow("ref", { skipDialog: true });
              messages.push(roll);
            });

            it("should have the correct formula", function () {
              expect(roll?.roll?.formula).to.equal("1d20 + 2[Dexterity]");
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessagePF).to.be.true;
            });
          });

          describe("Will", function () {
            /** @type {ChatMessage} */
            let roll;
            before(async () => {
              roll = await actor.rollSavingThrow("will", { skipDialog: true });
              messages.push(roll);
            });

            it("should have the correct formula", function () {
              expect(roll?.roll?.formula).to.equal("1d20 + 2[Wisdom]");
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessagePF).to.be.true;
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
            const combatResult = await actor.rollInitiative({ createCombatants: true, skipDialog: true });
            combat = combatResult.combat;
            messages.push(...combatResult.messages);
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
};
