import { ActorPF } from "../documents/actor/actor-pf.mjs";
import { createTestActor, addCompendiumItemToActor, unitTest_renderActorSheet } from "./actor-utils.mjs";
import { ItemChange } from "@component/change.mjs";

export const registerActorItemAttackTests = () => {
  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.items.attacks",
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
        actor = await createTestActor({ system: { abilities: { str: { value: 18 } } } }, { temporary: false });
        shared.actor = actor;
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
            roll = await items.wLongsword.use({ skipDialog: true });
            rolls = roll.systemRolls.attacks[0];
            messages.push(roll);
          });

          it("should have the correct attack formula", function () {
            expect(rolls.attack.formula).to.equal("1d20 + 4[Strength]");
          });

          it("should have the correct damage formula", function () {
            expect(rolls.damage[0].formula).to.equal("1d8 + 4[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof pf1.documents.ChatMessagePF).to.be.true;
          });
        });

        describe("attack with attack", function () {
          let roll;
          let rolls;
          before(async () => {
            roll = await items.aLongsword.use({ skipDialog: true });
            rolls = roll.systemRolls.attacks[0];
            messages.push(roll);
          });

          it("should have the correct attack formula", function () {
            expect(rolls.attack.formula).to.equal("1d20 + 4[Strength]");
          });

          it("should have the correct damage formula", function () {
            expect(rolls.damage[0].formula).to.equal("1d8 + 4[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof pf1.documents.ChatMessagePF).to.be.true;
          });

          describe("size changes", function () {
            describe("tiny size", function () {
              let roll;
              let rolls;
              let prevSize;
              before(async () => {
                prevSize = actor.system.traits.size;
                await actor.update({ "system.traits.size": "tiny" });
                roll = await items.aLongsword.use({ skipDialog: true });
                rolls = roll.systemRolls.attacks[0];
                messages.push(roll);
              });
              after(async () => {
                await actor.update({ "system.traits.size": prevSize });
              });

              it("should have the correct attack formula", function () {
                expect(rolls.attack.formula).to.equal("1d20 + 2[Size] + 4[Strength]");
              });

              it("should have the correct damage formula", function () {
                expect(rolls.damage[0].formula).to.equal("1d4 + 4[Strength]");
              });
            });

            describe("huge size", function () {
              let roll;
              let rolls;
              let prevSize;
              before(async () => {
                prevSize = actor.system.traits.size;
                await actor.update({ "system.traits.size": "huge" });
                roll = await items.aLongsword.use({ skipDialog: true });
                rolls = roll.systemRolls.attacks[0];
                messages.push(roll);
              });
              after(async () => {
                await actor.update({ "system.traits.size": prevSize });
              });

              it("should have the correct attack formula", function () {
                expect(rolls.attack.formula).to.equal("1d20 +  - 2[Size] + 4[Strength]");
              });

              it("should have the correct damage formula", function () {
                expect(rolls.damage[0].formula).to.equal("3d6 + 4[Strength]");
              });
            });
          });
        });
      });

      describe("masterwork/enhanced longsword", function () {
        const items = {};
        before(async () => {
          items.wLongsword = await addCompendiumItemToActor(actor, "pf1.weapons-and-ammo", "Longsword", {
            "system.masterwork": true,
          });
          items.aLongsword = await actor.createAttackFromWeapon(items.wLongsword);
        });

        const addBuff = () =>
          actor.createEmbeddedDocuments("Item", [
            {
              name: "Buff",
              type: "buff",
              system: {
                active: true,
                changes: [
                  new ItemChange({ formula: "2", subTarget: "attack", modifier: "enh" }).data,
                  new ItemChange({ formula: "2", subTarget: "damage", modifier: "enh" }).data,
                ],
              },
            },
          ]);

        describe("attack with weapon item", async function () {
          let attack;
          before(async () => {
            const roll = await items.wLongsword.use({ skipDialog: true });
            messages.push(roll);
            attack = roll.systemRolls.attacks[0];
          });

          it("should have the correct attack formula", function () {
            expect(attack.attack.formula).to.equal("1d20 + 4[Strength] + 1[Enhancement Bonus]");
          });

          it("should have the correct damage formula", function () {
            expect(attack.damage[0].formula).to.equal("1d8 + 4[Strength]");
          });
        });

        describe("attack with enhanced weapon item", async function () {
          let attack;
          before(async () => {
            await items.wLongsword.update({ "system.enh": 1, "system.masterwork": true });
            const roll = await items.wLongsword.use({ skipDialog: true });
            messages.push(roll);
            attack = roll.systemRolls.attacks[0];
          });

          it("should have the correct attack formula", function () {
            expect(attack.attack.formula).to.equal("1d20 + 4[Strength] + 1[Enhancement Bonus]");
          });
          it("should have the correct damage formula", function () {
            expect(attack.damage[0].formula).to.equal("1d8 + 1[Enhancement Bonus] + 4[Strength]");
          });
        });

        describe("attack with added buff", async function () {
          let buff, attack;
          before(async () => {
            const buffItems = await addBuff();
            buff = buffItems[0];
            const roll = await items.wLongsword.use({ skipDialog: true });
            messages.push(roll);
            attack = roll.systemRolls.attacks[0];
          });
          after(async () => {
            await buff.delete();
          });

          it("should have the correct attack formula", function () {
            expect(attack.attack.formula).to.equal("1d20 + 4[Strength] + 2[Buff]");
          });
          it("should have the correct damage formula", function () {
            expect(attack.damage[0].formula).to.equal("1d8 + 2[Buff] + 4[Strength]");
          });
        });

        describe("attack with attack item", async function () {
          let attack;
          before(async () => {
            const roll = await items.aLongsword.use({ skipDialog: true });
            messages.push(roll);
            attack = roll.systemRolls.attacks[0];
          });

          it("should have the correct attack formula", function () {
            expect(attack.attack.formula).to.equal("1d20 + 4[Strength] + 1[Enhancement Bonus]");
          });

          it("should have the correct damage formula", function () {
            expect(attack.damage[0].formula).to.equal("1d8 + 4[Strength]");
          });
        });

        describe("attack with enhanced attack item", async function () {
          let attack;
          before(async () => {
            await items.aLongsword.update({ "system.enh": 1, "system.masterwork": true });
            const roll = await items.aLongsword.use({ skipDialog: true });
            messages.push(roll);
            attack = roll.systemRolls.attacks[0];
          });

          it("should have the correct attack formula", function () {
            expect(attack.attack.formula).to.equal("1d20 + 4[Strength] + 1[Enhancement Bonus]");
          });
          it("should have the correct damage formula", function () {
            expect(attack.damage[0].formula).to.equal("1d8 + 1[Enhancement Bonus] + 4[Strength]");
          });
        });

        describe("attack with enhanced attack item and buff", async function () {
          let attack, buff;
          before(async () => {
            const buffItems = await addBuff();
            buff = buffItems[0];
            const roll = await items.aLongsword.use({ skipDialog: true });
            messages.push(roll);
            attack = roll.systemRolls.attacks[0];
          });
          after(async () => {
            await buff.delete();
          });

          it("should have the correct attack formula", function () {
            expect(attack.attack.formula).to.equal("1d20 + 4[Strength] + 2[Buff]");
          });
          it("should have the correct damage formula", function () {
            expect(attack.damage[0].formula).to.equal("1d8 + 2[Buff] + 4[Strength]");
          });
        });
      });

      describe("attack with natural attack", function () {
        const items = {};
        before(async () => {
          const rawActionData = pf1.components.ItemAction.defaultData;
          items.bite = (
            await actor.createEmbeddedDocuments("Item", {
              type: "attack",
              name: "Bite",
              system: {
                subType: "natural",
                primaryAttack: true,
                actions: [
                  mergeObject(rawActionData, {
                    name: "Bite",
                    actionType: "mwak",
                    damage: {
                      parts: [
                        ["sizeRoll(1, 6, @size)", { custom: "", values: ["bludgeoning", "piercing", "slashing"] }],
                      ],
                    },
                    ability: {
                      attack: "str",
                      damage: "str",
                      damageMult: 1.5,
                    },
                  }),
                ],
              },
            })
          )[0];
        });

        describe("attack with bite", function () {
          let roll;
          let rolls;
          before(async () => {
            roll = await items.bite.use({ skipDialog: true });
            rolls = roll.systemRolls.attacks[0];
            messages.push(roll);
          });

          it("should have the correct attack formula", function () {
            expect(rolls.attack.formula).to.equal("1d20 + 4[Strength]");
          });

          it("should have the correct damage formula", function () {
            expect(rolls.damage[0].formula).to.equal("1d6 + 6[Strength]");
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof pf1.documents.ChatMessagePF).to.be.true;
          });

          describe("as secondary attack", function () {
            let roll;
            let rolls;
            before(async () => {
              const action = items.bite.firstAction;
              await action.update({ naturalAttack: { primaryAttack: false } });
              roll = await items.bite.use({ skipDialog: true });
              rolls = roll.systemRolls.attacks[0];
              messages.push(roll);
            });

            it("should have the correct attack formula", function () {
              expect(rolls.attack.formula).to.equal("1d20 + 4[Strength] + -5[Secondary Attack]");
            });

            it("should have the correct damage formula", function () {
              expect(rolls.damage[0].formula).to.equal("1d6 + 2[Strength]");
            });
          });
        });

        // ---------------------------------- //
        // Render sheet                       //
        // ---------------------------------- //
        unitTest_renderActorSheet(shared, context);
      });

      describe("composite longbow", function () {
        const items = {};
        let originalError;
        const errorNotifications = [];
        before(async () => {
          originalError = ui.notifications.error;
          ui.notifications.error = (message, options) => {
            errorNotifications.push(message);
            return originalError.call(ui.notifications, message, options);
          };
          items.longbow = await addCompendiumItemToActor(actor, "pf1.weapons-and-ammo", "Composite Longbow");
        });
        after(() => {
          ui.notifications.error = originalError;
        });

        it("should have added an item", function () {
          expect(actor.items.getName("Composite Longbow")).to.be.ok;
        });

        it("should not be able to attack without arrows", async function () {
          expect(await items.longbow.use({ skipDialog: true })).to.be.undefined;
          expect(errorNotifications.pop()).to.be.equal(game.i18n.localize("PF1.AmmoDepleted"));
        });

        describe("attack without ammo usage", function () {
          let roll;
          before(async () => {
            await items.longbow.firstAction.update({ usesAmmo: false });
            roll = await items.longbow.use({ skipDialog: true });
            messages.push(roll);
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof pf1.documents.ChatMessagePF).to.be.true;
          });
          it("should have the correct attack formula", function () {
            expect(roll.systemRolls.attacks[0].attack.formula).to.equal("1d20 + 2[Dexterity]");
          });
          it("should have the correct damage formula", function () {
            expect(roll.systemRolls.attacks[0].damage[0].formula).to.equal("1d8 + 0[Strength]");
          });
        });

        describe("attack with ammo usage and ammo present", function () {
          let roll;
          before(async () => {
            await items.longbow.firstAction.update({ usesAmmo: true });
            items.arrows = await addCompendiumItemToActor(actor, "pf1.weapons-and-ammo", "Arrow");
            await items.longbow.update({ "flags.pf1.defaultAmmo": items.arrows.id });
            await items.arrows.update({ "flags.pf1.abundant": false });
            roll = await items.longbow.use({ skipDialog: true, chatMessage: false });
          });

          it("should be an object", function () {
            expect(roll).to.be.an("object");
          });
          it("should have the correct attack formula", function () {
            expect(roll.chatData["flags.pf1.metadata"].rolls.attacks[0].attack.formula).to.equal("1d20 + 2[Dexterity]");
          });
          it("should have the correct damage formula", function () {
            expect(roll.chatData["flags.pf1.metadata"].rolls.attacks[0].damage[0].formula).to.equal(
              "sizeRoll(1, 8, 4) + min(4,0)[Strength]"
            );
          });
          it("should use ammo", function () {
            expect(items.arrows.system.quantity).to.equal(19);
          });
        });

        describe("attack with higher BAB and ammo present", function () {
          let roll;
          before(async () => {
            items.fighterClass = await addCompendiumItemToActor(actor, "pf1.classes", "Fighter", {
              system: { level: 10 },
            });
            roll = await items.longbow.use({ skipDialog: true });
            messages.push(roll);
          });
          after(async () => {
            await items.fighterClass.delete();
          });

          it("should be a ChatMessage", function () {
            expect(roll instanceof pf1.documents.ChatMessagePF).to.be.true;
          });
          it("should have the correct attack formula", function () {
            expect(roll.systemRolls.attacks[0].attack.formula).to.equal("1d20 + 10[Base Attack Bonus] + 2[Dexterity]");
            // TODO: Add test for iterative attacks
            // TODO: Add test for additional ammo usage
          });
        });
      });
    },
    { displayName: "PF1: Actor Attack Item Tests" }
  );
};

const ROLL_TYPES = {
  ATTACK: "attack",
  DAMAGE: "damage",
};
const getMessageRoll = (message, { type = ROLL_TYPES.ATTACK, attack = 0, index = 0 } = {}) => {
  const roll = message.flags.pf1.metadata.rolls.attacks[attack][type][index];
  return Roll.fromJSON(roll);
};
