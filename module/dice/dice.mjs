export const formulaHasDice = function (formula) {
  return formula.match(/[0-9)][dD]/) || formula.match(/[dD][0-9(]/);
};
