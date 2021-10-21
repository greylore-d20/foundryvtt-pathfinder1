import { ListTabs } from "./misc/list-tabs.js";
import { SemanticVersion } from "./semver.js";
import { ItemPF } from "./item/entity.js";
import { ActorPF } from "./actor/entity.js";

/**
 * Creates a tag from a string.
 * For example, if you input the string "Wizard of Oz 2", you will get "wizardOfOz2"
 *
 * @param str
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
 * Alters a roll in string form.
 *
 * @param str
 * @param add
 * @param multiply
 */
export const alterRoll = function (str, add, multiply) {
  const rgx = /^([0-9]+)d([0-9]+)/;
  // const rgx = new RegExp(Die.rgx.die, "g");
  // if (str.match(/^([0-9]+)d([0-9]+)/)) {
  return str.replace(rgx, (match, nd, d, mods) => {
    nd = nd * (multiply || 1) + (add || 0);
    mods = mods || "";
    return (nd == null || Number.isNaN(nd) ? "" : nd) + "d" + d + mods;
  });
  // }
};

/**
 * Creates tabs for a sheet object
 *
 * @param html
 * @param tabGroups
 * @param existingTabs
 */
export const createTabs = function (html, tabGroups, existingTabs = null) {
  // Create recursive activation/callback function
  const _recursiveActivate = function (rtabs, tabName = null) {
    if (rtabs.__dormant) return;

    if (tabName == null) this._initialTab[rtabs.group] = rtabs.active;
    else {
      rtabs.activate(tabName);
      this._initialTab[rtabs.group] = tabName;
    }

    // Recursively activate tabs
    for (const subTab of rtabs.subTabs) {
      _recursiveActivate.call(this, subTab, subTab.active);
    }
  };

  // Recursively bind tabs
  const _recursiveBind = function (rtabs) {
    rtabs.bind(html[0]);

    if (html.find(`nav[data-group="${rtabs.group}"]`).length > 0) rtabs.__dormant = false;
    else rtabs.__dormant = true;

    for (const subTab of rtabs.subTabs) {
      _recursiveBind.call(this, subTab);
    }
  };

  // Create all tabs
  const _func = function (group, children, tabs = null) {
    let dormant = false;
    if (html.find(`nav[data-group="${group}"]`).length === 0) dormant = true;

    if (this._initialTab == null) this._initialTab = {};

    const subHtml = html.find(`.${group}-body > div[data-group="${group}"]`);
    const activeSubHtml = subHtml.filter(".active");
    const initial =
      this._initialTab[group] !== undefined
        ? this._initialTab[group]
        : activeSubHtml.length > 0
        ? activeSubHtml[0].dataset.tab
        : "";

    // Set up data for scroll position and active tab
    if (this._initialTab[group] === undefined) this._initialTab[group] = initial;

    // Determine tab type
    const tabsElem = html.find(`.tabs[data-group="${group}"]`)[0];
    let cls = TabsV2;
    if (tabsElem) {
      const type = tabsElem.dataset.tabsType;
      if (type === "list") {
        cls = ListTabs;
      }
    }

    // Create tabs object
    if (!tabs) {
      tabs = new cls({
        navSelector: `.tabs[data-group="${group}"]`,
        contentSelector: `.${group}-body`,
        initial,
        callback: (_, tabs) => {
          _recursiveActivate.call(this, tabs);
        },
      });
      tabs.__dormant = dormant;

      // Recursively create tabs
      tabs.group = group;
      tabs.subTabs = [];
      for (const [childKey, subChildren] of Object.entries(children)) {
        const childTabs = _func.call(this, childKey, subChildren);
        if (childTabs != null) {
          tabs.subTabs.push(childTabs);
          childTabs.parent = tabs;
        }
      }
    }

    _recursiveBind.call(this, tabs);
    return tabs;
  };

  for (const groupKey of Object.keys(tabGroups)) {
    return _func.call(this, groupKey, tabGroups[groupKey], existingTabs);
  }
};

/**
 * @param {string} version - A version string to unpack. Must be something like '0.5.1'.
 * @returns {object} An object containing the keys 'release', 'major', and 'minor', which are numbers.
 */
