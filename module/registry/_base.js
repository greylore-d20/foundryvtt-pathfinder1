export class BaseRegistryObject {
  constructor(src) {
    this._source = this._createSource(src);
  }

  _createSource(src) {
    return mergeObject(this.constructor._baseSource, src);
  }

  static get _baseSource() {
    return {
      _id: randomID(16),
      get id() {
        return this._id;
      },
      name: `New ${this.constructor.name}`,
      flags: {},
    };
  }

  static get name() {
    return "Basic";
  }

  get id() {
    return this._source.id;
  }
  get key() {
    return this.id;
  }
  get name() {
    return this._source.name;
  }

  toObject() {
    return duplicate(this._source);
  }
}
