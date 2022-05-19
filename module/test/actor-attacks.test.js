import { ActorPF } from "../actor/entity.js";
import { createTestActor, addCompendiumItemToActor } from "./actor-utils.js";

export const registerActorItemAttackTests = () => {
  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.items.attacks",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      /** @type {ActorPF} */
      let actor;
      const messages = [];
      before(async () => {
        actor = await createTestActor({ data: { abilities: { str: { value: 18 } } } }, { temporary: false });
      });
      after(async () => {
        await actor.delete();
        await CONFIG.ChatMessage.documentClass.deleteDocuments(messages.map((o) => o.id));
      });

      describe("longsword", function () {
        const items = {};
        before(async () => {
          items.wLongsword = await addCompendiumItemToActor(actor, "pf1.weapons-and-ammo", "Longsword");
          items.aLongsword = await actor.createAttackFromWeapon(items.wLongsword);
        });

        it("add longsword", function () {
          expect(actor.itemTypes.weapon).to.be.an("array").with.lengthOf(1);
          expect(actor.itemTypes.weapon.find((o) => o === items.wLongsword).name).to.equal("Longsword");
          expect(actor.itemTypes.attack).to.be.an("array").with.lengthOf(1);
          expect(actor.itemTypes.attack.find((o) => o === items.aLongsword).name).to.equal("Longsword");
        });

        describe("attack with weapon", function () {
          let roll;
          let rolls;
          before(async () => {
            roll = await items.wLongsword.useAttack({ skipDialog: true });
            rolls = roll.data.flags.pf1.metadata.rolls.attacks[0];
            messages.push(roll);
          });

          it("should have the correct attack formula", function () {
            expect(rolls.attack.formula).to.equal("1d20 + 4[Strength]");
          });

          it("should have the correct damage formula", function () {
            expect(rolls.damage[0].roll.formula).to.equal("1d8 + 4[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof game.pf1.chat.ChatMessagePF).to.be.true;
          });
        });

        describe("attack with attack", function () {
          let roll;
          let rolls;
          before(async () => {
            roll = await items.aLongsword.useAttack({ skipDialog: true });
            rolls = roll.data.flags.pf1.metadata.rolls.attacks[0];
            messages.push(roll);
          });

          it("should have the correct attack formula", function () {
            expect(rolls.attack.formula).to.equal("1d20 + 4[Strength]");
          });

          it("should have the correct damage formula", function () {
            expect(rolls.damage[0].roll.formula).to.equal("1d8 + 4[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof game.pf1.chat.ChatMessagePF).to.be.true;
          });

          describe("size changes", function () {
            describe("tiny size", function () {
              let roll;
              let rolls;
              let prevSize;
              before(async () => {
                prevSize = actor.data.data.traits.size;
                await actor.update({ "data.traits.size": "tiny" });
                roll = await items.aLongsword.useAttack({ skipDialog: true });
                rolls = roll.data.flags.pf1.metadata.rolls.attacks[0];
                messages.push(roll);
              });
              after(async () => {
                await actor.update({ "data.traits.size": prevSize });
              });

              it("should have the correct attack formula", function () {
                expect(rolls.attack.formula).to.equal("1d20 + 2[Size] + 4[Strength]");
              });

              it("should have the correct damage formula", function () {
                expect(rolls.damage[0].roll.formula).to.equal("1d4 + 4[Strength]");
              });
            });

            describe("huge size", function () {
              let roll;
              let rolls;
              let prevSize;
              before(async () => {
                prevSize = actor.data.data.traits.size;
                await actor.update({ "data.traits.size": "huge" });
                roll = await items.aLongsword.useAttack({ skipDialog: true });
                rolls = roll.data.flags.pf1.metadata.rolls.attacks[0];
                messages.push(roll);
              });
              after(async () => {
                await actor.update({ "data.traits.size": prevSize });
              });

              it("should have the correct attack formula", function () {
                expect(rolls.attack.formula).to.equal("1d20 +  - 2[Size] + 4[Strength]");
              });

              it("should have the correct damage formula", function () {
                expect(rolls.damage[0].roll.formula).to.equal("3d6 + 4[Strength]");
              });
            });
          });
        });
      });

      describe("attack with natural attack", function () {
        const items = {};
        before(async () => {
          items.bite = (
            await actor.createEmbeddedDocuments("Item", {
              type: "attack",
              name: "Bite",
              data: {
                actionType: "mwak",
                damage: {
                  parts: [["sizeRoll(1, 6, @size)", "B/P/S"]],
                },
                ability: {
                  attack: "str",
                  damage: "str",
                  damageMult: 1.5,
                },
                attackType: "natural",
                primaryAttack: true,
              },
            })
          )[0];
        });

        describe("attack with bite", function () {
          let roll;
          let rolls;
          before(async () => {
            roll = await items.bite.useAttack({ skipDialog: true });
            rolls = roll.data.flags.pf1.metadata.rolls.attacks[0];
            messages.push(roll);
          });

          it("should have the correct attack formula", function () {
            expect(rolls.attack.formula).to.equal("1d20 + 4[Strength]");
          });

          it("should have the correct damage formula", function () {
            expect(rolls.damage[0].roll.formula).to.equal("1d6 + 6[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof game.pf1.chat.ChatMessagePF).to.be.true;
          });

          describe("as secondary attack", function () {
            let roll;
            let rolls;
            before(async () => {
              await items.bite.update({ data: { primaryAttack: false } });
              roll = await items.bite.useAttack({ skipDialog: true });
              rolls = roll.data.flags.pf1.metadata.rolls.attacks[0];
              messages.push(roll);
            });

            it("should have the correct attack formula", function () {
              expect(rolls.attack.formula).to.equal("1d20 + 4[Strength] +  - 5[Secondary Attack]");
            });

            it("should have the correct damage formula", function () {
              expect(rolls.damage[0].roll.formula).to.equal("1d6 + 2[Strength]");
            });
          });
        });
      });
    },
    { displayName: "PF1: Actor Attack Item Tests" }
  );
};
