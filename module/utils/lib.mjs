import { SemanticVersion } from "./semver.mjs";
import { RollPF } from "../dice/roll.mjs";

/**
 * Creates a tag from a string.
 *
 * @example
 * pf1.utils.createTag("Wizard of Oz 2"); // => "wizardOfOz2"
 *
 * @param {string} str
 */
export const createTag = function (str) {
  if (str.length === 0) str = "tag";
  return str
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((s, a) => {
      s = s.toLowerCase();
      if (a > 0) s = s.substring(0, 1).toUpperCase() + s.substring(1);
      return s;
    })
    .join("");
};

/**
 * @deprecated
 * @param {string} version - The minimum core version to compare to. Must be something like '0.5.1'.
 * @returns {boolean} Whether the current core version is at least the given version.
 */
export const isMinimumCoreVersion = function (version) {
  foundry.utils.logCompatibilityWarning("pf1.utils.isMinimumCoreVersion is deprecated with no replacement", {
    since: "PF1 vNEXT",
    until: "PF1 vNEXT+1",
  });
  const coreVersion = SemanticVersion.fromString(game.version);
  const compareVersion = SemanticVersion.fromString(version);

  return !coreVersion.isLowerThan(compareVersion);
};

/**
 * @deprecated - Use `item.actor` instead
 * @param {object} item Item data
 * @returns {User|null}
 */
export const getItemOwner = function (item) {
  foundry.utils.logCompatibilityWarning("pf1.utils.getItemOwner() is deprecated with no replacement", {
    since: "PF1 vNEXT",
    until: "PF1 vNEXT+1",
  });
  if (item.actor) return item.actor;
  if (item.id) return game.actors.find((o) => o.items.get(item.id));
  return null;
};

/**
 * Turn some fractional numbers into pretty strings.
 *
 * @param {number} v
 * @returns {string|undefined}
 */
export const fractionalToString = (v) => {
  const base = Math.floor(v);
  const f = Math.roundDecimals(v - base, 3);
  if (f === 0) return `${base}`;
  const rv = [];
  if (base !== 0) rv.push(base);
  if (f === 0.25) rv.push("1/4");
  else if (f === 0.333) rv.push("1/3");
  else if (f === 0.5) rv.push("1/2");
  else if (f === 0.667) rv.push("2/3");
  else if (f === 0.75) rv.push("3/4");
  return rv.join(" ");
};

export const CR = {
  fromString(value) {
    if (value === "1/8") return 0.125;
    if (value === "1/6") return 0.1625;
    if (value === "1/4") return 0.25;
    if (value === "1/3") return 0.3375;
    if (value === "1/2") return 0.5;
    return parseFloat(value);
  },

  fromNumber(value = 0) {
    if (value === 0.125) return "1/8";
    if (value === 0.1625) return "1/6";
    if (value === 0.25) return "1/4";
    if (value === 0.3375) return "1/3";
    if (value === 0.5) return "1/2";
    if (!Number.isNumeric(value)) return "0";
    return value?.toString() ?? "";
  },
};

/**
 * @deprecated - Use `game.actors.get(id)` instead
 * @param {*} id
 * @returns
 */
export const getActorFromId = function (id) {
  foundry.utils.logCompatibilityWarning("pf1.utils.getActorFromId() is deprecated with no replacement", {
    since: "PF1 vNEXT",
    until: "PF1 vNEXT+1",
  });
  const speaker = ChatMessage.getSpeaker();
  let actor = null;
  if (id) {
    actor = game.actors.tokens[id];
    if (!actor) actor = game.actors.get(id);
  }
  if (speaker.token && !actor) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  return actor;
};

/**
 * Converts feet to what the world is using as a measurement unit.
 *
 * @example
 * // With metric enabled
 * pf1.utils.convertDistance(30); // => [9, "m"]
 *
 * @param {number} value - The value (in feet) to convert.
 * @param {"ft"|"mi"} type - The original type to convert from. Either 'ft' (feet, default) or 'mi' (miles, in which case the result is in km (metric))
 * @returns {Array.<number, string>} An array containing the converted value in index 0 and the new unit key in index 1 (for use in PF1.measureUnits, for example)
 */
export const convertDistance = function (value, type = "ft") {
  const system = getDistanceSystem();
  switch (system) {
    case "metric":
      switch (type) {
        case "mi":
          return [Math.round(value * 1.6 * 100) / 100, "km"];
        default:
          return [Math.round((value / 5) * 1.5 * 100) / 100, "m"];
      }
    default:
      if (!["ft", "mi"].includes(type)) type = "ft";
      return [value, type];
  }
};

