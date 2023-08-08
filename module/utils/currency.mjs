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
