// -------------------------------- //
// Quench Unit Testing              //
// -------------------------------- //

import { registerActorBasicTests } from "./actor-basics.test.js";
import { registerActorConditionsTests } from "./actor-conditions.test.js";
import { registerActorItemRaceTests } from "./actor-races.test.js";
import { registerActorItemClassTests } from "./actor-classes.test.js";
import { registerActorItemAttackTests } from "./actor-attacks.test.js";
import { registerContainerItemTests } from "./container-items.test.js";
import { registerItemWeightTests } from "./item-weight.test.js";

// Registers all `Quench` tests
Hooks.on("quenchReady", () => {
  registerActorBasicTests();
  registerActorConditionsTests();
  registerActorItemRaceTests();
  registerActorItemClassTests();
  registerActorItemAttackTests();
  registerContainerItemTests();
});
