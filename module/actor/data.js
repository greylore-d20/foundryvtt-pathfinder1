// import { ActorData } from "/common/data/data.mjs";

export const ActorDataPF = (Base) =>
  class extends Base {
    _trackPreviousAttributes() {
      this._prevAttributes = this._prevAttributes || {};
      for (const k of ["data.attributes.hp", "data.attributes.wounds", "data.attributes.vigor"]) {
        const max = getProperty(this.data, `${k}.max`);
        if (this._prevAttributes[k] != null) continue;
        this._prevAttributes[k] = max;
      }
    }

    _applyPreviousAttributes() {
      if (this._prevAttributes && !game.pf1.isMigrating && this._initialized) {
        for (const [k, prevMax] of Object.entries(this._prevAttributes)) {
          if (prevMax == null) continue;
          const newMax = getProperty(this.data, `${k}.max`) || 0;
          const prevValue = getProperty(this.data, `${k}.value`);
          const newValue = prevValue + (newMax - prevMax);
          // if (k === "data.attributes.hp") console.log(prevMax, newMax, prevValue, newValue);
          if (prevValue !== newValue) this._queuedUpdates[`${k}.value`] = newValue;
        }
      }
      this._prevAttributes = null;
    }
  };
