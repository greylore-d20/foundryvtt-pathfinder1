import { normalDie, sizeDieExt, sizeReach } from "./lib.mjs";

export const rollPreProcess = {
  sizeRoll: sizeDieExt,
  sizeReach: sizeReach,
  roll: normalDie,
};

export * as handlebars from "./handlebars/_module.mjs";
export * as canvas from "./canvas.mjs";
export * as chat from "./chat.mjs";
export * as dialog from "./dialog.mjs";
export * as links from "./links.mjs";
export { SemanticVersion } from "./semver.mjs";

export {
  createTag,
  getItemOwner,
  getActorFromId,
  convertDistance,
  convertDistanceBack,
  convertWeight,
  convertWeightBack,
  measureDistance,
  isMinimumCoreVersion,
  binarySearch,
  sortArrayByName,
  findInCompendia,
  getFirstActiveGM,
  refreshActors,
  diffObjectAndArray,
  sizeRoll,
} from "./lib.mjs";
