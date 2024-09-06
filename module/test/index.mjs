// -------------------------------- //
// Quench Unit Testing              //
// -------------------------------- //

import { registerActorBasicTests } from "./actor-basics.test.mjs";
import { registerActorConditionsTests } from "./actor-conditions.test.mjs";
import { registerActorItemRaceTests } from "./actor-races.test.mjs";
import { registerActorItemClassTests } from "./actor-classes.test.mjs";
import { registerActorItemAttackTests } from "./actor-attacks.test.mjs";
import { registerAttackIterativesTests } from "./attack-iteratives.test.mjs";
import { registerContainerItemTests } from "./container-items.test.mjs";
import { registerItemWeightTests } from "./item-weight.test.mjs";
import { registerD20RollTests } from "./d20roll.test.mjs";
import { registerFormulaParsingTests } from "./formula.test.mjs";
import { registerSizeRollTests } from "./roll-terminology.test.mjs";
import { registerActorRestTests } from "./actor-rest.test.mjs";
import { registerActorStaticTests } from "./actor-static.tests.mjs";
import { registerConfigTests } from "./config.test.mjs";
import { registerCurrencyTests } from "./currency.test.mjs";
import { registerWoundThresholdsTests } from "./wound-thresholds.test.mjs";
import { registerMaterialTests } from "./material.test.mjs";

// Registers all `Quench` tests
Hooks.on("quenchReady", () => {
  // Config
  registerConfigTests();
  // Rolls (core functionality other things depend on)
  registerD20RollTests();
  registerFormulaParsingTests();
  registerSizeRollTests();
  // Actor
  registerActorStaticTests();
  registerActorBasicTests();
  registerActorConditionsTests();
  registerActorItemRaceTests();
  registerActorItemClassTests();
  registerActorItemAttackTests();
  // Actor functionality
  registerActorRestTests();
  registerWoundThresholdsTests();
  // Items
  registerAttackIterativesTests();
  registerContainerItemTests();
  registerItemWeightTests();
  registerMaterialTests();
  // Misc
  registerCurrencyTests();
});