/**
 * Converts what the world is using as a measurement unit to feet.
 *
 * @param {number} value - The value (in the world's measurement unit) to convert back.
 * @param {string} type - The target type to convert back to. Either 'ft' (feet, default) or 'mi' (miles, in which case the expected given value should be in km (metric))
 * @returns {number} The resulting value.
 */
export const convertDistanceBack = function (value, type = "ft") {
  const system = getDistanceSystem();
  switch (system) {
    case "metric":
      switch (type) {
        case "mi":
          return [Math.round((value / 1.6) * 100) / 100, "mi"];
        default:
          return [Math.round(((value * 5) / 1.5) * 100) / 100, "ft"];
      }
    default:
      return [value, type];
  }
};

/**
 * Calculate overland speed per hour
 *
 * @see {@link https://www.aonprd.com/Rules.aspx?Name=Movement&Category=Exploration Exploration Movement rules}
 *
 * @example
 * // metric
 * overlandSpeed(9) // => {speed:6, unit:'km'}
 * // imperial
 * overlandSpeed(40) // => {speed:4, unit:'mi'}
 *
 * @param {number} speed - Tactical speed
 * @returns {{speed:number,unit:string}} - Object with overland speed and unit.
 */
export function overlandSpeed(speed) {
  const system = getDistanceSystem();
  const variant = system === "metric" ? game.settings.get("pf1", "overlandMetricVariant") : "default";
  const { per, out, unit } = pf1.config.overlandSpeed[system][variant];

  return { speed: (speed / per) * out, unit };
}

/**
 * @returns {UnitSystem} Effective system of units
 */
