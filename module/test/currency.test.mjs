const mergings = [
  [{ pp: 10, gp: 50, sp: 500, cp: 3000 }, "gp", 230],
  [{ pp: 1, gp: 20, sp: 330, cp: 4 }, "pp", 6.304],
];

const conversions = [
  [1234, "cp", { cp: 1234 }],
  [1234, "sp", { sp: 123, cp: 4 }],
  [6304, "pp", { pp: 6, gp: 3, cp: 4 }],
];

const splits = [
  [1234, { gp: 12, sp: 3, cp: 4 }],
  [43218, { gp: 432, sp: 1, cp: 8 }],
];

// Pretty print simple object
function objStr(obj) {
  const parts = Object.entries(obj)
    .filter(([_, value]) => value != 0)
    .map(([key, value]) => `${key}: ${value}`);

  return "{ " + parts.join(", ") + " }";
}

export function registerCurrencyTests() {
  quench.registerBatch(
    "pf1.utils.currency",
    (context) => {
      const { describe, it, expect, after, assert } = context;

      describe("merge", function () {
        for (const [input, type, output] of mergings) {
          it(`${objStr(input)} = ${output}`, function () {
            expect(pf1.utils.currency.merge(input, type)).to.equal(output);
          });
        }
      });

      describe("convert", function () {
        for (const [input, type, output] of conversions) {
          it(`${input} = ${objStr(output)}`, function () {
            expect(pf1.utils.currency.convert(input, type, { pad: false })).to.deep.equal(output);
          });
        }
      });

      describe("split", function () {
        for (const [input, output] of splits) {
          it(`${input} = ${objStr(output)}`, function () {
            expect(pf1.utils.currency.split(input, { pad: false })).to.deep.equal(output);
          });
        }
      });
    },
    {
      displayName: "PF1: Currency",
    }
  );
}
