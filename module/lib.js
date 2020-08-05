import { ListTabs} from "./misc/list-tabs.js";

/**
* Creates a tag from a string.
* For example, if you input the string "Wizard of Oz 2", you will get "wizardOfOz2"
*/
export const createTag = function(str) {
  if (str.length === 0) str = "tag";
  return str.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).map((s, a) => {
    s = s.toLowerCase();
    if (a > 0) s = s.substring(0, 1).toUpperCase() + s.substring(1);
    return s;
  }).join("");
};

/**
* Alters a roll in string form.
*/
export const alterRoll = function(str, add, multiply) {
  const rgx = /^([0-9]+)d([0-9]+)/;
  // const rgx = new RegExp(Die.rgx.die, "g");
  // if (str.match(/^([0-9]+)d([0-9]+)/)) {
  return str.replace(rgx, (match, nd, d, mods) => {
    nd = (nd * (multiply || 1)) + (add || 0);
    mods = mods || "";
    return ((nd == null || Number.isNaN(nd)) ? "" : nd) + "d" + d + mods;
  });
  // }
  return str;
};

/**
* Creates tabs for a sheet object
*/
export const createTabs = function(html, tabGroups) {
  // Create recursive activation/callback function
  const _recursiveActivate = function(rtabs, tabName=null) {
    if (tabName == null) this._initialTab[rtabs.group] = rtabs.active;
    else {
      rtabs.activate(tabName);
      this._initialTab[rtabs.group] = tabName;
    }
    
    // Scroll to previous position
    let scrollElems = html.find(`.scroll-${rtabs.group}`);
    if (scrollElems.length === 0) scrollElems = html.find(`.tab[data-group="${rtabs.group}"]`);
    for (let o of scrollElems) {
      const scrollIndex = o.dataset.scrollIndex || rtabs.group;
      o.scrollTop = this._scrollTab[scrollIndex];
    }
    
    // Recursively activate tabs
    for (let subTab of rtabs.subTabs) {
      _recursiveActivate.call(this, subTab, subTab.active);
    }
  };
  
  // Create all tabs
  const _func = function(group, children) {
    if (html.find(`nav[data-group="${group}"]`).length === 0) return null;
    
    if (this._initialTab == null) this._initialTab = {};
    if (this._scrollTab == null) this._scrollTab = {};
    
    const subHtml = html.find(`.${group}-body > div[data-group="${group}"]`);
    const activeSubHtml = subHtml.filter(".active");
    const initial = this._initialTab[group] !== undefined ? this._initialTab[group] : (activeSubHtml.length > 0 ? activeSubHtml[0].dataset.tab : "");
    
    // Set up data for scroll position and active tab
    if (this._scrollTab[group] === undefined) this._scrollTab[group] = 0;
    if (this._initialTab[group] === undefined) this._initialTab[group] = initial;
    
    // Set up scrolling callback
    let scrollElems = html.find(`.scroll-${group}`);
    if (scrollElems.length === 0) scrollElems = html.find(`.tab[data-group="${group}"]`);
    scrollElems.scroll(ev => {
      const scrollIndex = ev.currentTarget.dataset.scrollIndex || group;
      this._scrollTab[scrollIndex] = ev.currentTarget.scrollTop;
    });
    
    // Determine tab type
    const tabsElem = html.find(`.tabs[data-group="${group}"]`)[0];
    if (!tabsElem) return;
    let type = tabsElem.dataset.tabsType;
    let cls = isMinimumCoreVersion("0.7.0") ? Tabs : TabsV2;
    if (type === "list") {
      cls = ListTabs;
    }
    
    // Create tabs object
    const tabs = new cls({
      navSelector: `.tabs[data-group="${group}"]`,
      contentSelector: `.${group}-body`,
      callback: (_, tabs) => {
        _recursiveActivate.call(this, tabs);
      },
    });
    
    // Recursively create tabs
    tabs.group = group;
    tabs.subTabs = [];
    for (let [childKey, subChildren] of Object.entries(children)) {
      const newTabs = _func.call(this, childKey, subChildren);
      if (newTabs != null) tabs.subTabs.push(newTabs);
    }
    
    tabs.bind(html[0]);
    _recursiveActivate.call(this, tabs, this._initialTab[group]);
    return tabs;
  };
  
  for (const groupKey of Object.keys(tabGroups)) {
    _func.call(this, groupKey, tabGroups[groupKey]);
  }
};

