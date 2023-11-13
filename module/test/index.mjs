// -------------------------------- //
// Quench Unit Testing              //
// -------------------------------- //

import { registerActorBasicTests } from "./actor-basics.test.mjs";
import { registerActorConditionsTests } from "./actor-conditions.test.mjs";
import { registerActorItemRaceTests } from "./actor-races.test.mjs";
import { registerActorItemClassTests } from "./actor-classes.test.mjs";
import { registerActorItemAttackTests } from "./actor-attacks.test.mjs";
import { registerContainerItemTests } from "./container-items.test.mjs";
import { registerItemWeightTests } from "./item-weight.test.mjs";
import { registerD20RollTests } from "./d20roll.test.mjs";
import { registerFormulaParsingTests } from "./formula.test.mjs";
import { registerSizeRollTests } from "./sizeroll.test.mjs";

// Registers all `Quench` tests
Hooks.on("quenchReady", () => {
  registerActorBasicTests();
  registerActorConditionsTests();
  registerActorItemRaceTests();
  registerActorItemClassTests();
  registerActorItemAttackTests();
  registerContainerItemTests();
  registerItemWeightTests();
  registerD20RollTests();
  registerFormulaParsingTests();
  registerSizeRollTests();
});
