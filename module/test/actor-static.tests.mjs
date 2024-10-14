// Test actor static functions

import { ActorPF } from "@actor/actor-pf.mjs";

export const registerActorStaticTests = () => {
  quench.registerBatch(
    "pf1.actor.static-tests",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      describe("getReach()", function () {
        it("medium & tall has 5 ft melee", function () {
          expect(ActorPF.getReach(4).melee).to.equal(5);
        });
        it("fine & tall has 0 ft reach", function () {
          expect(ActorPF.getReach(0).reach).to.equal(0);
        });
        it("small & tall has 10 ft reach", function () {
          expect(ActorPF.getReach("sm", "tall").reach).to.equal(10);
        });
        it("huge & tall has 10 ft melee", function () {
          expect(ActorPF.getReach("huge", "long").melee).to.equal(10);
        });
        it("colossal & tall has 60 ft reach", function () {
          expect(ActorPF.getReach("col", "tall").reach).to.equal(60);
        });
      });
    },
    { displayName: "PF1: Actor – Static Functions" }
  );
};
