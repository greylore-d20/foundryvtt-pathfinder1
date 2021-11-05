import { createTag } from "./lib.js";

/**
 * @param {Object} options Configure testing.
 * @param {boolean} options.chatMessage Allow chat message creation by test functions.
 * @param {ActorPF|null} options.actor Actor to use for testing.
 * @param {boolean} options.synthetic Create synthetic actor. If false, create actual actor. Ignored if actor is provided.
 */
export const runUnitTests = async function (options = { chatMessage: true, synthetic: true, actor: null }) {
  let actor;
  try {
    console.log("Preparing test actor");
    if (options.actor) {
      actor = options.actor;
    } else {
      actor = await createTestActor(options);
      actor.prepareData(); // Ensure data is present. May only be needed for synthetic actor?
    }
    actor.performRest(); // Reset charges

    console.log("Running unit tests...");
    const tests = [];
    tests.push(...(await runSkillTests(actor, options)));
    tests.push(...(await runAttackTests(actor, options)));
    tests.push(...(await runMiscActorTests(actor, options)));
    tests.push(...(await runSizeRollTests(options)));

    // Finish unit tests
    const successes = tests.filter((o) => !o.failure);
    const failures = tests.filter((o) => o.failure);
    console.log(`Unit tests done. ${successes.length}/${tests.length} succeeded.`);
    if (failures.length) {
      console.log("Failures:", failures);
    }
  } finally {
    // Cleanup
    if (actor && !options.synthetic && options.actor == null) {
      actor.delete();
    }
  }
};

/**
 * Create synthetic actor
 *
 * @returns {ActorPF}
 */
const createTestActor = async ({ synthetic = false } = {}) => {
  const fetchPackEntry = async (packName, itemName) => {
    const pack = await game.packs.get(packName);
    const item = await pack.getDocument(pack.index.find((r) => r.name === itemName)._id);
    return item;
  };

  const raceName = "Human",
    className = "Fighter",
    weaponName = "Longsword",
    spellName = "Fireball";

  // Add some basic testing items
  const race0 = fetchPackEntry("pf1.races", raceName),
    class0 = fetchPackEntry("pf1.classes", className),
    weapon0 = fetchPackEntry("pf1.weapons-and-ammo", weaponName),
    spell0 = fetchPackEntry("pf1.spells", spellName);
  const promises = [race0, class0, weapon0, spell0];
  const items = (await Promise.allSettled(promises)).map((p) => p.value.toObject());

  if (!synthetic) {
    // Does not work for synthetic actor
    const weapon1A = await actor.createAttackFromWeapon(actor.items.getName(weaponName));
    items.push(weapon1A);
  }

  const actorData = {
    name: "Dummy",
    //img: "icons/svg/mystery-man.svg",
    type: "character",
    items,
  };

  const actor = synthetic ? new Actor.implementation(actorData) : await Actor.create(actorData);

  // Add custom skills

  // Create custom skill (doesn't work?)
  const customSkillData = {
    name: "Test",
    ability: "int",
    rank: 0,
    mod: 0,
    rt: false,
    cs: false,
    acp: false,
    background: false,
    custom: true,
  };
  const customSkillTag = createTag(customSkillData.name);

  const customSubskill = {
    name: "Test Performance",
    ability: "cha",
    rank: 5,
    mod: 0,
    rt: false,
    cs: true,
    acp: false,
  };
  const customSubskillTag = "prf1";

  const skillUpdate = {
    data: {
      skills: {
        [customSkillTag]: customSkillData,
        prf: {
          subSkills: {
            [customSubskillTag]: customSubskill,
          },
        },
      },
    },
  };

  const mergedData = actor.data.toObject();
  mergeObject(mergedData, skillUpdate);

  // Finalize update
  await actor.data.update(mergedData);

  return actor;
};

class UnitTestResult {
  constructor(name) {
    this.name = name;
    this.failure = false;
    this.error = null;
    this.chatMessages = [];
  }

  fail(error) {
    this.failure = true;
    if (error) this.error = error;
    console.log(`${this.name} failed!`, this.error);
  }

  succeed() {
    this.failure = false;
    this.error = null;
    console.log(`${this.name} succeeded!`);
  }
}

