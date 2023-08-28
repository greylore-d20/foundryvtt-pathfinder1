/**
 * Determine whether a formula contains a string that might erroneously be interpreted as a dice formula.
 * __DO NOT USE THIS FUNCTION__, it does not provide a reasonable test.
 *
 * @param {string} formula - The formula to test.
 * @returns {RegExpMatchArray|null} - The result of the test.
 * @deprecated since v9.5
 */
export const formulaHasDice = function (formula) {
  foundry.utils.logCompatibilityWarning("formulaHasDice is deprecated, use `Roll` instead.", {
    since: "PF1 v9.5",
    until: "PF1 v10",
  });
  return formula.match(/[0-9)][dD]/) || formula.match(/[dD][0-9(]/);
};