export const unpackVersion = function (version) {
  if (version.match(/^([0-9]+)\.([0-9]+)(?:\.([0-9]+))?$/)) {
    return {
      release: parseInt(RegExp.$1),
      major: parseInt(RegExp.$2),
      minor: parseInt(RegExp.$3) || null,
    };
  }
};

/**
 * @param {string} version - The minimum core version to compare to. Must be something like '0.5.1'.
 * @returns {boolean} Whether the current core version is at least the given version.
 */
export const isMinimumCoreVersion = function (version) {
  const coreVersion = SemanticVersion.fromString(game.data.version);
  const compareVersion = SemanticVersion.fromString(version);

  return !coreVersion.isLowerThan(compareVersion);
};

export const degtorad = function (degrees) {
  return (degrees * Math.PI) / 180;
};

export const radtodeg = function (radians) {
  return (radians / 180) * Math.PI;
};

export const linkData = function (expanded, flattened, key, value) {
  setProperty(expanded, key, value);
  flattened[key] = value;
};

export const getItemOwner = function (item) {
  if (item.actor) return item.actor;
  if (item._id) {
    return game.actors.contents.filter((o) => {
      return o.items.filter((i) => i._id === item._id).length > 0;
    })[0];
  }
  return null;
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

  fromNumber(value) {
    if (value === 0.125) return "1/8";
    if (value === 0.1625) return "1/6";
    if (value === 0.25) return "1/4";
    if (value === 0.3375) return "1/3";
    if (value === 0.5) return "1/2";
    if (!Number.isNumeric(value)) return "0";
    return value.toString();
  },
};

export const sizeDieExt = function (origCount, origSides, targetSize = "M", initialSize = "M") {
  const _getSizeIndex = function (size) {
    if (typeof size === "string") return Object.values(CONFIG.PF1.sizeChart).indexOf(size.toUpperCase());
    return size;
  };
  targetSize = _getSizeIndex(targetSize);
  initialSize = _getSizeIndex(initialSize);
  let skipWarning = false;

  // D10 special rule: https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9t3f
  if (origCount > 1 && origSides === 10 && (origCount % 2 === 0 || origCount === 3)) {
    skipWarning = true;
    const d10Arr = [
      { orig: [2, 10], larger: [4, 8], smaller: [2, 8] },
      { orig: [3, 10], larger: [6, 8], smaller: [3, 8] },
      { orig: [4, 10], larger: [8, 8], smaller: [4, 8] },
      { orig: [6, 10], larger: [12, 8], smaller: [6, 8] },
      { orig: [8, 10], larger: [16, 8], smaller: [8, 8] },
    ];
    for (const v of d10Arr) {
      if (v.orig[0] === origCount && v.orig[1] === origSides) {
        if (targetSize < initialSize) {
          initialSize--;
          origCount = v.smaller[0];
          origSides = v.smaller[1];
        } else if (targetSize > initialSize) {
          initialSize++;
          origCount = v.larger[0];
          origSides = v.larger[1];
        }
      }
    }
  }

  // Get initial die type
  const mediumDie = `${origCount}d${origSides}`;
  const mediumDieMax = origCount * origSides;
  let c = duplicate(CONFIG.PF1.sizeDie);
  {
    if (c.indexOf(mediumDie) === -1) {
      c = c.map((d) => {
        if (d.match(/^([0-9]+)d([0-9]+)$/)) {
          const dieCount = parseInt(RegExp.$1);
          const dieSides = parseInt(RegExp.$2);
          const dieMaxValue = dieCount * dieSides;

          if (dieMaxValue === mediumDieMax) return mediumDie;
        }

        return d;
      });
    }
  }

  // Pick an index from the chart
  let index = c.indexOf(mediumDie),
    formula = mediumDie;
  if (index >= 0) {
    const d6Index = c.indexOf("1d6");
    let d8Index = c.indexOf("1d8");
    if (d8Index === -1) d8Index = c.indexOf("2d4");
    let sizeOffset = initialSize - targetSize;
    let curSize = initialSize;

    // When decreasing in size (e.g. from medium to small)
    while (sizeOffset > 0) {
      if (curSize <= 4 || index <= d8Index) {
        index--;
        sizeOffset--;
        curSize--;
      } else {
        index -= 2;
        sizeOffset--;
        curSize--;
      }
    }
    // When increasing in size (e.g. from medium to large)
    while (sizeOffset < 0) {
      if (curSize <= 3 || index <= d6Index) {
        index++;
        sizeOffset++;
        curSize++;
      } else {
        index += 2;
        sizeOffset++;
        curSize++;
      }
    }

    index = Math.max(0, Math.min(c.length - 1, index));
    formula = c[index];
  }

  if (index === -1 && !skipWarning) {
    const msg = game.i18n.localize("PF1.WarningNoSizeDie").format(mediumDie, formula);
    console.warn(msg);
    ui.notifications.warn(msg);
  }

  const result = formula.split("d");
  if (result.length === 1) {
    return [new NumericTerm({ number: parseInt(result[0]) })];
  }
  return [new Die({ number: parseInt(result[0]), faces: parseInt(result[1]) })];
};

