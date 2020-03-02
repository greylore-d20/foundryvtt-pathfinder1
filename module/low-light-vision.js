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

const TokenConfig_getData = TokenConfig.prototype.getData;
TokenConfig.prototype.getData = async function() {
  let result = await TokenConfig_getData.call(this);
  result.actor = result.actor || {};
  result.actor["vision"] = duplicate(this.token.actor.data.data.attributes.vision || {});
  return result;
};

// Patch lighting radius
SightLayer.prototype.hasLowLight = function() {
  let tokens = canvas.tokens.placeables.filter(o => {
    return o.actor.hasPerm(game.user, CONST.ENTITY_PERMISSIONS.OBSERVER) && o.actorVision.lowLight === true;
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
    if (canvas.sight.hasLowLight()) result *= 2;
    return result;
  }
});

const AmbientLight__get__brightRadius = Object.getOwnPropertyDescriptor(AmbientLight.prototype, "brightRadius").get;
Object.defineProperty(AmbientLight.prototype, "brightRadius", {
  get: function() {
    let result = AmbientLight__get__brightRadius.call(this);
    if (canvas.sight.hasLowLight()) result *= 2;
    return result;
  }
});

const Token__get__dimLightRadius = Object.getOwnPropertyDescriptor(Token.prototype, "dimLightRadius").get;
Object.defineProperty(Token.prototype, "dimLightRadius", {
  get: function() {
    let result = Token__get__dimLightRadius.call(this);
    if (canvas.sight.hasLowLight()) result *= 2;
    return result;
  }
});

const Token__get__brightLightRadius = Object.getOwnPropertyDescriptor(Token.prototype, "brightLightRadius").get;
Object.defineProperty(Token.prototype, "brightLightRadius", {
  get: function() {
    let result = Token__get__brightLightRadius.call(this);
    if (canvas.sight.hasLowLight()) result *= 2;
    return result;
  }
});

// Replace SightLayer's _updateToken method for low-light vision
SightLayer.prototype._updateToken = function(token, {light=false, updateFog=false, visionWalls}={}) {
  // Determine default vision arguments
  let dim = light ? token.dimLightRadius : token._getLightRadius(token.data.dimSight);
  let bright = light ? token.brightLightRadius : token._getLightRadius(token.data.brightSight);
  let [cullMult, cullMin, cullMax] = this._cull;

  // Adapt for case of global illumination
  if ( canvas.scene.data.globalLight ) {
    dim = Math.max(canvas.dimensions.width, canvas.dimensions.height);
    bright = dim;
    cullMin = dim;
  }

  // Adapt for case of no vision
  if ( dim === 0 && bright === 0 ) {
    if ( light ) return;
    else dim = canvas.dimensions.size * 0.6;
  }

  // Evaluate sight polygons for the Token using provided radius and options
  const angle = light ? token.data.lightAngle : token.data.sightAngle;
  const center = token.getSightOrigin();
  const radius = Math.max(Math.abs(dim), Math.abs(bright));
  const [rays, los, fov] = this.checkSight(center, radius, {
    angle: angle,
    cullMinDistance: cullMin,
    cullMultiplier: cullMult,
    cullMaxDistance: cullMax,
    radialDensity: 6,
    rotation: token.data.rotation,
    walls: visionWalls
  });

  // Store bright or dim emission to the relevant queue
  if ( dim ) {
    if (dim > 0) this._enqueueSource("dim", "tokens", {x: center.x, y: center.y, radius: dim, fov: fov});
    else this._enqueueSource("dark", "tokens", {x: center.x, y: center.y, radius: -1 * dim, fov: fov});
  }
  if ( bright ) {
    if ( bright > 0 ) this._enqueueSource("bright", "tokens", {x: center.x, y: center.y, radius: bright, fov: fov});
    else this._enqueueSource("black", "tokens", {x: center.x, y: center.y, radius: -1 * bright, fov: fov});
  }

  // Add both sight and light tokens as token-based FOV polygons
  this.fov.tokens.push(fov);

  // Add sight tokens as LOS polygons and draw them to the LOS mask
  if ( !light ) {
    this.los.tokens.push(los);
    this.map.los.beginFill(0xFFFFFF, 1.0).drawPolygon(los).endFill();
  }

  // Update fog exploration for the token position
  this.updateFog(center.x, center.y, radius, angle !== 360, updateFog);

  // Draw debugging
  if ( CONFIG.debug.sight && !light ) {
    this._debugSight(rays, los, fov);
    this._rayCount += rays.length;
  }
};

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

export function refreshLightingAndSight() {
  // canvas.sight.initializeSight();

  for (let layer of [canvas.lighting, canvas.tokens]) {
    layer.placeables.filter(obj => obj.visible).forEach(obj => {
      obj.refresh();
    });
  }
}