/**
* @param {String} version - A version string to unpack. Must be something like '0.5.1'.
* @returns {Object} An object containing the keys 'release', 'major', and 'minor', which are numbers.
*/
export const unpackVersion = function(version) {
  if (version.match(/^([0-9]+)\.([0-9]+)(?:\.([0-9]+))?$/)) {
    return {
      release: parseInt(RegExp.$1),
      major: parseInt(RegExp.$2),
      minor: parseInt(RegExp.$3) || null,
    };
  }
};

/**
* @param {String} version - The minimum core version to compare to. Must be something like '0.5.1'.
* @returns {Boolean} Whether the current core version is at least the given version.
*/
export const isMinimumCoreVersion = function(version) {
  const coreVersion = unpackVersion(game.data.version);
  const compareVersion = unpackVersion(version);
  
  for (const versionType of ["release", "major", "minor"]) {
    const curValue = coreVersion[versionType];
    const compareValue = compareVersion[versionType];
    
    if (curValue == null) {
      if (compareValue == null) continue;
      return false;
    }
    if (compareValue == null) {
      if (curValue == null) continue;
      return true;
    }
    
    if (curValue > compareValue) return true;
    if (curValue < compareValue) return false;
  }
  
  return true;
};

export const degtorad = function(degrees) {
  return degrees * Math.PI / 180;
};

export const radtodeg = function(radians) {
  return radians / 180 * Math.PI;
};

export const linkData = function(expanded, flattened, key, value) {
  setProperty(expanded, key, value);
  flattened[key] = value;
};

