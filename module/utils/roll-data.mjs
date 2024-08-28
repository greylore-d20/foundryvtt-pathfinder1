/**
 * Add static data to roll data.
 *
 * @param {object} rollData
 */
export function addStatic(rollData) {
  // @step (1.5m or 5ft) – the value here is always 5 since that's what all math use
  rollData.step = 5;
}
