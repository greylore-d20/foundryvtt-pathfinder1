import { ActorPF } from "../actor/entity.js";
import { createTestActor, addCompendiumItemToActor } from "./actor-utils.js";

export const registerActorItemRaceTests = () => {
  // ---------------------------------- //
  // Actor stats                        //
  // ---------------------------------- //
  quench.registerBatch(
    "pf1.actor.items.race",
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
      // Race                               //
      // ---------------------------------- //
      describe("add race", function () {
        before(async () => {
          await addCompendiumItemToActor(actor, "pf1.races", "Human");
        });
        after(async () => {
          await actor.race.delete();
        });

        it("add Human", function () {
          const race = actor.itemTypes.race[0];
          expect(race.name).to.equal("Human");
        });

        it("replace with Elf", async function () {
          await addCompendiumItemToActor(actor, "pf1.races", "Elf");
          expect(actor.itemTypes.race).to.be.an("array").with.lengthOf(1);
          expect(actor.itemTypes.race[0].name).to.equal("Elf");
        });

        describe("has Elf stats", function () {
          it("has appropriate Dex", function () {
            expect(actor.data.abilities.dex.total).to.equal(16);
          });
          it("has appropriate Int", function () {
            expect(actor.data.abilities.int.total).to.equal(15);
          });
          it("has appropriate Con", function () {
            expect(actor.data.abilities.con.total).to.equal(14);
          });
        });
      });
    },
    { displayName: "PF1: Actor Race Item Tests" }
  );
};
