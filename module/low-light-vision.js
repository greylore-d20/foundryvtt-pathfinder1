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

// Overwrite SightLayer.updateToken
// May need to be updated in the future
//
// This is needed because the function calls token.getLightRadius(n) instead of token.dimLightRadius,
// and token.getLightRadius(n) is also called for a token's sight, which shouldn't be affected by low-light vision
SightLayer.prototype.updateToken = function(token, {defer=false, deleted=false, walls=null, updateFog=true}={}) {
  let sourceId = `Token.${token.id}`;
  this.sources.vision.delete(sourceId);
  this.sources.lights.delete(sourceId);
  if ( deleted ) return defer ? null : this.update();
  if ( token.data.hidden && !game.user.isGM ) return;

  // Vision is displayed if the token is controlled, or if it is observed by a player with no tokens controlled
  let displayVision = token._controlled;
  if ( !displayVision && !game.user.isGM && !canvas.tokens.controlled.length ) {
    displayVision = token.actor && token.actor.hasPerm(game.user, "OBSERVER");
  }

  // Take no action for Tokens which are invisible or Tokens that have no sight or light
  const globalLight = canvas.scene.data.globalLight;
  let isVisionSource = this.tokenVision && token.hasSight && displayVision;
  let isLightSource = token.emitsLight;

  // If the Token is no longer a source, we don't need further work
  if ( !isVisionSource && !isLightSource ) return;

  // Prepare some common data
  const center = token.getSightOrigin();
  const maxR = globalLight ? Math.max(canvas.dimensions.width, canvas.dimensions.height) : null;
  let [cullMult, cullMin, cullMax] = this._cull;
  if ( globalLight ) cullMin = maxR;

  // Prepare vision sources
  if ( isVisionSource ) {

    // Compute vision polygons
    let dim = globalLight ? 0 : token.getLightRadius(token.data.dimSight);
    const bright = globalLight ? maxR : token.getLightRadius(token.data.brightSight);
    if ((dim === 0) && (bright === 0)) dim = canvas.dimensions.size * 0.6;
    const radius = Math.max(Math.abs(dim), Math.abs(bright));
    const {los, fov} = this.constructor.computeSight(center, radius, {
      angle: token.data.sightAngle,
      cullMult: cullMult,
      cullMin: cullMin,
      cullMax: cullMax,
      density: 6,
      rotation: token.data.rotation,
      walls: walls
    });

    // Add a vision source
    const source = new SightLayerSource({
      x: center.x,
      y: center.y,
      los: los,
      fov: fov,
      dim: dim,
      bright: bright
    });
    this.sources.vision.set(sourceId, source);

    // Update fog exploration for the token position
    this.updateFog(center.x, center.y, Math.max(dim, bright), token.data.sightAngle !== 360, updateFog);
  }

  // Prepare light sources
  if ( isLightSource ) {

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

  // Maybe update
  if ( CONFIG.debug.sight ) console.debug(`Updated SightLayer source for ${sourceId}`);
  if ( !defer ) this.update();
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
