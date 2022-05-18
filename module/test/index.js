// -------------------------------- //
// Quench Unit Testing              //
// -------------------------------- //

import { registerActorBasicTests } from "./actor.basic.test.js";
import { registerActorConditionsTests } from "./actor.conditions.test.js";
import { registerActorItemTests } from "./actor.items.test.js";

export const registerTests = async () => {
  Hooks.on("quenchReady", async (quench) => {
    registerActorBasicTests(quench);
    registerActorConditionsTests(quench);
    registerActorItemTests(quench);
  });
};
