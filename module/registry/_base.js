export class BaseRegistryObject {
  constructor(src) {
    this.data = this._createData(src);
  }

  _createData(src) {
    return mergeObject(this.constructor._baseData, src);
  }

  static get _baseData() {
    return {
      _id: randomID(16),
      get id() {
        return this._id;
      },
      name: `New ${this.constructor.name}`,
      flags: {},
    };
  }

  static get typeName() {
    return "Basic Registry Object";
  }

  get id() {
    return this.data.id;
  }
  get key() {
    return this.id;
  }
  get name() {
    return this.data.name;
  }

  toObject() {
    return deepClone(this.data);
  }
}
