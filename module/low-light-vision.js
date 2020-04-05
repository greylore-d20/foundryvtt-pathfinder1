import { TokenConfigPF } from "./token-config.js";


// Patch Token's sheet template
Object.defineProperties(Token.prototype, {
  sheet: {
    get() {
      if (!this._sheet) this._sheet = new TokenConfigPF(this);
      return this._sheet;
    }
  },
  actorVision: {
    get() {
      return this.actor.data.data.attributes.vision || {};
    }
  }
});

const Token_update = Token.prototype.update;
Token.prototype.update = async function(data, options={}) {
  if (data.visionLL != null) {
    this.actor.update({ "data.attributes.vision.lowLight": data.visionLL });
  }

  return Token_update.call(this, data, options);
};

const TokenConfig__updateActorData = TokenConfig.prototype._updateActorData;
TokenConfig.prototype._updateActorData = function(tokenData) {
  if (tokenData.visionLL != null) {
    this.actor.update({ "data.attributes.vision.lowLight": tokenData.visionLL });
  }

  TokenConfig__updateActorData.call(this, tokenData);
};

// Patch lighting radius
SightLayer.prototype.hasLowLight = function() {
  let tokens = canvas.tokens.placeables.filter(o => {
    return o.actor && o.actor.hasPerm(game.user, "OBSERVER") && o.actorVision.lowLight === true;
  });
  if (game.user.isGM) {
    return tokens.filter(o => {
      return o._controlled === true;
    }).length > 0;
  }
  return tokens.length > 0;
};

const AmbientLight__get__dimRadius = Object.getOwnPropertyDescriptor(AmbientLight.prototype, "dimRadius").get;
Object.defineProperty(AmbientLight.prototype, "dimRadius", {
  get: function() {
    let result = AmbientLight__get__dimRadius.call(this);
    if (canvas.sight.hasLowLight() && result > 0) result *= 2;
    return result;
  }
});

const AmbientLight__get__brightRadius = Object.getOwnPropertyDescriptor(AmbientLight.prototype, "brightRadius").get;
Object.defineProperty(AmbientLight.prototype, "brightRadius", {
  get: function() {
    let result = AmbientLight__get__brightRadius.call(this);
    if (canvas.sight.hasLowLight() && result > 0) result *= 2;
    return result;
  }
});

const Token__get__dimLightRadius = Object.getOwnPropertyDescriptor(Token.prototype, "dimLightRadius").get;
Object.defineProperty(Token.prototype, "dimLightRadius", {
  get: function() {
    let result = Token__get__dimLightRadius.call(this);
    if (canvas.sight.hasLowLight() && result > 0) result *= 2;
    return result;
  }
});

const Token__get__brightLightRadius = Object.getOwnPropertyDescriptor(Token.prototype, "brightLightRadius").get;
Object.defineProperty(Token.prototype, "brightLightRadius", {
  get: function() {
    let result = Token__get__brightLightRadius.call(this);
    if (canvas.sight.hasLowLight() && result > 0) result *= 2;
    return result;
  }
});

const Token__control = Token.prototype.control;
Token.prototype.control = function(...args) {
  let result = Token__control.apply(this, args);
  // Refresh lighting and sight
  refreshLightingAndSight();
  return result;
};

const Token__release = Token.prototype.release;
Token.prototype.release = function(...args) {
  let result = Token__release.apply(this, args);
  // Refresh lighting and sight
  refreshLightingAndSight();
  return result;
};

export async function refreshLightingAndSight() {
  canvas.sight.initializeLights();
  canvas.sight.initializeTokens();

  // Draw lighting atop the darkness
  const c = canvas.lighting.lighting;
  c.lights.clear();
  for ( let s of canvas.sight.sources.lights.values() ) {
    c.lights.beginFill(s.color, s.alpha).drawPolygon(s.fov).endFill();
  }
}
