import { ActorPF } from "../actor/entity.js";
import { getAbilityModifier } from "../actor/lib.mjs";
import { PF1 } from "../config.js";
import { createTestActor } from "./actor-utils.js";

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
              .that.deep.includes({
                name: "Fear (any)",
                value: -2,
              });
          });

          it("lowered Reflex", function () {
            expect(actor.system.attributes.savingThrows.ref.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.ref.total"])
              .to.be.an("array")
              .that.deep.includes({
                name: "Fear (any)",
                value: -2,
              });
          });

          it("lowered Will", function () {
            expect(actor.system.attributes.savingThrows.will.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.will.total"])
              .to.be.an("array")
              .that.deep.includes({
                name: "Fear (any)",
                value: -2,
              });
          });
        });

        it("lowered attack", function () {
          expect(actor.system.attributes.attack.general).to.equal(-2);
          expect(actor.sourceDetails["system.attributes.attack.general"]).to.be.an("array").that.deep.includes({
            name: "Fear (any)",
            value: -2,
          });
        });

        it("lowered skill checks", function () {
          for (const [skill, value] of [
            ["acr", 0],
            ["clm", -1],
            ["umd", 1],
          ]) {
            expect(actor.system.skills[skill].mod).to.equal(value);
            expect(actor.sourceDetails[`system.skills.${skill}.changeBonus`]).to.be.an("array").that.deep.includes({
              name: "Fear (any)",
              value: -2,
            });
          }
        });

        it("lowered ability checks", function () {
          for (const ability of Object.keys(PF1.abilities)) {
            expect(actor.system.abilities[ability].checkMod).to.equal(-2);
            expect(actor.sourceDetails[`system.abilities.${ability}.checkMod`]).to.be.an("array").that.deep.includes({
              name: "Fear (any)",
              value: -2,
            });
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

        it("can be enabled", async function () {
          expect(actor.hasCondition("sickened")).to.be.true;
        });

        describe("lowered saving throws", function () {
          it("lowered Fortitude", function () {
            expect(actor.system.attributes.savingThrows.fort.total).to.equal(1);
            expect(actor.sourceDetails["system.attributes.savingThrows.fort.total"])
              .to.be.an("array")
              .that.deep.includes({
                name: "Sickened",
                value: -2,
              });
          });

          it("lowered Reflex", function () {
            expect(actor.system.attributes.savingThrows.ref.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.ref.total"])
              .to.be.an("array")
              .that.deep.includes({
                name: "Sickened",
                value: -2,
              });
          });

          it("lowered Will", function () {
            expect(actor.system.attributes.savingThrows.will.total).to.equal(0);
            expect(actor.sourceDetails["system.attributes.savingThrows.will.total"])
              .to.be.an("array")
              .that.deep.includes({
                name: "Sickened",
                value: -2,
              });
          });
        });

        it("lowered attack", function () {
          expect(actor.system.attributes.attack.general).to.equal(-2);
          expect(actor.sourceDetails["system.attributes.attack.general"]).to.be.an("array").that.deep.includes({
            name: "Sickened",
            value: -2,
          });
        });

        it("lowered weapon damage", function () {
          expect(actor.system.attributes.damage.weapon).to.equal(-2);
          expect(actor.sourceDetails["system.attributes.damage.weapon"]).to.be.an("array").that.deep.includes({
            name: "Sickened",
            value: -2,
          });
        });

        it("lowered skill checks", function () {
          for (const [skill, value] of [
            ["acr", 0],
            ["clm", -1],
            ["umd", 1],
          ]) {
            expect(actor.system.skills[skill].mod).to.equal(value);
            expect(actor.sourceDetails[`system.skills.${skill}.changeBonus`]).to.be.an("array").that.deep.includes({
              name: "Sickened",
              value: -2,
            });
          }
        });

        it("lowered ability checks", function () {
          for (const ability of Object.keys(PF1.abilities)) {
            expect(actor.system.abilities[ability].checkMod).to.equal(-2);
            expect(actor.sourceDetails[`system.abilities.${ability}.checkMod`]).to.be.an("array").that.deep.includes({
              name: "Sickened",
              value: -2,
            });
          }
        });
      });

      // ---------------------------------- //
      // Blind                              //
      // ---------------------------------- //
      describe("blind", function () {
        before(async () => {
          await actor.setCondition("pf1_blind", true);
        });
        after(async () => {
          await actor.setCondition("pf1_blind", false);
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
          await actor.setCondition("fatigued", false);
          await actor.setCondition("exhausted", false);
        });

        it("Str and Dex penalty of -1 for fatigue", function () {
          for (const ability of ["str", "dex"]) {
            const baseModifier = getAbilityModifier(actor.system.abilities[ability].value);
            expect(actor.system.abilities[ability].mod).to.equal(baseModifier - 1);
            expect(actor.sourceDetails[`system.abilities.${ability}.total`]).to.be.an("array").that.deep.includes({
              name: "Fatigued",
              value: -2,
            });
          }
        });

        it("applying exhausted removes fatigue", async function () {
          await actor.setCondition("exhausted", true);
          expect(actor.system.attributes.conditions.fatigued).to.be.false;
          expect(actor.system.attributes.conditions.exhausted).to.be.true;
        });

        it("Str and Dex penalty of -3 for exhausted", function () {
          for (const ability of ["str", "dex"]) {
            const baseModifier = getAbilityModifier(actor.system.abilities[ability].value);
            expect(actor.system.abilities[ability].mod).to.equal(baseModifier - 3);
            expect(actor.sourceDetails[`system.abilities.${ability}.total`]).to.be.an("array").that.deep.includes({
              name: "Exhausted",
              value: -6,
            });
          }
        });
      });
    },
    { displayName: "PF1: Actor Conditions Tests" }
  );
};