const runSizeRollTests = async function ({ chatMessage = true } = {}) {
  const result = [];

  await _addSizeRollTest("1d6", "1d6", result);
  await _addSizeRollTest("1d4", "1d6", result, { targetSize: 5 });
  await _addSizeRollTest("1d6", "1d8", result, { targetSize: 5 });
  await _addSizeRollTest("1d8", "1d6", result, { targetSize: 3 });
  await _addSizeRollTest("1d6", "1d4", result, { targetSize: 3 });
  await _addSizeRollTest("2d4", "2d6", result, { targetSize: 5 });
  await _addSizeRollTest("2d6", "6d6", result, { targetSize: 7 });
  await _addSizeRollTest("6d8", "2d8", result, { targetSize: 4, initialSize: 7 });
  await _addSizeRollTest("6d8", "3d8", result, { targetSize: 2, initialSize: 5 });
  await _addSizeRollTest("2d10", "4d8", result, { targetSize: 5 });
  await _addSizeRollTest("2d10", "2d8", result, { targetSize: 3 });
  await _addSizeRollTest("4d10", "8d8", result, { targetSize: 5 });

  return result;
};

const _addSizeRollTest = async function (
  formula,
  expectedFormula,
  resultArr,
  options = { targetSize: 4, initialSize: 4 }
) {
  options = mergeObject({ targetSize: 4, initialSize: 4 }, options);
  const label = `Size roll: ${formula}, going from size ${options.initialSize} to ${options.targetSize}`;
  const test = new UnitTestResult(label);

  const re = /^([0-9]+)d([0-9]+)$/;
  if (!formula.match(re)) {
    throw new Error(`Unit test (size roll): incorrect input formula: '${formula}'`);
  }
  const baseDie = [parseInt(RegExp.$1), parseInt(RegExp.$2)];
  if (!expectedFormula.match(re)) {
    throw new Error(`Unit test (size roll): incorrect expected formula: '${expectedFormula}'`);
  }
  const expectedDie = [parseInt(RegExp.$1), parseInt(RegExp.$2)];
  resultArr.push(test);

  try {
    const roll = RollPF.safeRoll(
      `sizeRoll(${baseDie[0]}, ${baseDie[1]}, ${options.targetSize}, ${options.initialSize})`
    );
    if (roll.err) throw roll.err;
    const term = roll.terms[0];
    if (term.number !== expectedDie[0] || term.faces !== expectedDie[1])
      throw new Error(
        `Incorrect result die. Expected: ${expectedDie[0]}d${expectedDie[1]}, got: ${term.number}d${term.faces}`
      );
    test.succeed();
  } catch (err) {
    test.fail(err);
  }
};

const runSkillTests = async function (actor, { chatMessage = true } = {}) {
  const result = [];

  // Run base skill
  {
    const test = new UnitTestResult("Normal skill check");
    try {
      await actor.rollSkill("acr", { skipDialog: true, chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run sub-skill
  {
    const test = new UnitTestResult("Sub-skill check");
    try {
      await actor.rollSkill("prf.subSkills.prf1", { skipDialog: true, chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run custom skill
  {
    const test = new UnitTestResult("Custom skill check");
    try {
      await actor.rollSkill("test", { skipDialog: true, chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  return result;
};

const runAttackTests = async function (actor, { chatMessage = true } = {}) {
  const result = [];

  // Run Longsword attack
  {
    const test = new UnitTestResult("Longsword attack");
    try {
      const item = actor.items.find((o) => o.name === "Longsword" && o.type === "attack");
      item.useAttack({ skipDialog: true }, chatMessage);
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run Fireball attack
  {
    const test = new UnitTestResult("Fireball spell");
    try {
      const item = actor.items.find((o) => o.name === "Fireball" && o.type === "spell");
      item.useAttack({ skipDialog: true });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  return result;
};

const runMiscActorTests = async function (actor, { chatMessage = true } = {}) {
  const result = [];

  // Run BAB test
  {
    const test = new UnitTestResult("BAB");
    try {
      await actor.rollBAB({ chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run CMB test
  {
    const test = new UnitTestResult("CMB");
    try {
      await actor.rollCMB({ chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run Fortitude test
  {
    const test = new UnitTestResult("Fortitude Saving Throw");
    try {
      await actor.rollSavingThrow("fort", { skipPrompt: true, chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run Reflex test
  {
    const test = new UnitTestResult("Reflex Saving Throw");
    try {
      await actor.rollSavingThrow("ref", { skipPrompt: true, chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run Will test
  {
    const test = new UnitTestResult("Will Saving Throw");
    try {
      await actor.rollSavingThrow("will", { skipPrompt: true, chatMessage });
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  // Run Initiative test
  {
    const test = new UnitTestResult("Initiative");
    try {
      await actor.rollInitiative();
      test.succeed();
    } catch (e) {
      test.fail(e);
    }
    result.push(test);
  }

  return result;
};
