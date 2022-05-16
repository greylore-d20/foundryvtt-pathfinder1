import { createTestActor } from "./test.lib.js";

export const registerActorBaseTests = (quench) => {
  quench.registerBatch(
    "pf1.actor.basic-tests",
    async (context) => {
      const { describe, it, expect, before, after, fc } = context;
      /** @type {ActorPF} */
      let actor;
      before(async () => {
        actor = await createTestActor(true);
        actor.prepareData();
      });

      describe("ActorPF#rollBAB should produce a roll", function () {
        /** @type {ChatMessage} */
        let roll;
        before(async () => {
          roll = await actor.rollBAB();
        });

        it("between 1 and 20", function () {
          expect(roll?.roll?.total).to.be.within(1, 20);
        });

        it("should be a ChatMessage", function () {
          expect(roll instanceof ChatMessage).to.be.true;
        });
      });
    },
    { displayName: "PF1: Basic Actor Tests" }
  );
};
