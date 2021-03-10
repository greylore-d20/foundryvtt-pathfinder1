// import { ActorData } from "/common/data/data.mjs";

export const ActorDataPF = (Base) =>
  class extends Base {
    _trackPreviousAttributes() {
      if (!this._prevAttributes) {
        this._prevAttributes = {};
        for (const k of ["data.attributes.hp", "data.attributes.wounds", "data.attributes.vigor"]) {
          this._prevAttributes[k] = getProperty(this.data, `${k}.max`);
        }
      }
    }

    update(data = {}, options = {}) {
      this._trackPreviousAttributes();

      return super.update(data, options);
    }
  };
