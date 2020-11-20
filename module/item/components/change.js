export class ItemChange {
  static create(data, parent) {
    const result = new this();

    result.data = mergeObject(this.defaultData, data);
    result.parent = parent;

    return result;
  }

  static get defaultData() {
    return {
      _id: randomID(8),
      formula: "",
      operator: "add",
      target: "",
      subTarget: "",
      modifier: "",
      priority: 0,
      value: 0,
    };
  }

  get _id() {
    return this.data._id;
  }
  get formula() {
    return this.data.formula;
  }
  get operator() {
    return this.data.operator;
  }
  get target() {
    return this.data.target;
  }
  get subTarget() {
    return this.data.subTarget;
  }
  get modifier() {
    return this.data.modifier;
  }
  get priority() {
    return this.data.priority;
  }
  get value() {
    return this.data.value;
  }

  prepareData() {}

  async update(data, options = {}) {
    if (this.parent != null) {
      const rawChange = this.parent.data.data.changes.find((o) => o._id === this._id);
      const idx = this.parent.data.data.changes.indexOf(rawChange);
      if (idx >= 0) {
        data = Object.entries(data).reduce((cur, o) => {
          cur[`data.changes.${idx}.${o[0]}`] = o[1];
          return cur;
        }, {});
        return this.parent.update(data, options);
      }
    }
  }
}