export const getDistanceSystem = () => {
  let system = game.settings.get("pf1", "distanceUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  return system;
};

/**
 * @returns {UnitSystem} Effective system of units
 */
export const getWeightSystem = () => {
  let system = game.settings.get("pf1", "weightUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  return system;
};

/**
 * @typedef Point
 * @property {number} x X coordinate
 * @param {number} y Y coordinate
 */

/**
 * @typedef MeasureState
 * @param {number} diagonals Number of diagonals passed so far.
 * @param {number} cells Total cells in distance
 */

/**
 * Measure distance between two points.
 *
 * @example
 * pf1.utils.measureDistance(token, game.user.targets.first());
 *
 * @param {Point} p0 - Start point on canvas
 * @param {Point} p1 - End point on canvas
 * @param {object} [options] - Measuring options.
 * @param {"5105"|"555"} [options.diagonalRule="5105"] - Used diagonal rule. Defaults to 5/10/5 PF measuring.
 * @param {Ray} [options.ray=null] - Pre-generated ray to use instead of the points.
 * @param {MeasureState} [options.state] - Optional state tracking across multiple measures.
 * @returns {number} - Grid distance between the two points.
 */
export const measureDistance = function (
  p0,
  p1,
  { ray = null, diagonalRule = "5105", state = { diagonals: 0, cells: 0 } } = {}
) {
  // TODO: Optionally adjust start and end point to closest grid
  ray ??= new Ray(p0, p1);
  const gs = canvas.dimensions.size,
    nx = Math.ceil(Math.abs(ray.dx / gs)),
    ny = Math.ceil(Math.abs(ray.dy / gs));

  // Get the number of straight and diagonal moves
  const nDiagonal = Math.min(nx, ny),
    nStraight = Math.abs(ny - nx);

  state.diagonals += nDiagonal;

  let cells = 0;
  // Standard Pathfinder diagonals: double distance for every odd.
  if (diagonalRule === "5105") {
    const nd10 = Math.floor(state.diagonals / 2) - Math.floor((state.diagonals - nDiagonal) / 2);
    cells = nd10 * 2 + (nDiagonal - nd10) + nStraight;
  }
  // Equal distance diagonals
  else cells = nStraight + nDiagonal;

  state.cells += cells;
  return cells * canvas.dimensions.distance;
};

/**
 * Converts lbs to what the world is using as a measurement unit.
 *
 * @param {number} value - The value (in lbs) to convert.
 * @returns {number} The converted value. In the case of the metric system, converts to kg.
 */
export const convertWeight = function (value) {
  const system = getWeightSystem();
  switch (system) {
    case "metric":
      // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
      return value / 2;
    default:
      return value;
  }
};

/**
 * Converts back to lbs from what the world is using as a measurement unit.
 *
 * @example
 * // Assuming metric is enabled
 * pf1.utils.convertWeightBack(10); // => 20
 * // With metric disabled
 * pf1.utils.convertWeightBack(10); // => 10
 *
 * @param {number} value - The value to convert back to lbs.
 * @returns {number} The converted value. In the case of the metric system, converts from kg.
 */
export const convertWeightBack = function (value) {
  const system = getWeightSystem();
  switch (system) {
    case "metric":
      return value * 2; // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
    default:
      return value;
  }
};

/**
 * Sort an array using a language-aware comparison function that can sort by a property key.
 * If no property key is provided, the array is sorted directly.
 *
 * @template T
 * @param {T[]} arr The array to sort
 * @param {string} [propertyKey=""] The property key to sort by, if any; can be a dot-separated path
 * @param {object} [sortOptions] - Options affecting the sorting of elements
 * @param {boolean} sortOptions.numeric - Whether numeric collation should be used, such that "1" < "2" < "10".
 * @param {boolean} sortOptions.ignorePunctuation - Whether punctuation should be ignored.
 * @returns {T[]} The sorted array
 */
export const naturalSort = function (arr, propertyKey = "", { numeric = true, ignorePunctuation = false } = {}) {
  const collator = new Intl.Collator(game.settings.get("core", "language"), { numeric, ignorePunctuation });
  return arr.sort((a, b) => {
    const propA = propertyKey ? (propertyKey in a ? a[propertyKey] : foundry.utils.getProperty(a, propertyKey)) : a;
    const propB = propertyKey ? (propertyKey in b ? b[propertyKey] : foundry.utils.getProperty(b, propertyKey)) : b;
    return collator.compare(propA, propB);
  });
};

/**
 * Adjusts a string to a number, allowing relative adjustments.
 *
 * @param {number} initialValue - The initial number to use for relative operations.
 * @param {string} cmdStr - The exact string inputted by the user.
 * @param {number} [maxValue=null] - The maximum allowed value for this variable.
 * @param {number} [clearValue=null] - What to change the variable to if the user simply erased the value.
 * @returns {number} The resulting new value.
 */
export const adjustNumberByStringCommand = function (initialValue, cmdStr, maxValue = null, clearValue = null) {
  let result = initialValue;
  const re = cmdStr.match(/(?<abs>=)?(?<op>[+-]+)?(?<value>\d+)/);
  if (re) {
    const { op: operator, abs, value: rawValue } = re.groups;
    const isAbsolute = abs == "=" || ["--", "++"].includes(operator) || (!abs && !operator);
    const isNegative = ["-", "--"].includes(operator);
    let value = parseInt(rawValue);
    if (isNegative) value = -value;
    result = isAbsolute ? value : initialValue + value;
  } else if (cmdStr === "" && clearValue !== null) {
    result = clearValue;
  } else {
    result = parseFloat(cmdStr || "0");
  }

  if (Number.isFinite(maxValue)) result = Math.min(result, maxValue);

  if (Number.isNaN(result)) {
    console.warn("Input resulted in NaN", { initial: initialValue, command: cmdStr });
    result = initialValue;
  }

  return result;
};

/**
 * Opens journal or journal page.
 *
 * Pages are opened in collapsed state.
 *
 * @param {string} uuid - UUID to journal or journal page
 * @param {object} [options={}] - Additional rendering options
 * @returns {JournalEntry|JournalEntryPage|null} - Opened document
 */
export async function openJournal(uuid, options = {}) {
  const journal = await fromUuid(uuid);

  if (journal instanceof JournalEntryPage) {
    journal.parent.sheet.render(true, {
      pageId: journal.id,
      editable: false,
      collapsed: true,
      width: 600,
      height: 700,
      ...options,
    });
  } else {
    journal.sheet.render(true, { editable: false, ...options });
  }

  return journal;
}

/**
 * @typedef {object} BuffTargetItem
 * @property {string} [label] - The buff target's label.
 * @property {string} category - The buff target's category.
 * @property {string} [icon] - The URL to an icon.
 */
/**
 * Assembles an array of all possible buff targets.
 *
 * @param {ActorPF} [actor] - An actor for which to specifically get buff targets.
 * @param {string} [type] - Can be set to "contextNotes" to get context notes instead.
 * @returns {Object<string, BuffTargetItem>} The resulting array of buff targets.
 */
export const getBuffTargets = function (actor, type = "buffs") {
  const buffTargets = foundry.utils.deepClone(
    {
      buffs: pf1.config.buffTargets,
      contextNotes: pf1.config.contextNoteTargets,
    }[type]
  );

  // Append individual skills to buff targets
  if (actor) {
    for (const s of actor._skillTargets) {
      const skillId = s.split(".").slice(1).join(".");
      const skill = actor.getSkillInfo(skillId);
      buffTargets[s] = { label: skill.fullName, category: "skill" };
    }
  } else {
    for (const [key, label] of Object.entries(pf1.config.skills)) {
      buffTargets[`skill.${key}`] = { label, category: "skill" };
    }
  }

  // Append spell targets
  const books = actor?.system.attributes?.spells?.spellbooks ?? {
    primary: { label: game.i18n.localize("PF1.SpellBookPrimary") },
    secondary: { label: game.i18n.localize("PF1.SpellBookSecondary") },
    tertiary: { label: game.i18n.localize("PF1.SpellBookTertiary") },
    spelllike: { label: game.i18n.localize("PF1.SpellBookSpelllike") },
  };

  // Get actor specific spell targets
  const spellTargets = actor?._spellbookTargets ?? [];

  // Add spell school DCs and CLs
  for (const schoolId of Object.keys(CONFIG.PF1.spellSchools)) {
    spellTargets.push(`dc.school.${schoolId}`, `cl.school.${schoolId}`);
  }

  for (const s of spellTargets) {
    const re = /^(?<key>\w+)(?:\.(?<category>\w+))?\.(?<subKey>\w+)$/.exec(s);
    if (!re) continue;
    const { key, category, subKey } = re.groups;

    let subLabel;
    if (category === "school") subLabel = CONFIG.PF1.spellSchools[subKey];
    else subLabel = books[subKey]?.label ?? subKey;

    const fullKey = category ? `${key}.${category}` : key;
    const mainLabel = game.i18n.localize(
      {
        "dc.school": "PF1.DC",
        concn: "PF1.Concentration",
        "cl.book": "PF1.CasterLevel",
        "cl.school": "PF1.CasterLevelAbbr",
      }[fullKey]
    );

    buffTargets[s] = {
      label: `${mainLabel} (${subLabel})`,
      category: "spell",
    };
  }

  return buffTargets;
};

/**
 * @typedef {object} BuffTargetCategory
 * @property {string} label - The category's label.
 */
/**
 * Assembles an array of buff targets and their categories, ready to be inserted into a Widget_CategorizedItemPicker.
 *
 * @param {ActorPF} [actor] - An actor for which to specifically get buff targets.
 * @param {string} [type] - Can be set to "contextNotes" to get context notes instead.
 * @returns {Widget_CategorizedItemPicker~Category[]}
 */
export const getBuffTargetDictionary = function (actor, type = "buffs") {
  const buffTargets = getBuffTargets(actor, type);

  // Assemble initial categories and items
  const targetCategories = foundry.utils.deepClone(
    {
      buffs: pf1.config.buffTargetCategories,
      contextNotes: pf1.config.contextNoteCategories,
    }[type]
  );
  let categories = Object.entries(buffTargets).reduce((cur, o) => {
    const key = o[0];
    const label = o[1].label;
    const category = o[1].category;
    const icon = o[1].icon;

    if (!key.startsWith("~")) {
      cur[category] = cur[category] || {
        label: targetCategories[category].label,
        items: [],
      };
      cur[category].items.push({ key, label, icon });
    }
    return cur;
  }, {});

  // Turn result into a usable format, and sort
  categories = Object.entries(categories).reduce((cur, o) => {
    const key = o[0];
    const label = o[1].label;
    const items = o[1].items;
    cur.push({ key, label, items });
    return cur;
  }, []);
  categories = naturalSort(categories, "label");

  // Return result
  return categories;
};

/**
 * A locale-safe insertion sort of an Array of Objects, not in place. Ignores punctuation and capitalization.
 * `name` properties in objects will be lowercased.
 *
 * @template T
 * @param {Array.<T & {name: string}>} inputArr - Array to be sorted. Each element must have a name property set
 * @returns {T[]} - New sorted Array
 */
export const sortArrayByName = function (inputArr) {
  inputArr = foundry.utils.deepClone(inputArr);
  for (const elem of inputArr) {
    elem.name = elem.name.toLocaleLowerCase();
  }
  return naturalSort(inputArr, "name", { numeric: true, ignorePunctuation: true });
};

/**
 * A simple binary search to be used on sorted arrays
 *
 * @template T
 * @param {T[]} searchArr - Sorted Array to be searched
 * @param {T} el - Element to be compared to array values
 * @param {function(T, T): number} compare_fn - Comparison function to be apply el to every element in ar. Should return an positive/ negative integer or 0 if matching.
 * @returns {number} Index where search is found or negative index indicating where it would be inserted
 */
export const binarySearch = function (searchArr, el, compare_fn) {
  let m = 0,
    n = searchArr.length - 1;
  while (m <= n) {
    const k = (n + m) >> 1,
      cmp = compare_fn(el, searchArr[k]);
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return k;
    }
  }
  return -m - 1;
};

/**
 * Generate permutations of an array. Complexity is O(n!).
 * Should be safe up to 7, though you should probably consider something else if you're reaching that high often.
 *
 * @template T
 * @param {T[]} perm - The Array to be generated upon
 * @returns {Array.<T[]>|false} An Array containing all Array permutations or false if failed.
 */
function uniquePermutations(perm) {
  perm = perm.map((p) => p.trim()).filter((p) => p?.length > 0);

  if (perm.length > 7) {
    console.warn("Array too large. Not attempting.", perm);
    return false;
  }

  const total = new Set();

  for (let i = 0; i < perm.length; i = i + 1) {
    const rest = uniquePermutations(perm.slice(0, i).concat(perm.slice(i + 1)));

    if (!rest.length) {
      total.add([perm[i]]);
    } else {
      for (let j = 0; j < rest.length; j = j + 1) {
        total.add([perm[i]].concat(rest[j]));
      }
    }
  }
  return [...total];
}

/**
 * Searches through compendia quickly using the system generated index caches.
 * Exact matches excluding punctuation and case are prioritized before searching word order permutations.
 *
 * @param {string} searchTerm - The name of the Document being searched for
 * @param {object} [options] - Provides a filter to limit search to specific packs or Document types
 * @param {string[]} [options.packs] - An array of packs to search in
 * @param {"Actor"|"Item"|"Scene"|"JournalEntry"|"Macro"|"RollTable"|"Playlist"} [options.type] - A Document type to limit which packs are searched in
 * @param {string} [options.docType] - Document type, such as "loot" or "npc"
 * @param {boolean} [options.disabled=false] - Include packs disabled for compendium browser.
 * @returns {{pack: CompendiumCollection, index: object}|false} The index and pack containing it or undefined if no match is found
 */
export const findInCompendia = function (searchTerm, { packs = [], type, docType, disabled = false } = {}) {
  if (packs?.length) packs = packs.flatMap((o) => game.packs.get(o) ?? []);
  else packs = game.packs.filter((o) => !type || o.metadata.type == type);
  if (!disabled) packs = packs.filter((o) => o.config?.pf1?.disabled !== true);

  searchTerm = searchTerm.toLocaleLowerCase();

  for (const pack of packs) {
    if (!pack.fuzzyIndex) pack.fuzzyIndex = sortArrayByName([...pack.index]);
    let filteredIndex = pack.fuzzyIndex;
    if (docType) filteredIndex = filteredIndex.filter((e) => e.type === docType);

    const found = binarySearch(filteredIndex, searchTerm, (sp, it) =>
      sp.localeCompare(it.name, undefined, { ignorePunctuation: true })
    );
    if (found > -1) {
      const entry = pack.index.get(filteredIndex[found]._id);
      return { pack, index: entry };
    }
  }

  let searchMutations = uniquePermutations(searchTerm.split(/[, _-]/));
  if (searchMutations) searchMutations = searchMutations.map((o) => o.join(" "));
  else {
    // If array is too long, search for just a reversed version and one that pivots around commas/ semicolons
    searchMutations = [null];
    searchMutations.push(searchTerm.split(/[ _-]/).reverse().join(" "));
    searchMutations.push(
      searchTerm
        .split(/[,;] ?/)
        .reverse()
        .flatMap((o) => o.split(" "))
        .join(" ")
    );
  }

  for (const pack of packs) {
    let filteredIndex = pack.fuzzyIndex;
    if (docType) filteredIndex = filteredIndex.filter((e) => e.type === docType);

    // Skip first mutation since it is already searched for manually before computing mutations
    for (let mut = 1; mut < searchMutations.length; mut++) {
      const found = binarySearch(filteredIndex, searchMutations[mut], (sp, it) =>
        sp.localeCompare(it.name, undefined, { ignorePunctuation: true })
      );
      if (found > -1) {
        const entry = pack.index.get(filteredIndex[found]._id);
        if (entry) return { pack, index: entry };
      }
    }
  }

  return false;
};

/**
 * Variant of TextEditor._createInlineRoll for creating unrolled inline rolls.
 *
 * Synchronized with Foundry VTT v10.291
 *
 * {@inheritDoc TextEditor._createInlineRoll
 *
 * @param match
 * @param rollData
 * @param options
 */
export function createInlineFormula(match, rollData, options) {
  let [command, formula, closing, label] = match.slice(1, 5);
  const isDeferred = !!command;
  let roll;

  const cls = ["inline-preroll", "inline-formula"];

  // Handle the possibility of closing brackets
  if (closing.length === 3) formula += "]";

  // Extract roll data as a parsed chat command
  const chatCommand = `${command}${formula}`;
  let parsedCommand = null;
  try {
    parsedCommand = ChatLog.parse(chatCommand);
  } catch (err) {
    console.error("Failed to parse formula:", chatCommand, err);
    return null;
  }
  const [cmd, matches] = parsedCommand;
  const [raw, rollType, fml, flv] = matches;
  // TODO: Prettify display of commands like: /d 3d6

  const a = document.createElement("a");

  // Set roll data
  if (cmd) {
    cls.push(cmd);
    a.dataset.mode = cmd;
  }
  a.dataset.flavor = flv?.trim() ?? label ?? "";
  formula = Roll.defaultImplementation.replaceFormulaData(formula.trim(), rollData || {});
  try {
    formula = pf1.utils.formula.simplify(formula);
  } catch (err) {
    console.error(err);
    return null;
  }
  a.dataset.formula = formula;

  a.classList.add(...cls);

  a.dataset.tooltip = formula;
  label = label ? `${label}: ${formula}` : formula;
  a.innerHTML = `<i class="fas fa-dice-d20"></i> ${label}`;

  return a;
}

/**
 * enrichHTML but with inline rolls not rolled
 *
 * {@inheritDoc TextEditor.enrichHTML}
 *
 * @param {string} content HTML content in string format to be enriched.
 * @param {options} [options] Additional options passed to enrichHTML
 * @param {object} [options.rollData] Roll data object
 * @param {boolean} [options.secrets] Display secrets
 * @param {boolean} [options.rolls=false] Roll inline rolls. If false, the roll formula is shown instead as if /r had been used.
 * @param {boolean} [options.documents] Parse content links
 *
 * Synchronized with Foundry VTT v10.291
 */
export function enrichHTMLUnrolled(content, { rollData, secrets, rolls = false, documents, relativeTo } = {}) {
  let pcontent = TextEditor.enrichHTML(content, { secrets, rolls, documents, rollData, async: false, relativeTo });

  if (!rolls) {
    const html = document.createElement("div");
    html.innerHTML = String(pcontent);
    const text = TextEditor._getTextNodes(html);
    const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)(]{2,3})(?:{([^}]+)})?/gi;
    TextEditor._replaceTextContent(text, rgx, (match) => createInlineFormula(match, rollData));
    pcontent = html.innerHTML;
  }

  return pcontent;
}