export const sizeDie = function (origCount, origSides, targetSize = "M") {
  return sizeDieExt(origCount, origSides, targetSize);
};

export const normalDie = function (origCount, origSides, crit = 1) {
  return [new Die({ number: origCount * crit, faces: origSides })];
};

export const sizeReach = function (size = "M", reach = false, stature = "tall") {
  if (typeof size === "number") size = Object.values(CONFIG.PF1.sizeChart)[size];
  size = Object.entries(CONFIG.PF1.sizeChart).find((o) => o[1] === size)[0];

  return [new NumericTerm({ number: ActorPF.getReach(size, stature)[reach ? "reach" : "melee"] })];
};

/**
 * Returns the result of a roll of die, which changes based on different sizes.
 *
 * @param {number} origCount - The original number of die to roll.
 * @param {number} origSides - The original number of sides per die to roll.
 * @param {string|number} [targetSize="M"] - The target size to change the die to.
 *   Can be a string of values "F", "D", "T", "S", "M", "L", "H", "G" or "C" for the different sizes.
 *   Can also be a number in the range of -4 to 4, where 0 is Medium.
 * @param {string|number} [initialSize="M"] - The initial size of the creature. See targetSize above.
 * @returns {number} The result of the new roll.
 */
export const sizeRoll = function (origCount, origSides, targetSize = "M", initialSize = "M") {
  return RollPF.safeRoll(sizeDieExt(origCount, origSides, targetSize, initialSize)).total;
};

/**
 * Returns the result of a roll of die.
 *
 * @param {number} count - The original number of die to roll.
 * @param {number} sides - The original number of sides per die to roll.
 * @param crit
 * @returns {number} The result of the new roll.
 */
export const normalRoll = function (count, sides, crit = 1) {
  return RollPF.safeRoll(normalDie(count, sides, crit)).total;
};

