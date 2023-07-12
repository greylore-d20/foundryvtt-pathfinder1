export class PointBuyCalculator extends DocumentSheet {
  constructor(...args) {
    super(...args);

    const actorAbl = this.actor.system.abilities;

    this.abilities = [];
    for (const [k, name] of Object.entries(pf1.config.abilities)) {
      this.abilities.push({
        key: k,
        name: name,
        value: actorAbl[k]?.value ?? 10,
      });
    }

    const ablValues = Object.keys(pf1.config.abilityCost).map((i) => Number(i));
    this.min = Math.min(...ablValues);
    this.max = Math.max(...ablValues);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "pointbuy-calculator"],
      template: "systems/pf1/templates/apps/point-buy-calculator.hbs",
      width: 320,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }

  get title() {
    return `${game.i18n.localize("PF1.PointBuyCalculator")}: ${this.object.name}`;
  }

  get actor() {
    return this.document;
  }

  getData() {
    const usedPoints = this.getSpentPoints();

    const pointBuy = pf1.config.pointBuy;
    const limitsArr = Object.entries(pointBuy).map(([key, ldata]) => ({ ...ldata, key }));
    limitsArr.sort((a, b) => a.points - b.points);

    // Find most relevant category
    let closest = limitsArr[0].key;
    for (const l of limitsArr) {
      const prev = pointBuy[closest].points;
      if (prev < usedPoints) closest = l.key;
    }

    return {
      abilities: this.abilities,
      points: usedPoints,
      limits: limitsArr,
      closest,
      invalidPoints: pointBuy[closest].points !== usedPoints,
    };
  }

  getSpentPoints() {
    let result = 0;

    for (const a of this.abilities) {
      result += pf1.config.abilityCost[a.value];
    }

    return result;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".control").click(this._onAbilityControl.bind(this));
  }

  _onAbilityControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const ablKey = a.closest(".ability").dataset.ability;
    const abl = this.abilities.find((o) => o.key === ablKey);

    if (a.classList.contains("add")) {
      abl.value = Math.min(this.max, abl.value + 1);
    } else if (a.classList.contains("subtract")) {
      abl.value = Math.max(this.min, abl.value - 1);
    }
    this.render();
  }

  _updateObject() {
    const updateData = {};
    for (const a of this.abilities) {
      updateData[`system.abilities.${a.key}.value`] = a.value;
    }
    this.actor.update(updateData);

    this.close();
  }
}
