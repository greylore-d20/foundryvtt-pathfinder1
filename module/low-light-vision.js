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

// Patch lighting radius
SightLayer.prototype.hasLowLight = function() {
  const relevantTokens = canvas.tokens.placeables.filter(o => {
    return o.actor && o.actor.hasPerm(game.user, "OBSERVER");
  });
  const lowLightTokens = relevantTokens.filter(o => getProperty(o, "actorVision.lowLight"));
  if (game.user.isGM) {// || game.settings.get("pf1", "lowLightVisionMode")) {
    return lowLightTokens.filter(o => o._controlled).length;
  }
  if (game.settings.get("pf1", "lowLightVisionMode")) {
    return lowLightTokens.filter(o => o._controlled).length;
  }
  return (!relevantTokens.filter(o => o._controlled).length && lowLightTokens.length) || lowLightTokens.filter(o => o._controlled).length;
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

const Token__onControl = Token.prototype._onControl;
Token.prototype._onControl = function(...args) {
  Token__onControl.call(this, ...args);
  // Refresh lighting and sight
  refreshLightingAndSight();
};

const Token__onRelease = Token.prototype._onRelease;
Token.prototype._onRelease = function(...args) {
  Token__onRelease.call(this, ...args);
  // Refresh lighting and sight
  refreshLightingAndSight();
};

const Token__onUpdate = Token.prototype._onUpdate;
Token.prototype._onUpdate = function(data) {
  Token__onUpdate.call(this, data);
  refreshLightingAndSight();
};

SightLayer.prototype.updateTokenLight = async function(token, {defer=false, walls=null}={}) {
  let sourceId = `Token.${token.id}`;
  const center = token.getSightOrigin();
  let isLightSource = token.emitsLight;
  let [cullMult, cullMin, cullMax] = this._cull;

  if (isLightSource) {

    // Compute light emission polygons
    const dim = token.dimLightRadius;
    const bright = token.brightLightRadius;
    const radius = Math.max(Math.abs(dim), Math.abs(bright));
    const {fov} = this.constructor.computeSight(center, radius, {
      angle: token.data.lightAngle,
      cullMult: cullMult,
      cullMin: cullMin,
      cullMax: cullMax,
      density: 6,
      rotation: token.data.rotation,
      walls: walls
    });

    // Add a light source
    const source = new SightLayerSource({
      x: center.x,
      y: center.y,
      los: null,
      fov: fov,
      dim: dim,
      bright: bright,
      color: token.data.lightColor,
      alpha: token.data.lightAlpha
    });
    this.sources.lights.set(sourceId, source);
  }

  if (!defer) this.update();
};

export async function refreshLightingAndSight() {
  let walls = canvas.walls.blockVision;
  canvas.lighting.placeables.forEach(l => canvas.sight.updateLight(l, {walls, defer: true}));

  const tokens = canvas.tokens.placeables;
  walls = canvas.walls.blockVision;
  tokens.forEach(t => canvas.sight.updateTokenLight(t, {walls, defer: true, forceUpdateFog: false}));

  // Draw lighting atop the darkness
  // const c = canvas.lighting.lighting;
  // c.lights.clear();
  // for ( let s of canvas.sight.sources.lights.values() ) {
  //   c.lights.beginFill(s.color, s.alpha).drawPolygon(s.fov).endFill();
  // }

  canvas.sight.update();
}
