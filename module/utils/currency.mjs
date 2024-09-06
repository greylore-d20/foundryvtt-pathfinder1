/**
 * Split copper currency into gold, silver and copper.
 *
 * @param {number} cp - Copper
 * @param {object} [options] - Additional options
 * @param {CoinType[]} [options.omit] - Omit these types from the result. Baseline currency can not be omitted.
 * @param {boolean} [options.pad] - Pad return value by including zeroed currencies
 * @param {CoinType} [options.standard] - If true, no coinage of greater value than the {@link pf1.config.currency.standard standard currency} is included.
 * @returns {Record<CoinType,number>} Gold, silver, and copper
 */
export function split(cp, { omit = [], standard = true, pad = true } = {}) {
  const rates = Object.entries(pf1.config.currency.rate)
    .filter(([key]) => !omit.includes(key))
    .sort((a, b) => b[1] - a[1]);

  const currencies = {};

  const maxRate = standard ? pf1.config.currency.rate[pf1.config.currency.standard] ?? 1 : Infinity;

  for (const [key, rate] of rates) {
    if (rate > maxRate) {
      if (pad) currencies[key] = 0;
      continue;
    }

    const value = Math.floor(cp / rate);
    if (value != 0 || pad) {
      currencies[key] = value;
      cp -= value * rate;
    }
  }

  if (cp != 0 || pad) {
    currencies[pf1.config.currency.base] = cp;
  }

  return currencies;
}

/**
 * Merges provided currencies into specified type.
 *
 * @param {object} currency - Currency object with keys according to {@link pf1.config.currencies}
 * @param {CoinType} [type] - Return coinage, defaults to {@link pf1.config.currency.base baseline currency}.
 * @returns {number} - Merged currency
 */
export function merge({ ...currency } = {}, type) {
  const { rate: rates, base } = pf1.config.currency;
  type ||= pf1.config.currency.base;

  let copper = 0;
  for (let [type, value] of Object.entries(currency)) {
    value ??= 0;
    if (!Number.isFinite(value)) throw new Error(`Invalid currency value "${value}" for type "${type}"`);
    if (value == 0) continue;
    const rate = rates[type];
    if (rate) {
      copper += value * rate;
    } else {
      if (type === base) copper += value;
      else throw new Error(`Invalid currency type: "${type}"`);
    }
  }

  if (type === base) return copper;
  return copper / rates[type];
}

/**
 * Convert given amount of copper to some other currency, excess is placed on less valuable coinage.
 *
 * @param {number} cp - Copper quantity
 * @param {CoinType} [target] - Target unit. Defaults to {@link pf1.config.currency.standard standard currency}.
 * @param {object} [options] - Additional options
 * @param {boolean} [options.pad] - Pad return value by including zeroed currencies
 * @returns {Record<CoinType,number>} - Resulting conversion
 */
export function convert(cp, target, { pad = true } = {}) {
  target ||= pf1.config.currency.standard;
  if (!Number.isFinite(cp) || !(cp >= 0)) throw new Error(`Invalid copper quantity: ${cp}`);

  const { base, rate } = pf1.config.currency;
  const rates = Object.entries(rate).sort((a, b) => b[1] - a[1]);

  const maxRate = rate[target] ?? 1;

  const currencies = {};
  for (const [key, rate] of rates) {
    if (rate > maxRate) {
      if (pad) currencies[key] = 0;
      continue;
    }

    const value = Math.floor(cp / rate);
    if (value !== 0 || pad) {
      currencies[key] = value;
      cp -= value * rate;
    }
  }

  if (cp != 0 || pad) {
    currencies[base] = cp;
  }

  return currencies;
}
