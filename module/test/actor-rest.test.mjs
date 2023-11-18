import { ActorPF } from "../documents/actor/actor-pf.mjs";
import { createTestActor, addCompendiumItemToActor } from "./actor-utils.mjs";

export const registerActorRestTests = () => {
  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.util.rest",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      /** @type {ActorPF} */
      let actor;

      const hd = 10;
      const hp = 100;
      const conBonus = 2 * hd;

      before(async () => {
        actor = await createTestActor({ system: { abilities: { con: { value: 14 } } } }, { temporary: false });
      });
      after(async () => {
        await actor.delete();
      });

      describe("rest", function () {
        const items = {};
        before(async () => {
          items.wLongsword = await addCompendiumItemToActor(actor, "pf1.weapons-and-ammo", "Longsword");
          items.aLongsword = await actor.createAttackFromWeapon(items.wLongsword);
          items.sFireball = await addCompendiumItemToActor(actor, "pf1.spells", "Fireball", {
            system: { spellbook: "primary" },
          });
          items.sShield = await addCompendiumItemToActor(actor, "pf1.spells", "Shield", {
            system: { spellbook: "primary" },
          });
          items.fBurn = await addCompendiumItemToActor(actor, "pf1.class-abilities", "Burn");
          items.fFleet = await addCompendiumItemToActor(actor, "pf1.feats", "Fleet");
          items.fWarrior = await addCompendiumItemToActor(actor, "pf1.classes", "Warrior");
        });

        describe("setup and test actor", function () {
          before(async () => {
            await items.fWarrior.update({
              system: {
                level: hd,
                hp,
              },
            });

            await actor.createSpellbook({ class: "warrior" });
          });

          describe("maximum health", function () {
            const maxHP = hp + conBonus;
            it(`should have ${maxHP} hp`, function () {
              expect(actor.system.attributes.hp.value).to.equal(maxHP);
            });
          });

          // TODO: Consume spell slots, add burn, etc.
          describe("reduce resources", function () {
            const damage = Math.floor(hp / 2);
            describe(`reduce health by ${damage}`, function () {
              before(async () => {
                await actor.applyDamage(damage, { forceDialog: false });
              });

              it("should have 50 hit points missing", function () {
                expect(actor.system.attributes.hp.value).to.equal(hp + conBonus - damage);
              });
            });
          });
        });

        describe("perform rest", function () {
          let oldHP;
          before(async () => {
            oldHP = actor.system.attributes.hp.value;
            await actor.performRest();
          });

          it("should have restored HD worth of hit points", function () {
            expect(actor.system.attributes.hp.value).to.equal(oldHP + hd);
          });
        });
      });
    },
    { displayName: "PF1: Actor Rest Test" }
  );
};