/**
 * Resolve range formula to numeric value.
 *
 * @param {string} [formula] Range formula. Only used with "mi", "ft", "m", "km" and similar types.
 * @param {"melee"|"touch"|"reach"|"close"|"medium"|"long"|"mi"} [type="ft"] Formula type
 * @param {object} [rollData] Roll data for evaluating the formula
 * @returns {number} Range in feet for the defined formula
 */
export const calculateRangeFormula = (formula, type = "ft", rollData = {}) => {
  switch (type) {
    case "melee":
    case "touch":
      return rollData.range?.melee ?? 0;
    case "reach":
      return rollData.range?.reach ?? 0;
    case "close":
      return RollPF.safeRollSync(pf1.config.spellRangeFormulas.close, rollData).total;
    case "medium":
      return RollPF.safeRollSync(pf1.config.spellRangeFormulas.medium, rollData).total;
    case "long":
      return RollPF.safeRollSync(pf1.config.spellRangeFormulas.long, rollData).total;
    case "mi":
      return RollPF.safeRollSync(formula, rollData).total * 5_280;
    case "m":
      return (RollPF.safeRollSync(formula, rollData).total / 1.5) * 5;
    case "km":
      return ((RollPF.safeRollSync(formula, rollData).total * 1000) / 1.5) * 5;
    default:
      return RollPF.safeRollSync(formula, rollData).total;
  }
};

