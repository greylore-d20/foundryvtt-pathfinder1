import { ActorPF } from "../documents/actor/actor-pf.mjs";
import { createTestActor } from "./actor-utils.mjs";

export const registerActorConditionsTests = () => {
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
        actor = await createTestActor({}, { temporary: false });
      });

      after(async () => {
        await actor.delete();
      });

      const shakenCondition = { name: "Shaken", value: -2, type: "untyped" };

      // ---------------------------------- //
      // Shaken                             //
      // ---------------------------------- //
      describe("Shaken condition", function () {
        before(async () => {
          await actor.setCondition("shaken", true);
        });
        after(async () => {
          await actor.setCondition("shaken", false);
        });

        it("can enable", async function () {
          expect(actor.hasCondition("shaken")).to.be.true;
        });

        describe("lowered saving throws", function () {
          it("lowered Fortitude", function () {
            expect(actor.system.attributes.savingThrows.fort.total).to.equal(1);
            expect(actor.sourceDetails["system.attributes.savingThrows.fort.total"])
              .to.be.an("array")
              .that.deep.includes(shakenCondition);
          });

          it("lowered Reflex", function () {
            expect(actor.system.attributes.savingThrows.ref.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.ref.total"])
              .to.be.an("array")
              .that.deep.includes(shakenCondition);
          });

          it("lowered Will", function () {
            expect(actor.system.attributes.savingThrows.will.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.will.total"])
              .to.be.an("array")
              .that.deep.includes(shakenCondition);
          });
        });

        it("lowered attack", function () {
          expect(actor.system.attributes.attack.general).to.equal(-2);
          expect(actor.sourceDetails["system.attributes.attack.general"])
            .to.be.an("array")
            .that.deep.includes(shakenCondition);
        });

        it("lowered skill checks", function () {
          for (const [skill, value] of [
            ["acr", 0],
            ["clm", -1],
            ["umd", 1],
          ]) {
            expect(actor.system.skills[skill].mod).to.equal(value);
            expect(actor.sourceDetails[`system.skills.${skill}.mod`])
              .to.be.an("array")
              .that.deep.includes(shakenCondition);
          }
        });

        it("lowered ability checks", function () {
          for (const ability of Object.keys(pf1.config.abilities)) {
            expect(actor.system.abilities[ability].checkMod).to.equal(-2);
            expect(actor.sourceDetails[`system.abilities.${ability}.checkMod`])
              .to.be.an("array")
              .that.deep.includes(shakenCondition);
          }
        });
      });

      // ---------------------------------- //
      // Sickened                           //
      // ---------------------------------- //
      describe("sickened", function () {
        before(async () => {
          await actor.setCondition("sickened", true);
        });
        after(async () => {
          await actor.setCondition("sickened", false);
        });

        const sickenedCondition = { name: "Sickened", value: -2, type: "untyped" };

        it("can be enabled", async function () {
          expect(actor.hasCondition("sickened")).to.be.true;
        });

        describe("lowered saving throws", function () {
          it("lowered Fortitude", function () {
            expect(actor.system.attributes.savingThrows.fort.total).to.equal(1);
            expect(actor.sourceDetails["system.attributes.savingThrows.fort.total"])
              .to.be.an("array")
              .that.deep.includes(sickenedCondition);
          });

          it("lowered Reflex", function () {
            expect(actor.system.attributes.savingThrows.ref.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.ref.total"])
              .to.be.an("array")
              .that.deep.includes(sickenedCondition);
          });

          it("lowered Will", function () {
            expect(actor.system.attributes.savingThrows.will.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.will.total"])
              .to.be.an("array")
              .that.deep.includes(sickenedCondition);
          });
        });

        it("lowered attack", function () {
          expect(actor.system.attributes.attack.general).to.equal(-2);
          expect(actor.sourceDetails["system.attributes.attack.general"])
            .to.be.an("array")
            .that.deep.includes(sickenedCondition);
        });

        it("lowered weapon damage", function () {
          expect(actor.system.attributes.damage.weapon).to.equal(-2);
          expect(actor.sourceDetails["system.attributes.damage.weapon"])
            .to.be.an("array")
            .that.deep.includes(sickenedCondition);
        });

        it("lowered skill checks", function () {
          for (const [skill, value] of [
            ["acr", 0],
            ["clm", -1],
            ["umd", 1],
          ]) {
            expect(actor.system.skills[skill].mod).to.equal(value);
            expect(actor.sourceDetails[`system.skills.${skill}.mod`])
              .to.be.an("array")
              .that.deep.includes(sickenedCondition);
          }
        });

        it("lowered ability checks", function () {
          for (const ability of Object.keys(pf1.config.abilities)) {
            expect(actor.system.abilities[ability].checkMod).to.equal(-2);
            expect(actor.sourceDetails[`system.abilities.${ability}.checkMod`])
              .to.be.an("array")
              .that.deep.includes(sickenedCondition);
          }
        });
      });

      // ---------------------------------- //
      // Blind                              //
      // ---------------------------------- //
      describe("blind", function () {
        before(async () => {
          await actor.setCondition("blind", true);
        });
        after(async () => {
          await actor.setCondition("blind", false);
        });

        it("lowered AC by 2", async function () {
          const previousDex = actor.toObject().system.abilities.dex.value;
          await actor.update({ "system.abilities.dex.value": 10 });
          expect(actor.system.attributes.ac.normal.total).to.equal(8);
          await actor.update({ "system.abilities.dex.value": previousDex });
        });

        it("lost Dexterity to AC", function () {
          // Blindness also lowers AC by 2, in addition negating Dex bonus to AC, so this should be 8
          expect(actor.system.attributes.ac.normal.total).to.equal(8);
        });

        it("still gains Dexterity penalties to AC", async function () {
          const previousDex = actor.toObject().system.abilities.dex.value;
          await actor.update({ "system.abilities.dex.value": 6 });
          // Blindness also lowers AC by 2, in addition negating Dex bonus to AC, so this should be 6
          expect(actor.system.attributes.ac.normal.total).to.equal(6);
          await actor.update({ "system.abilities.dex.value": previousDex });
        });
      });

      // ---------------------------------- //
      // Fatigue/Exhaustion                 //
      // ---------------------------------- //
      describe("fatigue/exhaustion", function () {
        before(async () => {
          await actor.setCondition("fatigued", true);
        });
        after(async () => {
          await actor.setConditions({ fatigued: false, exhausted: false });
        });

        it("Str and Dex penalty of -1 for fatigue", function () {
          for (const ability of ["str", "dex"]) {
            const baseModifier = pf1.utils.getAbilityModifier(actor.system.abilities[ability].value);
            expect(actor.system.abilities[ability].mod).to.equal(baseModifier - 1);
            expect(actor.sourceDetails[`system.abilities.${ability}.penalty`]).to.be.an("array").that.deep.includes({
              name: "Fatigued",
              type: "untyped",
              value: -2,
            });
          }
        });

        it("applying exhausted removes fatigue", async function () {
          await actor.setCondition("exhausted", true);
          expect(actor.system.conditions.fatigued).to.be.false;
          expect(actor.system.conditions.exhausted).to.be.true;
        });

        it("Str and Dex penalty of -3 for exhausted", function () {
          for (const ability of ["str", "dex"]) {
            const baseModifier = pf1.utils.getAbilityModifier(actor.system.abilities[ability].value);
            expect(actor.system.abilities[ability].mod).to.equal(baseModifier - 3);
            expect(actor.sourceDetails[`system.abilities.${ability}.penalty`]).to.be.an("array").that.deep.includes({
              name: "Exhausted",
              type: "untyped",
              value: -6,
            });
          }
        });
      });
    },
    { displayName: "PF1: Actor Conditions Tests" }
  );
};
