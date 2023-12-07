import { simplify as simplifyFormula } from "@utils/formulas.mjs";

const testFormulas = [
  ["1 == 1 ? 1d6 : 0", "1d6"],
  ["sizeRoll(1, 12)[test]", "1d12"],
  ["sizeRoll(2, 6, @size+1) + 5 + 2", "3d6 + 7"],
  ["sizeRoll(1,12,@size)+1d8+6+2+1-2-6+2", "1d12 + 1d8 + 3"],
  ["max(1d6, 4)[test]", "max(1d6,4)"],
  ["4d6-0+2", "4d6 + 2"],
  ["4d6-2+2", "4d6"],
  ["1d8-1+32+3-2*2", "1d8 + 30"],
  ["2 <= 4 ? 1 : floor(2 / 11 + 1)d6", "1"],
  ["4>=10 ? 0 : 4>=5 ? -2 : -4", "-4"],
  ["sizeRoll(2, 6, 5) + 5 + 2", "3d6 + 7"],
  ["1d8+min(2,@attributes.dex.mod)", "1d8 + 2"],
  ["-.5", "-0.5"],
  ["3d6x>=5", "3d6x>=5"], // bug#2175
];

export function registerFormulaParsingTests() {
  quench.registerBatch(
    "pf1.roll.formula",
    async (context) => {
      const { describe, it, expect, after, assert } = context;

      const rollData = {
        size: 4,
        attributes: {
          dex: {
            mod: 3,
          },
        },
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
