export function registerWoundThresholdsTests() {
  quench.registerBatch(
    "pf1.actor.woundThresholds",
    (context) => {
      const { describe, it, expect, before, after, assert } = context;

      // Critical condition modifier
      const critMod = -3;

      let hpCfgOrig;

      /** @type {pf1.documents.actor.ActorPF} */
      let actor;

      // Restore altered settings
      after(async function () {
        if (hpCfgOrig) await game.settings.set("pf1", "healthConfig", hpCfgOrig);
      });

      before(async function () {
        // Backup & Adjust settings
        const h = game.settings.get("pf1", "healthConfig");
        hpCfgOrig = h.toObject();
        if (h.variants.pc.useWoundThresholds !== 1) {
          const cfg = h.toObject();
          cfg.variants.pc.useWoundsAndVigor = false;
          cfg.variants.pc.useWoundThresholds = 1;
          await game.settings.set("pf1", "healthConfig", cfg);
        }

        // Create actor
        const cpack = game.packs.get("pf1.classes");
        const cwiz = (await fromUuid(cpack.index.find((e) => e.name === "Wizard").uuid)).toObject();
        cwiz.system.level = 5;
        cwiz.system.hp = cwiz.system.hd * 5;

        actor = new Actor.implementation({
          type: "character",
          name: "test actor",
          items: [cwiz],
          system: {
            abilities: {
              int: {
                value: 16,
              },
              dex: {
                value: 14,
              },
            },
            skills: {
              spl: {
                rank: 5,
              },
            },
          },
        });

        // Add spellbook
        const bookData = { ...cwiz.system.casting, class: cwiz.system.tag };
        actor.updateSource(await actor.createSpellbook(bookData, { commit: false }));
        actor.reset();
      });

      // Check that settings were correctly changed
      it("Rule configuration", function () {
        const h = game.settings.get("pf1", "healthConfig");

        expect(h.variants.pc.useWoundsAndVigor, "Wounds & Vigor is disabled").to.be.false;
        expect(h.variants.pc.useWoundThresholds, "Wound Thresholds set to normal").to.equal(1);
      });

      // Make sure actor is correctly initialized
      it("Actor initialization", function () {
        expect(actor.itemTypes.class.length, "One class").to.equal(1);
        expect(actor.system.attributes.hd.total, "HD of 5").to.equal(5);
        expect(actor.system.abilities.int.total, "Int total of 16").to.equal(16);
        expect(actor.system.abilities.int.mod, "Int mod of 3").to.equal(3);
        expect(actor.system.attributes.spells.spellbooks.primary.class, "Primary spellbook is for Wizard").to.equal(
          "wizard"
        );

        console.log(actor);
      });

      // Things affected by WT
      describe("Actor baseline confirmation", function () {
        it("Attack modifier of +2", async function () {
          const atk = await actor.rollAttack({ ability: "str", chatMessage: false, skipDialog: true });
          const roll = atk.attacks[0].chatAttack.attack;
          const mod = roll.total - roll.d20.total; // get modifier
          expect(mod).to.equal(2);
        });
        // +2 dex
        it("Init bonus of +2", function () {
          expect(actor.system.attributes.init.total).to.equal(2);
        });
        // +2 dex
        it("AC of 12", function () {
          expect(actor.system.attributes.ac.normal.total).to.equal(12);
        });
        // 2 bab + 2 dex
        it("CMD of 14", function () {
          expect(actor.system.attributes.cmd.total).to.equal(14);
        });
        // 5 ranks, 3 cs, 3 int
        it("Spellcraft modifier of +11", function () {
          expect(actor.getSkillInfo("spl").mod).to.equal(11);
        });
        it("Int check mod is +0", function () {
          expect(actor.system.abilities.int.checkMod).to.equal(0);
        });
        it("Will save of +4", function () {
          expect(actor.system.attributes.savingThrows.will.total).to.equal(4);
        });
        it("Fortitude save of +1", function () {
          expect(actor.system.attributes.savingThrows.fort.total).to.equal(1);
        });
        // Base +1 + 2 dex
        it("Reflex save of +3", function () {
          expect(actor.system.attributes.savingThrows.ref.total).to.equal(3);
        });
        it("Caster Level of 5", function () {
          expect(actor.system.attributes.spells.spellbooks.primary.cl.total).to.equal(5);
        });
      });

      describe("Critical Condition", function () {
        before(function () {
          // Set health to 1
          actor.updateSource({ "system.attributes.hp.offset": -actor.system.attributes.hp.max + 1 });
          actor.reset();
        });

        // Data that must be true for the following tests to be meaningful
        it("Actor setup", function () {
          expect(actor.system.attributes.hp.value, "Health at 1").to.equal(1);
          expect(actor.system.attributes.hp.max, "<25% health").to.be.greaterThan(actor.system.attributes.hp.value * 4);
        });

        describe("Afflictions", function () {
          it("Attack modifier of +2 down to -1", async function () {
            const atk = await actor.rollAttack({ ability: "str", chatMessage: false, skipDialog: true });
            const roll = atk.attacks[0].chatAttack.attack;
            const mod = roll.total - roll.d20.total; // get modifier
            expect(mod).to.equal(2 + critMod);
          });
          it("Init bonus of +2 down to -1", function () {
            expect(actor.system.attributes.init.total).to.equal(2 + critMod);
          });
          it("AC of 12 down to 9", function () {
            expect(actor.system.attributes.ac.normal.total).to.equal(12 + critMod);
          });
          it("CMD of 14 down to 11", function () {
            expect(actor.system.attributes.cmd.total).to.equal(14 + critMod);
          });
          it("Spellcraft modifier of +11 down to +8", function () {
            expect(actor.getSkillInfo("spl").mod).to.equal(11 + critMod);
          });
          it("Int check mod of +0 down to -3", function () {
            expect(actor.system.abilities.int.checkMod).to.equal(0 + critMod);
          });
          it("Will save of +4 down to +1", function () {
            expect(actor.system.attributes.savingThrows.will.total).to.equal(4 + critMod);
          });
          it("Fortitude save of +1 down to -2", function () {
            expect(actor.system.attributes.savingThrows.fort.total).to.equal(1 + critMod);
          });
          // Base +1 + 2 dex
          it("Reflex save of +3 down to +0", function () {
            expect(actor.system.attributes.savingThrows.ref.total).to.equal(3 + critMod);
          });
          it("Caster Level of 5 down to 2", function () {
            expect(actor.system.attributes.spells.spellbooks.primary.cl.total).to.equal(5 + critMod);
          });
        });
      });
    },
    {
      displayName: "PF1: Actor – Optional – Wound Thresholds",
    }
  );
}
