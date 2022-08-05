import { ActorPF } from "../documents/actor/actor-pf.mjs";
import { ChatMessagePF } from "../documents/chat-message.mjs";
import { addCompendiumItemToActor, createTestActor, unitTest_renderActorSheet } from "./actor-utils.mjs";

export const registerActorBasicTests = () => {
  // ---------------------------------- //
  // Actor basics                       //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.basic-tests",
    async (context) => {
      const { describe, it, expect, before, after } = context;
      /**
       * Handles a shared context to pass between functions
       *
       * @type {object}
       */
      const shared = {};
      /** @type {ActorPF} */
      let actor;
      const messages = [];
      before(async () => {
        // Requires actor to NOT be temporary for initiative rolls
        actor = await createTestActor({}, { temporary: false });
        shared.actor = actor;
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
            expect(roll instanceof pf1.chat.ChatMessagePF).to.be.true;
          });

          it("should have the correct subject", function () {
            expect(roll?.flags.pf1?.subject?.core === "bab");
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
            expect(roll instanceof pf1.chat.ChatMessagePF).to.be.true;
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

          it("should have the correct formula", function () {
            expect(roll?.roll?.formula).to.equal("1d20 + 1[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof pf1.chat.ChatMessagePF).to.be.true;
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
              expect(roll instanceof pf1.chat.ChatMessagePF).to.be.true;
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
              expect(roll instanceof pf1.chat.ChatMessagePF).to.be.true;
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
              expect(roll instanceof pf1.chat.ChatMessagePF).to.be.true;
            });
          });
        });

        // ---------------------------------- //
        // Skills                             //
        // ---------------------------------- //
        describe("#rollSkill with defaults", function () {
          describe("for a regular skill", function () {
            /** @type {ChatMessage} */
            let roll;
            before(async () => {
              roll = await actor.rollSkill("per", { skipDialog: true });
              messages.push(roll);
            });

            it("should have the correct formula", function () {
              expect(roll.roll.formula).to.equal("1d20 + 2[Wisdom]");
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessagePF).to.be.true;
            });

            it("should have the correct subject", function () {
              expect(roll?.flags.pf1?.subject?.skill).to.equal("per");
            });
          });

          describe("for a subSkill", function () {
            /** @type {ChatMessagePF} */
            let roll;
            before(async () => {
              await actor.update({ "system.skills.crf.subSkills": { crf1: { name: "foo", ability: "int", rank: 1 } } });
              roll = await actor.rollSkill("crf.subSkills.crf1", { skipDialog: true });
              messages.push(roll);
            });

            it("should have the correct formula", function () {
              expect(roll.roll.formula).to.equal("1d20 + 1[Intelligence] + 1[Skill Ranks]");
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessagePF).to.be.true;
            });

            it("should have the correct subject", function () {
              expect(roll?.flags.pf1?.subject?.skill).to.equal("crf.subSkills.crf1");
            });
          });

          describe("with ACP and ranks and class skill", function () {
            /** @type {ChatMessagePF} */
            let roll;
            /** @type {Item} */
            const items = [];
            before(async () => {
              items.push(await addCompendiumItemToActor(actor, "pf1.armors-and-shields", "Full Plate"));
              items.push(await addCompendiumItemToActor(actor, "pf1.classes", "Warpriest"));
              await actor.update({ "system.skills.clm.rank": 3 });
              roll = await actor.rollSkill("clm", { skipDialog: true });
              messages.push(roll);
            });
            after(async () => {
              await actor.deleteEmbeddedDocuments(
                "Item",
                items.map((i) => i.id)
              );
              await actor.update({ "system.skills.clm.rank": 0 });
            });

            it("should have the correct formula", function () {
              expect(roll.roll.formula).to.equal(
                "1d20 + 1[Strength] + 3[Skill Ranks] + 3[Class Skill] +  - 6[Armor Check Penalty]"
              );
            });

            it("should be a ChatMessage", function () {
              expect(roll instanceof ChatMessagePF).to.be.true;
            });

            it("should have the correct subject", function () {
              expect(roll?.flags.pf1?.subject?.skill).to.equal("clm");
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
          /** @type {ChatMessage} */
          let roll;
          before(async () => {
            combat = await Combat.create({});
            await combat.activate();
            const combatResult = await actor.rollInitiative({ createCombatants: true, skipDialog: true });
            messages.push(...combatResult.messages);
            roll = combatResult.messages[0];
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

          it("should have the correct formula", function () {
            expect(roll.roll.formula).to.equal("1d20 + 2[Initiative] + 0.02[Tiebreaker]");
          });
        });

        // ---------------------------------- //
        // Render sheet                       //
        // ---------------------------------- //
        unitTest_renderActorSheet(shared, context);
      });
    },
    { displayName: "PF1: Basic Actor Tests" }
  );
};