/**
 * Calculates range formula and converts it.
 *
 * Wrapper around {@link calculateRangeFormula} and {@link convertDistance}
 *
 * @example
 * Simple example
 * ```js
 * const [range,unit] = calculateRange("@level", "mi", { level:2 });
 * // => range:10560, unit:"ft"
 * ```
 *
 * @param {string} formula - Range formula
 * @param {string} type - Type fed to calculateRangeFormula
 * @param {object} rollData - Roll data fed to calculateRangeFormula
 * @returns {Array.<number, string>} - Range value and unit tuple
 */
export function calculateRange(formula, type = "ft", rollData = {}) {
  const value = calculateRangeFormula(formula, type, rollData);
  return convertDistance(value, type);
}

/**
 * Refreshes all actor data and re-renders sheets.
 *
 * @param {object} [options] - Additional options
 * @param {boolean} [options.renderOnly=false] - If false, actors are reset also.
 * @param {boolean} [options.renderForEveryone=false] - If true, other players are told to re-render, too.
 */
export function refreshActors({ renderOnly = false, renderForEveryone = false } = {}) {
  const resetOrRender = async (actor) => {
    if (!actor) return;
    if (!renderOnly) actor.reset();
    actor.render(true);
  };

  // Reset base actors
  game.actors.forEach(resetOrRender);

  // Reset unlinked actors in all scenes
  game.scenes.forEach((scene) =>
    scene.tokens
      .filter((t) => t.actor && !t.isLinked)
      .map((t) => t.actor)
      .forEach(resetOrRender)
  );

  if (renderForEveryone) {
    game.socket.emit("pf1", "refreshActorSheets");
  }
}

