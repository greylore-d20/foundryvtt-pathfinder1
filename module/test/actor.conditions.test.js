import { createTestActor } from "./test.lib.js";

export const registerActorConditionsTests = (quench) => {
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

      // ---------------------------------- //
      // Blind                              //
      // ---------------------------------- //
      describe("blind", function () {
        before(async () => {
          await actor.setCondition("pf1_blind", true);
        });
        after(async () => {
          await actor.update({ "data.abilities.dex.value": 10 });
          await actor.setCondition("pf1_blind", false);
        });

        it("lowered AC by 2", function () {
          expect(actor.data.data.attributes.ac.normal.total).to.equal(8);
        });
        it("lost Dexterity to AC", async function () {
          await actor.update({ "data.abilities.dex.value": 14 });
          // Blindness also lowers AC by 2, in addition negating Dex bonus to AC, so this should be 8
          expect(actor.data.data.attributes.ac.normal.total).to.equal(8);
        });

        it("still gains Dexterity penalties to AC", async function () {
          await actor.update({ "data.abilities.dex.value": 6 });
          // Blindness also lowers AC by 2, in addition negating Dex bonus to AC, so this should be 6
          expect(actor.data.data.attributes.ac.normal.total).to.equal(6);
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
          await actor.setCondition("exhausted", false);
        });

        it("Str and Dex penalty of -1 for fatigue", function () {
          expect(actor.data.data.abilities.str.mod).to.equal(-1);
          expect(actor.data.data.abilities.dex.mod).to.equal(-1);
        });
        it("applying exhausted removes fatigue", async function () {
          await actor.setCondition("exhausted", true);
          expect(actor.data.data.attributes.conditions.fatigued).to.be.false;
          expect(actor.data.data.attributes.conditions.exhausted).to.be.true;
        });
        it("Str and Dex penalty of -3 for exhausted", function () {
          expect(actor.data.data.abilities.str.mod).to.equal(-3);
          expect(actor.data.data.abilities.dex.mod).to.equal(-3);
        });
      });
    },
    { displayName: "PF1: Actor Conditions Tests" }
  );
};