export const getActorFromId = function (id) {
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
 * @param {number} value - The value (in feet) to convert.
 * @param {string} type - The original type to convert from. Either 'ft' (feet, default) or 'mi' (miles, in which case the result is in km (metric))
 * @returns {Array.<number, string>} An array containing the converted value in index 0 and the new unit key in index 1 (for use in CONFIG.PF1.measureUnits, for example)
 */
export const convertDistance = function (value, type = "ft") {
  let system = game.settings.get("pf1", "distanceUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  switch (system) {
    case "metric":
      switch (type) {
        case "mi":
          return [Math.round(value * 1.6 * 100) / 100, "km"];
        default:
          return [Math.round((value / 5) * 1.5 * 100) / 100, "m"];
      }
    default:
      return [value, type];
  }
};

/**
 * Converts lbs to what the world is using as a measurement unit.
 *
 * @param {number} value - The value (in lbs) to convert.
 * @returns {number} The converted value. In the case of the metric system, converts to kg.
 */
export const convertWeight = function (value) {
  let system = game.settings.get("pf1", "weightUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  switch (system) {
    case "metric":
      return Math.round((value / 2) * 100) / 100; // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
    default:
      return value;
  }
};

/**
 * Converts back to lbs from what the world is using as a measurement unit.
 *
 * @param {number} value - The value to convert back to lbs.
 * @returns {number} The converted value. In the case of the metric system, converts from kg.
 */
export const convertWeightBack = function (value) {
  let system = game.settings.get("pf1", "weightUnits"); // override
  if (system === "default") system = game.settings.get("pf1", "units");
  switch (system) {
    case "metric":
      return Math.round(value * 2 * 100) / 100; // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
    default:
      return value;
  }
};

/**
 * Like Foundry's default expandObject function, except it can make arrays
 *
 * @param obj
 * @param options
 * @param _d
 */
export const expandObjectExt = function (obj, options = { makeArrays: true }, _d = 0) {
  const setPropertyExt = function (object, key, value) {
    let target = object;
    let changed = false;

    // Convert the key to an object reference if it contains dot notation
    if (key.indexOf(".") !== -1) {
      const parts = key.split(".");
      key = parts.pop();
      target = parts.reduce((o, i, a) => {
        const nextKey = parts.length > a ? parts[a + 1] : null;
        if (!Object.prototype.hasOwnProperty.call(o, i)) {
          if (((nextKey && nextKey.match(/^[0-9]+$/)) || (!nextKey && key.match(/^[0-9]+$/))) && options.makeArrays)
            o[i] = [];
          else o[i] = {};
        }
        return o[i];
      }, object);
    }

    // Update the target
    if (target[key] !== value) {
      changed = true;
      target[key] = value;
    }

    // Return changed status
    return changed;
  };

  const expanded = {};
  if (_d > 10) throw new Error("Maximum depth exceeded");
  for (let [k, v] of Object.entries(obj)) {
    if (v instanceof Object && !Array.isArray(v)) {
      v = expandObjectExt(v, options, _d + 1);
    }
    setPropertyExt(expanded, k, v);
  }
  return expanded;
};

export const mergeObjectExt = function (
  original,
  other = {},
  {
    insertKeys = true,
    insertValues = true,
    overwrite = true,
    inplace = true,
    enforceTypes = false,
    makeArrays = true,
  } = {},
  _d = 0
) {
  other = other || {};
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error("One of original or other are not Objects!");
  }
  const depth = _d + 1;

  // Maybe copy the original data at depth 0
  if (!inplace && _d === 0) original = duplicate(original);

  // Enforce object expansion at depth 0
  if (_d === 0 && Object.keys(original).some((k) => /\./.test(k)))
    original = expandObjectExt(original, { makeArrays: makeArrays });
  if (_d === 0 && Object.keys(other).some((k) => /\./.test(k))) other = expandObject(other, { makeArrays: makeArrays });

  // Iterate over the other object
  for (let [k, v] of Object.entries(other)) {
    const tv = getType(v);

    // Prepare to delete
    let toDelete = false;
    if (k.startsWith("-=")) {
      k = k.slice(2);
      toDelete = v === null;
    }

    // Get the existing object
    let x = original[k];
    let has = Object.prototype.hasOwnProperty.call(original, k);
    let tx = getType(x);

    // Ensure that inner objects exist
    if (!has && tv === "Object") {
      x = original[k] = {};
      has = true;
      tx = "Object";
    }

    // Case 1 - Key exists
    if (has) {
      // 1.1 - Recursively merge an inner object
      if (tv === "Object" && tx === "Object") {
        mergeObjectExt(
          x,
          v,
          {
            insertKeys: insertKeys,
            insertValues: insertValues,
            overwrite: overwrite,
            inplace: true,
            enforceTypes: enforceTypes,
            makeArrays: makeArrays,
          },
          depth
        );
      }

      // 1.2 - Remove an existing key
      else if (toDelete) {
        delete original[k];
      }

      // 1.3 - Overwrite existing value
      else if (overwrite) {
        if (tx && tv !== tx && enforceTypes) {
          throw new Error(`Mismatched data types encountered during object merge.`);
        }
        original[k] = v;
      }

      // 1.4 - Insert new value
      else if (x === undefined && insertValues) {
        original[k] = v;
      }
    }

    // Case 2 - Key does not exist
    else if (!toDelete) {
      const canInsert = (depth === 1 && insertKeys) || (depth > 1 && insertValues);
      if (canInsert) original[k] = v;
    }
  }

  // Return the object for use
  return original;
};

export const naturalSort = function (arr, propertyKey = "") {
  return arr.sort((a, b) => {
    const propA = propertyKey ? getProperty(a, propertyKey) : a;
    const propB = propertyKey ? getProperty(b, propertyKey) : b;
    return new Intl.Collator(game.settings.get("core", "language"), { numeric: true }).compare(propA, propB);
  });
};

