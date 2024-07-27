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
        actor = await createTestActor({});
        shared.actor = actor;
      });
      after(async () => {
        await actor.delete();

        // Clean messages
        ChatMessage.implementation.deleteDocuments(messages.map((o) => o.id));
      });

      describe("ActorPF basic rolls", function () {
        // ---------------------------------- //
        // BAB                                //
        // ---------------------------------- //
        describe("#rollBAB with defaults", function () {
          /** @type {ChatMessagePF} */
          let msg;
          before(async () => {
            msg = await actor.rollBAB({ skipDialog: true });
            messages.push(msg);
          });

          it("should have the correct formula", function () {
            expect(msg?.rolls[0]?.formula).to.equal("1d20 + 0[BAB]");
          });

          it("should produce a ChatMessage", function () {
            expect(msg).to.be.instanceOf(pf1.documents.ChatMessagePF);
          });

          it("should have the correct subject", function () {
            expect(msg?.flags.pf1?.subject?.core === "bab");
          });
        });

        // ---------------------------------- //
        // Attack                             //
        // ---------------------------------- //
        describe("#rollAttack", function () {
          // ---------------------------------- //
          // Weapon                             //
          // ---------------------------------- //
          describe("with defaults (weapon)", function () {
            /** @type {ChatMessage} */
            let msg;
            before(async () => {
              msg = await actor.rollAttack({ skipDialog: true });
              messages.push(msg);
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(pf1.documents.ChatMessagePF);
            });

            it("should have the correct formula", function () {
              const metadata = msg.getFlag("pf1", "metadata");
              const roll = metadata.rolls.attacks[0].attack;
              expect(roll.formula).to.equal("1d20 + 1[Strength]");
            });
          });

          // ---------------------------------- //
          // CMB                                //
          // ---------------------------------- //
          describe("as CMB", function () {
            /** @type {ChatMessage} */
            let msg;
            before(async () => {
              msg = await actor.rollAttack({ maneuver: true, skipDialog: true });
              messages.push(msg);
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(pf1.documents.ChatMessagePF);
            });

            it("should have the correct formula", function () {
              const metadata = msg.getFlag("pf1", "metadata");
              const roll = metadata.rolls.attacks[0].attack;
              expect(roll.formula).to.equal("1d20 + 1[Strength]");
            });
          });
        });

        // ---------------------------------- //
        // Saving Throws                      //
        // ---------------------------------- //
        describe("#rollSavingThrow", function () {
          describe("Fortitude", function () {
            /** @type {ChatMessage} */
            let msg;
            before(async () => {
              msg = await actor.rollSavingThrow("fort", { skipDialog: true });
              messages.push(msg);
            });

            it("should have the correct formula", function () {
              expect(msg?.rolls[0]?.formula).to.equal("1d20 + 3[Constitution]");
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(pf1.documents.ChatMessagePF);
            });
          });

          describe("Reflex", function () {
            /** @type {ChatMessage} */
            let msg;
            before(async () => {
              msg = await actor.rollSavingThrow("ref", { skipDialog: true });
              messages.push(msg);
            });

            it("should have the correct formula", function () {
              expect(msg?.rolls[0]?.formula).to.equal("1d20 + 2[Dexterity]");
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(pf1.documents.ChatMessagePF);
            });
          });

          describe("Will", function () {
            /** @type {ChatMessage} */
            let msg;
            before(async () => {
              msg = await actor.rollSavingThrow("will", { skipDialog: true });
              messages.push(msg);
            });

            it("should have the correct formula", function () {
              expect(msg?.rolls[0]?.formula).to.equal("1d20 + 2[Wisdom]");
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(pf1.documents.ChatMessagePF);
            });
          });
        });

        // ---------------------------------- //
        // Skills                             //
        // ---------------------------------- //
        describe("#rollSkill with defaults", function () {
          describe("for a regular skill", function () {
            /** @type {ChatMessage} */
            let msg;
            before(async () => {
              msg = await actor.rollSkill("per", { skipDialog: true });
              messages.push(msg);
            });

            it("should have the correct formula", function () {
              expect(msg.rolls[0].formula).to.equal("1d20 + 2[Wisdom]");
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(ChatMessagePF);
            });

            it("should have the correct subject", function () {
              expect(msg?.flags.pf1?.subject?.skill).to.equal("per");
            });
          });

          describe("for a subSkill", function () {
            /** @type {ChatMessagePF} */
            let msg;
            before(async () => {
              await actor.update({ "system.skills.crf.subSkills": { crf1: { name: "foo", ability: "int", rank: 1 } } });
              msg = await actor.rollSkill("crf.subSkills.crf1", { skipDialog: true });
              messages.push(msg);
            });

            it("should have the correct formula", function () {
              expect(msg.rolls[0].formula).to.equal("1d20 + 1[Intelligence] + 1[Skill Ranks]");
            });

            it("should be a ChatMessage", function () {
              expect(msg).to.be.instanceOf(ChatMessagePF);
            });

            it("should have the correct subject", function () {
              expect(msg?.flags.pf1?.subject?.skill).to.equal("crf.subSkills.crf1");
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
              expect(roll.rolls[0].formula).to.equal(
                "1d20 + 1[Strength] + 3[Skill Ranks] + 3[Class Skill] +  - 6[Armor Check Penalty]"
              );
            });

            it("should be a ChatMessage", function () {
              expect(roll).to.be.instanceOf(ChatMessagePF);
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
            await actor.rollInitiative({ createCombatants: true, skipDialog: true });
            const latestMessage = game.messages.contents.pop();
            if (latestMessage.flags.pf1.subject.core === "init") messages.push(latestMessage);
            roll = latestMessage;
            combatant = combat.combatants.find((o) => o.actor.id === actor.id);
          });
          after(async () => {
            await combat.delete();
          });

          it("combat should be a Combat", function () {
            expect(combat).to.be.instanceOf(Combat);
          });
          it("combatant should be a Combatant", function () {
            expect(combatant).to.be.instanceOf(Combatant);
          });

          it("should have the correct formula", function () {
            expect(roll.rolls[0].formula).to.equal("1d20 + 2[Initiative] + 0.02[Tiebreaker]");
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
