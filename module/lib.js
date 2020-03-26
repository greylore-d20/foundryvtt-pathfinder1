/**
 * Creates a tag from a string.
 * For example, if you input the string "Wizard of Oz 2", you will get "wizardOfOz2"
 */
export const createTag = function(str) {
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
  const rgx = new RegExp(Die.rgx.die, "g");
  if (str.match(/^([0-9]+)d([0-9]+)/)) {
    return str.replace(rgx, (match, nd, d, mods) => {
      nd = (nd * (multiply || 1)) + (add || 0);
      mods = mods || "";
      return ((nd == null || Number.isNaN(nd)) ? "" : nd) + "d" + d + mods;
    });
  }
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
    for (let o of scrollElems) { o.scrollTop = this._scrollTab[rtabs.group]; }

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
    const activeSubHtml = subHtml.find(".active");
    const initial = this._initialTab[group] !== undefined ? this._initialTab[group] : (activeSubHtml.length > 0 ? subHtml[0].dataset.tab : "");

    // Set up data for scroll position and active tab
    if (this._scrollTab[group] === undefined) this._scrollTab[group] = 0;
    if (this._initialTab[group] === undefined) this._initialTab[group] = initial;

    // Set up scrolling callback
    let scrollElems = html.find(`.scroll-${group}`);
    if (scrollElems.length === 0) scrollElems = html.find(`.tab[data-group="${group}"]`);
    scrollElems.scroll(ev => this._scrollTab[group] = ev.currentTarget.scrollTop);

    // Create tabs object
    const tabs = new TabsV2({
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

  _func.call(this, "primary", tabGroups.primary);
};