export const createConsumableSpellDialog = function (itemData, { allowSpell = true } = {}) {
  return new Promise((resolve) => {
    const dialogData = {
      title: game.i18n.localize("PF1.CreateItemForSpell").format(itemData.name),
      content: game.i18n.localize("PF1.CreateItemForSpell").format(itemData.name),
      buttons: {
        potion: {
          icon: '<i class="fas fa-prescription-bottle"></i>',
          label: game.i18n.localize("PF1.CreateItemPotion"),
          callback: () => resolve(createConsumableSpell(itemData, "potion")),
        },
        scroll: {
          icon: '<i class="fas fa-scroll"></i>',
          label: game.i18n.localize("PF1.CreateItemScroll"),
          callback: () => resolve(createConsumableSpell(itemData, "scroll")),
        },
        wand: {
          icon: '<i class="fas fa-magic"></i>',
          label: game.i18n.localize("PF1.CreateItemWand"),
          callback: () => resolve(createConsumableSpell(itemData, "wand")),
        },
        spell: {
          icon: '<i class="fas fa-hand-sparkles"></i>',
          label: game.i18n.localize("PF1.ItemTypeSpell"),
          callback: () => resolve("spell"),
        },
      },
      close: () => {
        resolve(false);
      },
      default: "potion",
    };
    if (!allowSpell) delete dialogData.buttons.spell;
    new Dialog(dialogData, { classes: ["dialog", "pf1", "create-consumable"] }).render(true);
  });
};

export const createConsumableSpell = async function (itemData, type) {
  const data = await ItemPF.toConsumable(itemData, type);

  if (data._id) delete data._id;
  return data;
};

export const adjustNumberByStringCommand = function (initialValue, cmdStr, maxValue = null) {
  let result = initialValue;

  if (cmdStr.match(/(=)?([+-]+)?(\d+)/)) {
    const operator = RegExp.$2;
    const isAbsolute = RegExp.$1 == "=" || ["--", "++"].includes(operator) || (!RegExp.$1 && !RegExp.$2);
    const isNegative = ["-", "--"].includes(operator);
    const rawValue = parseInt(RegExp.$3, 10);
    const value = isNegative ? -rawValue : rawValue;
    result = isAbsolute ? value : initialValue + value;
  } else {
    result = parseFloat(cmdStr || "0");
  }

  if (maxValue) result = Math.min(result, maxValue);
  if (Number.isNaN(result)) result = initialValue;

  return result;
};

export const colorToInt = function (color) {
  const rgb = color.rgb().color;
  const integer =
    ((Math.round(rgb[0]) & 0xff) << 16) + ((Math.round(rgb[1]) & 0xff) << 8) + (Math.round(rgb[2]) & 0xff);

  return integer;
};

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
 * @returns {object.<string, BuffTargetItem>} The resulting array of buff targets.
 */
