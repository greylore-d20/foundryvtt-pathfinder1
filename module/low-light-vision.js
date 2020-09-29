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
  const updateData = {};

  if (data.visionLL != null) {
    updateData["data.attributes.vision.lowLight"] = data.visionLL;
  }
  if (data.darkvision != null) {
    updateData["data.attributes.vision.darkvision"] = data.darkvision;
  }

  if (Object.keys(updateData).length) {
    await this.actor.update(updateData);
  }

  return Token_update.call(this, data, options);
};

SightLayer.prototype.hasLowLight = function() {
  const relevantTokens = canvas.tokens.placeables.filter(o => {
    return o.actor && o.actor.hasPerm(game.user, "OBSERVER");
  });
  const lowLightTokens = relevantTokens.filter(o => getProperty(o, "actorVision.lowLight"));
  if (game.user.isGM) {
    return lowLightTokens.filter(o => o._controlled).length > 0;
  }
  if (game.settings.get("pf1", "lowLightVisionMode")) {
    return lowLightTokens.filter(o => o._controlled).length > 0;
  }
  return (!relevantTokens.filter(o => o._controlled).length && lowLightTokens.length) || lowLightTokens.filter(o => o._controlled).length > 0;
};

SightLayer.prototype.hasDarkvision = function() {
  const relevantTokens = canvas.tokens.placeables.filter(o => {
    return o.actor && o.actor.hasPerm(game.user, "OBSERVER");
  });
  const darkvisionTokens = relevantTokens.filter(o => o.getDarkvisionRadius() > 0);
  if (game.user.isGM) {
    return darkvisionTokens.filter(o => o._controlled).length > 0;
  }
  if (game.settings.get("pf1", "lowLightVisionMode")) {
    return darkvisionTokens.filter(o => o._controlled).length > 0;
  }
  return (!relevantTokens.filter(o => o._controlled).length && darkvisionTokens.length) || darkvisionTokens.filter(o => o._controlled).length > 0;
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

const SightLayer_initializeTokens = SightLayer.prototype.initializeTokens;
SightLayer.prototype.initializeTokens = function(options) {
  options = options || {};
  const defer = options.defer || false;
  options.defer = true;

  SightLayer_initializeTokens.call(this, options);
  this.initializeLights(options);
  canvas.lighting.update();

  if (!defer) {
    this.update({forceUpdateFog: true});
    canvas.lighting.drawLights();
    // this.update();
  }
};

Token.prototype.getDarkvisionRadius = function() {
  return this.getLightRadius(getProperty(this, "actor.data.data.attributes.vision.darkvision") || 0);
};

Token.prototype.getDarkvisionSight = function() {
  const radius = this.getDarkvisionRadius();
  if (!radius) return null;

  const walls = canvas.walls.blockVision;
  const globalLight = canvas.scene.data.globalLight;
  const maxR = globalLight ? Math.max(canvas.dimensions.width, canvas.dimensions.height) : null;
  let [cullMult, cullMin, cullMax] = canvas.sight._cull;
  if (globalLight) cullMin = maxR;

  return canvas.sight.constructor.computeSightQuadtree4(this.getSightOrigin(), radius, {
    angle: this.data.angle,
    cullMult: cullMult,
    cullMin: cullMin,
    cullMax: cullMax,
    density: 6,
    rotation: this.data.rotation,
    walls: walls,
  });
};

const SightLayer_update = SightLayer.prototype.update;
SightLayer.prototype.update = function() {
  SightLayer_update.call(this);
};

SightLayer.prototype.updateToken = function(token, {defer=false, deleted=false, walls=null}={}) {
  if ( CONFIG.debug.sight ) {
    SightLayer._performance = { start: performance.now(), tests: 0, rays: 0 }
  }

  // Clear the prior Token source
  let sourceId = `Token.${token.id}`;
  if ( deleted ) {
    this.sources.lights.delete(sourceId);
    this.sources.vision.delete(sourceId);
    return defer ? null : this.update();
  }

  // Determine whether the Token is a viable source
  const isVisionSource = this._isTokenVisionSource(token);
  const isLightSource = token.emitsLight && !token.data.hidden;

  // Prepare some common data
  const globalLight = canvas.scene.data.globalLight;
  const origin = token.getSightOrigin();
  const center = token.center;
  const maxR = globalLight ? Math.max(canvas.dimensions.width, canvas.dimensions.height) : null;
  let [cullMult, cullMin, cullMax] = this._cull;
  if ( globalLight ) cullMin = maxR;

  // Prepare vision sources
  if ( isVisionSource ) {

    // Compute vision polygons
    let dim = globalLight ? 0 : token.getLightRadius(token.data.dimSight);
    const bright = globalLight ? maxR : token.getLightRadius(token.data.brightSight);
    const darkvision = this.hasDarkvision() ? token.getDarkvisionRadius() : 0;
    if ((dim === 0) && (bright === 0) && (darkvision === 0)) dim = canvas.dimensions.size * 0.6;
    const radius = Math.max(Math.abs(dim), Math.abs(bright), Math.abs(darkvision));
    const {los, fov} = this.constructor.computeSightQuadtree4(origin, radius, {
      angle: token.data.sightAngle,
      cullMult: cullMult,
      cullMin: cullMin,
      cullMax: cullMax,
      rotation: token.data.rotation,
      walls: walls
    });

    // Add a vision source
    const sourceData = {
      x: center.x,
      y: center.y,
      los: los,
      fov: fov,
      dim: dim,
      bright: Math.max(bright, darkvision),
      limited: token.data.sightAngle.between(0, 360, false)
    };
    let visionSource = this.sources.vision.get(sourceId);
    if ( visionSource ) visionSource.initialize(sourceData);
    else this.sources.vision.set(sourceId, new SightLayerSource(sourceData));
  }
  else this.sources.vision.delete(sourceId);

  // Prepare light sources
  if ( isLightSource ) {

    // Compute light emission polygons
    const dim = token.getLightRadius(token.data.dimLight);
    const bright = token.getLightRadius(token.data.brightLight);
    const radius = Math.max(Math.abs(dim), Math.abs(bright));
    const {fov} = this.constructor.computeSightQuadtree4(origin, radius, {
      angle: token.data.lightAngle,
      cullMult: cullMult,
      cullMin: cullMin,
      cullMax: cullMax,
      rotation: token.data.rotation,
      walls: walls
    });

    // Add a light source
    const sourceData = {
      x: center.x,
      y: center.y,
      los: null,
      fov: fov,
      dim: dim,
      bright: bright,
      color: token.data.lightColor,
      alpha: token.data.lightAlpha,
      limited: token.data.lightAngle.between(0, 360, false)
    };
    let lightSource = this.sources.lights.get(sourceId);
    if ( lightSource ) lightSource.initialize(sourceData);
    else {
      lightSource = new SightLayerSource(sourceData);
      token.lightSource = lightSource;
      this.sources.lights.set(sourceId, lightSource);
    }
  }
  else this.sources.lights.delete(sourceId);

  // Maybe update
  if ( CONFIG.debug.sight ) console.debug(`Updated SightLayer source for ${sourceId}`);
  if ( !defer ) this.update();

};

LightingLayer.prototype.updateDarkvision = function() {
  const c = this.lighting;

  // Draw token darkvision
  const vision = canvas.sight.sources.vision;
  for (let k of vision.keys()) {
    const t = canvas.tokens.placeables.find(o => `Token.${o.id}` === k);
    if (!t) continue;
    const sight = t.getDarkvisionSight();
    if (!sight) continue;
    const fov = sight.fov;
    c.lights.beginFill(0xFFFFFF, 1).drawPolygon(fov).endFill();
  }
};
