import { simplifyFormula } from "@utils";

const testFormulas = [
  ["1 == 1 ? 1d6 : 0", "1d6"],
  ["sizeRoll(1, 12)[test]", "1d12"],
  ["sizeRoll(2, 6, @size+1) + 5 + 2", "3d6 + 7"],
  ["sizeRoll(1,12,@size)+1d8+6+2+1-2-6+2", "1d12 + 1d8 + 3"],
  ["max(1d6, 4)[test]", "max(1d6,4)"],
];

/**
 *
 */
export function registerFormulaParsingTests() {
  quench.registerBatch(
    "pf1.roll.formula",
    async (context) => {
      const { describe, it, expect, after, assert } = context;

      const rollData = {
        size: 4,
      };

      describe("simplifyFormula", function () {
        testFormulas.forEach(([formula, expected]) => {
          it(formula, function () {
            expect(simplifyFormula(formula, rollData)).to.equal(expected);
          });
        });
      });
    },
    {
      displayName: "PF1: Formula Parsing",
    }
  );
}