/**
 * Refresh all actor, item and action sheets.
 *
 * @param {object} [options] Additional options
 * @param {boolean} [options.reset=true] Reset underlying document.
 * @param {boolean} [options.actor] Include actor sheets
 * @param {boolean} [options.item] Include item sheets
 * @param {boolean} [options.action] Include action sheets
 */
export function refreshSheets({ reset = true, actor = true, item = true, action = true } = {}) {
  Object.values(ui.windows).forEach((app) => {
    if (
      (actor && app instanceof ActorSheet) ||
      (item && app instanceof ItemSheet) ||
      (action && app instanceof pf1.applications.component.ItemActionSheet)
    ) {
      if (reset && app.object instanceof Document) app.object.reset();
      else app.render();
    }
  });
}

/**
 * Turns dictionaries with numbered keys into arrays.
 *
 * @param {object} sourceObj The source object which contains the full array in the same path as targetObj.
 * @param {object} targetObj The target object to alter. The array doesn't have to be immediately in this object.
 * @param {string} keepPath A path to the array to keep, separated with dots. e.g. "system.damageParts".
 */
export function keepUpdateArray(sourceObj, targetObj, keepPath) {
  const newValue = foundry.utils.getProperty(targetObj, keepPath);
  if (newValue == null) return;
  if (Array.isArray(newValue)) return;

  const newArray = foundry.utils.deepClone(foundry.utils.getProperty(sourceObj, keepPath) || []);

  for (const [key, value] of Object.entries(newValue)) {
    if (foundry.utils.getType(value) === "Object") {
      const subData = foundry.utils.expandObject(value);
      newArray[key] = foundry.utils.mergeObject(newArray[key], subData);
    } else {
      newArray[key] = value;
    }
  }

  foundry.utils.setProperty(targetObj, keepPath, newArray);
}

