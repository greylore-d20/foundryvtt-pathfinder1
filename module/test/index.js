// -------------------------------- //
// Quench Unit Testing              //
// -------------------------------- //

import { registerActorBasicTests } from "./actor-basics.test.js";
import { registerActorConditionsTests } from "./actor-conditions.test.js";
import { registerActorItemRaceTests } from "./actor-races.test.js";
import { registerActorItemClassTests } from "./actor-classes.test.js";

/**
 * Registers all `Quench` tests
 */
export const registerTests = async () => {
  Hooks.on("quenchReady", async () => {
    registerActorBasicTests();
    registerActorConditionsTests();
    registerActorItemRaceTests();
    registerActorItemClassTests();
  });
};
