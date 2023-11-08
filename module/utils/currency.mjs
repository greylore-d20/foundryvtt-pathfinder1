/**
 * Split copper currency into gold, silver and copper.
 *
 * @param {number} cp Copper
 * @returns {{gp:number,sp:number,cp:number}} Gold, silver, and copper.
 */
export function split(cp) {
  const gp = Math.floor(cp / 100);
  const sp = Math.floor(cp / 10) - gp * 10;
  cp = cp - gp * 100 - sp * 10;
  return {
    gp: Math.max(0, gp),
    sp: Math.max(0, sp),
    cp: Math.max(0, cp),
  };
}

/**
 * Convert given amount of copper to some other currency, excess is placed on less valuable coinage.
 *
 * @param {number} cp - Copper quantity
 * @param {"pp"|"gp"|"sp"|"cp"} [target="gp"] - Target unit
 * @returns {{pp:number,gp:number,sp:number,cp:number}} - Resulting conversion
 */
export function convert(cp, target = "gp") {
  if (!Number.isFinite(cp) || !(cp >= 0)) throw new Error(`Invalid copper quantity: ${cp}`);
  let pp = 0,
    gp = 0,
    sp = 0;
  const types = { pp: 3, gp: 2, sp: 1, cp: 0 };
  const largestType = types[target];
  if (largestType >= types.pp) {
    pp = Math.floor(cp / 1_000);
    cp -= pp * 1_000;
  }
  if (largestType >= types.gp) {
    gp = Math.max(0, Math.floor(cp / 100));
    cp -= gp * 100;
  }
  if (largestType >= types.sp) {
    sp = Math.max(0, Math.floor(cp / 10));
    cp -= sp * 10;
  }
  return { pp, gp, sp, cp };
}