/**
 * Deeply difference an object against some other, returning the update keys and values.
 * Unlike foundry.utils.diffObject, this function also deeply compares arrays.
 *
 * @param {object} original       An object comparing data against which to compare
 * @param {object} other          An object containing potentially different data
 * @param {object} [options={}]   Additional options which configure the diff operation
 * @param {boolean} [options.inner=false]  Only recognize differences in other for keys which also exist in original
 * @param {boolean} [options.keepLength=false]  Keep array length intact, possibly having to insert empty objects
 * @returns {object}               An object of the data in other which differs from that in original
 */
export const diffObjectAndArray = function (original, other, { inner = false, keepLength = false } = {}) {
  /**
   *
   * @param v0
   * @param v1
   */
  function _difference(v0, v1) {
    const t0 = getType(v0);
    const t1 = getType(v1);
    if (t0 !== t1) return [true, v1];
    if (t0 === "Array") {
      if (v0.length !== v1.length) return [true, v1];
      const d = [];
      for (let a = 0; a < v0.length; a++) {
        const d2 = diffObjectAndArray(v0[a], v1[a], { inner, keepLength });
        if (!foundry.utils.isEmpty(d2)) d.push(d2);
        else if (keepLength) d.push({});
      }
      if (d.length > 0) return [true, d];
      return [false, d];
    }
    if (t0 === "Object") {
      if (foundry.utils.isEmpty(v0) !== foundry.utils.isEmpty(v1)) return [true, v1];
      const d = diffObjectAndArray(v0, v1, { inner, keepLength });
      return [!foundry.utils.isEmpty(d), d];
    }
    return [v0 !== v1, v1];
  }

  // Recursively call the _difference function
  return Object.keys(other).reduce((obj, key) => {
    if (inner && !(key in original)) return obj;
    const [isDifferent, difference] = _difference(original[key], other[key]);
    if (isDifferent) obj[key] = difference;
    return obj;
  }, {});
};

/**
 * Determines what ability modifier is appropriate for a given score.
 *
 * @example
 * pf1.utils.getAbilityModifier(15); // => 2
 * pf1.utils.getAbilityModifier(6, { damage: 1 }); // => -2
 *
 * @param {number} [score] - The score to find the modifier for.
 * @param {object} [options={}] - Options for this function.
 * @param {number} [options.penalty=0] - A penalty value to take into account.
 * @param {number} [options.damage=0] - Ability score damage to take into account.
 * @returns {number} The modifier for the given score.
 */