export const getItemOwner = function(item) {
  if (item.actor) return item.actor;
  if (item._id) {
    return game.actors.entities.filter(o => {
      return o.items.filter(i => i._id === item._id).length > 0;
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
    return value.toString();
  },
};

export const sizeDie = function(origCount, origSides, targetSize="M", crit=1) {
  if (typeof targetSize === "string") targetSize = Object.values(CONFIG.PF1.sizeChart).indexOf(targetSize.toUpperCase());
  else if (typeof targetSize === "number") targetSize = Math.max(0, Math.min(Object.values(CONFIG.PF1.sizeChart).length - 1, Object.values(CONFIG.PF1.sizeChart).indexOf("M") + targetSize));
  let c = duplicate(CONFIG.PF1.sizeDie);
  
  const mediumDie = `${origCount}d${origSides}`;
  const mediumDieMax = origCount * origSides;
  if (c.indexOf(mediumDie) === -1) {
    c = c.map(d => {
      if (d.match(/^([0-9]+)d([0-9]+)$/)) {
        const dieCount = parseInt(RegExp.$1),
        dieSides = parseInt(RegExp.$2),
        dieMaxValue = dieCount * dieSides;
        
        if (dieMaxValue === mediumDieMax) return mediumDie;
      }
      
      return d;
    });
  }
  
  // Pick an index from the chart
  let index = c.indexOf(mediumDie),
  formula = mediumDie;
  if (index >= 0) {
    const d6Index = c.indexOf("1d6");
    let d8Index = c.indexOf("1d8");
    if (d8Index === -1) d8Index = c.indexOf("2d4");
    let curSize = 4;
    
    // When decreasing in size (e.g. from medium to small)
    while (curSize > targetSize) {
      if (curSize <= 4 || index <= d8Index) {
        index--;
        curSize--;
      }
      else {
        index -= 2;
        curSize--;
      }
    }
    // When increasing in size (e.g. from medium to large)
    while (curSize < targetSize) {
      if (curSize <= 3 || index <= d6Index) {
        index++;
        curSize++;
      }
      else {
        index += 2;
        curSize++;
      }
    }
    
    // Alter crit
    index = Math.max(0, Math.min(c.length - 1, index));
    formula = c[index];
  }
  
  // if (crit !== 1 && formula.match(/^([0-9]+)d([0-9]+)(.*)/)) {
    // const count = parseInt(RegExp.$1);
    // const sides = parseInt(RegExp.$2);
    // formula = `${count * crit}d${sides}${RegExp.$3}`;
  // }
  if (index === -1) {
    ui.notifications.warn(game.i18n.localize("PF1.WarningNoSizeDie").format(mediumDie, formula));
  }
  
  return formula;
};

export const normalDie = function(origCount, origSides, crit=1) {
  let formula = `${origCount}d${origSides}`;
  
  if (crit !== 1 && formula.match(/^([0-9]+)d([0-9]+)(.*)/)) {
    const count = parseInt(RegExp.$1);
    const sides = parseInt(RegExp.$2);
    formula = `${count * crit}d${sides}${RegExp.$3}`;
  }
  
  return formula;
};

/**
* Returns the result of a roll of die, which changes based on different sizes.
* @param {number} origCount - The original number of die to roll.
* @param {number} origSides - The original number of sides per die to roll.
* @param {string|number} [targetSize="M"] - The target size to change the die to.
* @param {number} [crit=1] - The critical multiplier (for if the attack is a critical threat).
*   Can be a string of values "F", "D", "T", "S", "M", "L", "H", "G" or "C" for the different sizes.
*   Can also be a number in the range of -4 to 4, where 0 is Medium.
* @returns {number} The result of the new roll.
*/
export const sizeRoll = function(origCount, origSides, targetSize="M", crit=1) {
  return new Roll(sizeDie(origCount, origSides, targetSize, crit)).roll().total;
};

/**
* Returns the result of a roll of die.
* @param {number} count - The original number of die to roll.
* @param {number} sides - The original number of sides per die to roll.
* @returns {number} The result of the new roll.
*/
export const normalRoll = function(count, sides, crit=1) {
  return new Roll(normalDie(count, sides, crit)).roll().total;
};

export const getActorFromId = function(id) {
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
* @param {Number} value - The value (in feet) to convert.
* @param {String} type - The original type to convert from. Either 'ft' (feet, default) or 'mi' (miles, in which case the result is in km (metric))
* @returns {Array.<Number, String>} An array containing the converted value in index 0 and the new unit key in index 1 (for use in CONFIG.PF1.measureUnits, for example)
*/
export const convertDistance = function(value, type="ft") {
  switch (game.settings.get("pf1", "units")) {
    case "metric":
    switch (type) {
      case "mi":
      return [Math.round((value * 1.6) * 100) / 100, "km"];
      default:
      return [Math.round((value / 5 * 1.5) * 100) / 100, "m"];
    }
    default:
    return [value, type];
  }
};

/**
* Converts lbs to what the world is using as a measurement unit.
* @param {Number} value - The value (in lbs) to convert.
* @returns {Number} The converted value. In the case of the metric system, converts to kg.
*/
export const convertWeight = function(value) {
  switch (game.settings.get("pf1", "units")) {
    case "metric":
    return Math.round((value / 2) * 100) / 100; // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
    default:
    return value;
  }
};

/**
* Converts back to lbs from what the world is using as a measurement unit.
* @param {Number} value - The value to convert back to lbs.
* @returns {Number} The converted value. In the case of the metric system, converts from kg.
*/
export const convertWeightBack = function(value) {
  switch (game.settings.get("pf1", "units")) {
    case "metric":
    return Math.round((value * 2) * 100) / 100; // 1 kg is not exactly 2 lb but this conversion is officially used by Paizo/BBE
    default:
    return value;
  }
};

/**
* Like Foundry's default expandObject function, except it can make arrays
*/
export const expandObjectExt = function(obj, options={makeArrays: true}, _d=0) {
  const setPropertyExt = function(object, key, value) {
    let target = object;
    let changed = false;
    
    // Convert the key to an object reference if it contains dot notation
    if ( key.indexOf('.') !== -1 ) {
      let parts = key.split('.');
      key = parts.pop();
      target = parts.reduce((o, i, a) => {
        const nextKey = (parts.length > a) ? parts[a+1] : null;
        if ( !o.hasOwnProperty(i) ) {
          if (((nextKey && nextKey.match(/^[0-9]+$/))
          || (!nextKey && key.match(/^[0-9]+$/)))
          && options.makeArrays) o[i] = [];
          else o[i] = {};
        }
        return o[i];
      }, object);
    }
    
    // Update the target
    if ( target[key] !== value ) {
      changed = true;
      target[key] = value;
    }
    
    // Return changed status
    return changed;
  };
  
  let expanded = {};
  if (_d > 10) throw new Error("Maximum depth exceeded");
  for (let [k, v] of Object.entries(obj)) {
    if (v instanceof Object && !Array.isArray(v)) {
      v = expandObjectExt(v, options, _d+1);
    }
    setPropertyExt(expanded, k, v);
  }
  return expanded;
};

export const mergeObjectExt = function(original, other={}, {
  insertKeys=true, insertValues=true, overwrite=true, inplace=true, enforceTypes=false, makeArrays=true,
}={}, _d=0) {
  
  other = other || {};
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error("One of original or other are not Objects!");
  }
  let depth = _d + 1;
  
  // Maybe copy the original data at depth 0
  if ( !inplace && (_d === 0) ) original = duplicate(original);
  
  // Enforce object expansion at depth 0
  if ( (_d === 0 ) && Object.keys(original).some(k => /\./.test(k)) ) original = expandObjectExt(original, { makeArrays: makeArrays });
  if ( (_d === 0 ) && Object.keys(other).some(k => /\./.test(k)) ) other = expandObject(other, { makeArrays: makeArrays });
  
  // Iterate over the other object
  for ( let [k, v] of Object.entries(other) ) {
    let tv = getType(v);
    
    // Prepare to delete
    let toDelete = false;
    if ( k.startsWith("-=") ) {
      k = k.slice(2);
      toDelete = (v === null)
    }
    
    // Get the existing object
    let x = original[k];
    let has = original.hasOwnProperty(k);
    let tx = getType(x);
    
    // Ensure that inner objects exist
    if ( !has && (tv === "Object") ) {
      x = original[k] = {};
      has = true;
      tx = "Object";
    }
    
    // Case 1 - Key exists
    if (has) {
      
      // 1.1 - Recursively merge an inner object
      if ( (tv === "Object") && (tx === "Object") ) {
        mergeObjectExt(x, v, {
          insertKeys: insertKeys,
          insertValues: insertValues,
          overwrite: overwrite,
          inplace: true,
          enforceTypes: enforceTypes,
          makeArrays: makeArrays,
        }, depth);
      }
      
      // 1.2 - Remove an existing key
      else if ( toDelete ) {
        delete original[k];
      }
      
      // 1.3 - Overwrite existing value
      else if ( overwrite ) {
        if ( tx && (tv !== tx) && enforceTypes ) {
          throw new Error(`Mismatched data types encountered during object merge.`);
        }
        original[k] = v;
      }
      
      // 1.4 - Insert new value
      else if ( (x === undefined) && insertValues ) {
        original[k] = v;
      }
    }
    
    // Case 2 - Key does not exist
    else if ( !toDelete ) {
      let canInsert = (depth === 1 && insertKeys ) || ( depth > 1 && insertValues );
      if (canInsert) original[k] = v;
    }
  }
  
  // Return the object for use
  return original;
};

export const naturalSort = function(arr, propertyKey="") {
  return arr.sort((a, b) => {
    const propA = propertyKey ? getProperty(a, propertyKey) : a;
    const propB = propertyKey ? getProperty(b, propertyKey) : b;
    return new Intl.Collator(game.settings.get("core", "language"), { numeric: true }).compare(propA, propB);
  });
};