export const getBuffTargets = function (actor, type = "buffs") {
  const buffTargets = duplicate(
    {
      buffs: CONFIG.PF1.buffTargets,
      contextNotes: CONFIG.PF1.contextNoteTargets,
    }[type]
  );

  // Append individual skills to buff targets
  if (actor) {
    for (const s of actor._skillTargets) {
      const sId = s.split(".").slice(1).join(".");
      const skill = actor.getSkillInfo(sId);
      buffTargets[s] = { label: skill.name, category: "skill" };
    }
  } else {
    for (const [k, v] of Object.entries(CONFIG.PF1.skills)) {
      buffTargets[`skill.${k}`] = { label: v, category: "skill" };
    }
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
  const targetCategories = duplicate(
    {
      buffs: CONFIG.PF1.buffTargetCategories,
      contextNotes: CONFIG.PF1.contextNoteCategories,
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
 *
 * @template T
 * @param {Array.<T & {name: string}>} inputArr - Array to be sorted. Each element must have a name property set
 * @returns {T[]} - New sorted Array
 */
export const sortArrayByName = function (inputArr) {
  const n = inputArr.length;
  inputArr = duplicate(inputArr).map((o) => {
    o.name = o.name.toLocaleLowerCase();
    return o;
  });
  for (let i = 1; i < n; i++) {
    const current = inputArr[i],
      currentLower = current.name;
    let j = i - 1;
    while (j > -1 && currentLower.localeCompare(inputArr[j].name, undefined, { ignorePunctuation: true }) < 0) {
      inputArr[j + 1] = inputArr[j];
      j--;
    }
    inputArr[j + 1] = current;
  }
  return inputArr;
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
  const total = new Set();
  if (perm.length > 7) {
    console.warn("Array too large. Not attempting.");
    return false;
  }

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
 * @returns {{pack: CompendiumCollection, index: object}|undefined} The index and pack containing it or undefined if no match is found
 */
export const findInCompendia = function (searchTerm, options = { packs: [], type: undefined }) {
  let packs;
  if (options?.packs && options.packs.length) packs = options.packs.flatMap((o) => game.packs.get(o) ?? []);
  else packs = game.packs.filter((o) => !options?.type || o.metadata.entity == options.type);

  searchTerm = searchTerm.toLocaleLowerCase();
  let found, foundDoc, foundPack;
  for (const pack of packs) {
    if (!pack.fuzzyIndex) pack.fuzzyIndex = sortArrayByName([...pack.index]);
    found = binarySearch(pack.fuzzyIndex, searchTerm, (sp, it) =>
      sp.localeCompare(it.name, undefined, { ignorePunctuation: true })
    );
    if (found > -1) {
      foundDoc = pack.index.get(pack.fuzzyIndex[found]._id);
      foundPack = pack;
      break;
    }
  }
  if (foundDoc) return { pack: foundPack, index: foundDoc };

  let searchMutations = uniquePermutations(searchTerm.split(/[ _-]/));
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
    // Skip first mutation since it is already searched for manually before computing mutations
    for (let mut = 1; mut < searchMutations.length; mut++) {
      found = binarySearch(pack.fuzzyIndex, searchMutations[mut], (sp, it) =>
        sp.localeCompare(it.name, undefined, { ignorePunctuation: true })
      );
      if (found > -1) {
        foundDoc = pack.index.get(pack.fuzzyIndex[found]._id);
        foundPack = pack;
        break;
      }
    }
    if (foundDoc) break;
  }

  if (foundDoc) return { pack: foundPack, index: foundDoc };
  return false;
};

/**
 * Variant of TextEditor._createInlineRoll for creating unrolled inline rolls.
 *
 * @param _match
 * @param _command
 * @param formula
 * @param closing
 * @param label
 * @param {...any} args
 */
export function createInlineFormula(_match, _command, formula, closing, label, ...args) {
  const rollData = args.pop();
  if (closing.length === 3) formula += "]"; // What does this even do?

  const e_formula = Roll.replaceFormulaData(formula, rollData, { missing: 0, warn: true });
  const cls = ["inline-preroll", "inline-formula"];
  label = label ? `${label}: ${e_formula}` : e_formula;

  // Format return value
  const a = document.createElement("a");
  a.classList.add(...cls);
  a.title = formula;
  a.innerHTML = `<i class="fas fa-dice-d20"></i> ${label}`;
  return a;
}

/**
 * enrichHTML but with inline rolls not rolled
 *
 * @param content
 * @param root0
 * @param root0.rollData
 * @param root0.secrets
 * @param root0.rolls
 * @param root0.entities
 */
export function enrichHTMLUnrolled(content, { rollData, secrets, rolls, entities } = {}) {
  let pcontent = TextEditor.enrichHTML(content, { secrets, rolls, entities, rollData });

  if (!rolls) {
    const html = document.createElement("div");
    html.innerHTML = String(pcontent);
    const text = TextEditor._getTextNodes(html);
    const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})(?:{([^}]+)})?/gi;
    TextEditor._replaceTextContent(text, rgx, (...args) => createInlineFormula(...args, rollData));
    pcontent = html.innerHTML;
  }

  return pcontent;
}

/**
 * Split copper currency into gold, silver and copper.
 *
 * @param cp
 */
export const splitCurrency = (cp) => {
  const gp = Math.floor(cp / 100);
  const sp = Math.floor(cp / 10) - gp * 10;
  cp = cp - gp * 100 - sp * 10;
  return {
    gp: Math.max(0, gp),
    sp: Math.max(0, sp),
    cp: Math.max(0, cp),
  };
};

/**
 * Get first active GM user.
 *
 * @returns {User}
 */
export const getFirstActiveGM = function () {
  return game.users.filter((u) => u.active && u.isGM).sort((a, b) => b.id - a.id)[0];
};