export function getAbilityModifier(score = null, options = {}) {
  if (score != null) {
    const penalty = Math.abs(options.penalty ?? 0);
    const damage = Math.abs(options.damage ?? 0);
    return Math.max(-5, Math.floor((score - 10) / 2) - Math.floor(penalty / 2) - Math.floor(damage / 2));
  }
  return 0;
}

/**
 * Recursively transforms an ES module to a regular, writable object.
 *
 * @internal
 * @template T
 * @param {T} module - The ES module to transform.
 * @returns {T} The transformed module.
 */
export function moduleToObject(module) {
  const result = {};
  for (const key in module) {
    if (Object.prototype.toString.call(module[key]) === "[object Module]") {
      result[key] = moduleToObject(module[key]);
    } else {
      result[key] = module[key];
    }
  }
  return result;
}

/**
 * Set default scene scaling.
 *
 * `imperial` sets scaling to 5 ft, `metric` sets scaling to 1.5 m
 *
 * @param {UnitSystem | undefined} [system] System of units. Pull current setting if undefined.
 */
export function setDefaultSceneScaling(system) {
  system ??= getDistanceSystem();
  if (system == "metric") {
    game.system.gridUnits = "m";
    game.system.gridDistance = 1.5;
  } else {
    game.system.gridUnits = "ft";
    game.system.gridDistance = 5;
  }
}

/**
 * Create throttling function.
 *
 * Returned function will execute after defined delayed. Multiple calls will be discarded until the callback is executed and new timeout can start.
 *
 * @param {Function} callback - Callback function
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
export function throttle(callback, delay) {
  let timeoutId = -1;
  return () => {
    if (timeoutId <= 0) {
      timeoutId = setTimeout(() => {
        timeoutId = -1;
        callback();
      }, delay);
    }
    return timeoutId;
  };
}

/**
 * Get iterator for all actors.
 *
 * @param {object} [options] - Options for which actors to fetch.
 * @param {Array<string>|null} [options.types=null] - Array of actor types to accept. Returns all if null.
 * @param {boolean} [options.base=true] - Return base actors (from game.actors).
 * @param {string|Scene|null} [options.scene=null] - Specific scene. Sets `scenes` and `base` to false.
 * @param {boolean} [options.scenes=false] - All scenes.
 * @param {boolean} [options.linked=true] - Get linked actors from scenes.
 * @param {boolean} [options.unlinked=true] - Get unlinked actors from scenes.
 * @param {Array<string|User>} [options.users=[game.user]] - Test specific users permission, either User instances or user IDs. Defaults to current user.
 * @param {*} [options.ownership=CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER] - What permission level (`CONST.DOCUMENT_OWNERSHIP_LEVELS`) to test user for, if user is defined.
 *
 * @yields {Actor} - Relevant actors
 */
export function* getActors({
  base = true,
  types = null,
  scene = null,
  scenes = false,
  linked = true,
  unlinked = true,
  users = [game.user],
  ownership = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
} = {}) {
  users = users.map((user) => (user instanceof User ? user : game.users.get(user)));

  const testUsers = (actor) => (users.length ? users.some((user) => actor.testUserPermission(user, ownership)) : true);

  let actors;
  if (base) {
    for (const actor of [...game.actors]) {
      if (types && !types.includes(actor.type)) continue;
      if (!testUsers(actor)) continue;
      yield actor;
    }
  }

  let sceneList;
  if (scene) {
    if (scene instanceof Scene) sceneList = [scene];
    else sceneList = [game.scenes.get(scene)];
  } else if (scenes) {
    sceneList = [...game.scenes];
  }

  for (const scene of sceneList) {
    for (const token of [...scene.tokens]) {
      const actor = token.actor;
      if (!actor) continue;

      if (types && !types.includes(actor.type)) continue;

      // Test at least one user has appropriate ownership
      if (!testUsers(actor)) continue;

      const isLinked = token.isLinked;
      // Yield linked only if such are desired and we didn't already return base actors
      if (isLinked && linked && !base) yield actor;
      // Yield unlinked only if desired
      else if (!isLinked && unlinked) yield actor;
    }
  }
}

/**
 * Parse alignment string and provide breakdown of it.
 *
 * Each alignment is either 0 or 1, except for neutral which can reach 2 for true neutral.
 *
 * @param {string} align - Alignment string.
 * @returns {{lawful:number, evil:number, chaotic:number, good:number, neutral:number}}
 * @since PF1 vNEXT
 */
export function parseAlignment(align) {
  const lawful = align.includes("l") ? 1 : 0;
  const evil = align.includes("e") ? 1 : 0;
  const chaotic = align.includes("c") ? 1 : 0;
  const good = align.includes("g") ? 1 : 0;
  const neutral = align == "tn" ? 2 : align.includes("n") ? 1 : 0;
  return { lawful, evil, chaotic, good, neutral };
}
