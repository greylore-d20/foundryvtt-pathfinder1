/**
 * Roll terminology tests
 */
export function registerSizeRollTests() {
  quench.registerBatch(
    "pf1.utils.roll",
    async (context) => {
      const { describe, it, before, expect, after, assert } = context;

      /**
       * sizeRoll()
       *
       * @see https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9t3f
       */
      describe("sizeRoll()", function () {
        const sizeRoll = pf1.utils.roll.sizeRoll;
        const medium = 4;
        const large = medium + 1;
        const huge = medium + 2;
        const small = medium - 1;
        const tiny = medium - 2;

        describe("1d6/1d8 border rules", function () {
          it("1d6 up by one to 1d8", function () {
            expect(sizeRoll(1, 6, large)[0].formula).to.equal("1d8");
          });
          it("1d6 up by two to 2d6", function () {
            expect(sizeRoll(1, 6, large + 1)[0].formula).to.equal("2d6");
          });
          it("1d8 down by one to 1d6", function () {
            expect(sizeRoll(1, 8, small)[0].formula).to.equal("1d6");
          });
        });

        describe("Missing from chart", function () {
          it("10d6 down by one, converted to 8d8 and stepped down to 8d6", function () {
            expect(sizeRoll(10, 6, small)[0].formula).to.equal("8d6");
          });
          it("1d12 up by one: converted to 2d6 and up to 3d6", function () {
            expect(sizeRoll(1, 12, large)[0].formula).to.equal("3d6");
          });
          it("2d12 down by one: converted to 4d6 and down to 3d8", function () {
            expect(sizeRoll(2, 12, small)[0].formula).to.equal("3d8");
          });
          // Converts 10d8 to 12d6 and then steps up normally to 16d6
          it("10d8 up by one: converted to 12d6 and stepped up to 16d6", function () {
            expect(sizeRoll(10, 8, large)[0].formula).to.equal("16d6");
          });
          it("5d8 up by one: converted to 6d6 and stepped up to 8d6", function () {
            expect(sizeRoll(5, 8, large)[0].formula).to.equal("8d6");
          });
          it("7d6 down by one: converted to 6d8 and stepped down to 6d6", function () {
            expect(sizeRoll(7, 6, small)[0].formula).to.equal("6d6");
          });
        });

        // BUG?: Unknown if this is actually correct besides the 2d10 cases that have explicit examples
        describe("d10 special rule", function () {
          it("2d10 up by one to 4d8", function () {
            expect(sizeRoll(2, 10, large)[0].formula).to.equal("4d8");
          });
          it("3d10 up by one to 6d8", function () {
            expect(sizeRoll(3, 10, large)[0].formula).to.equal("6d8");
          });
          it("2d10 down by one to 2d8", function () {
            expect(sizeRoll(2, 10, small)[0].formula).to.equal("2d8");
          });
          it("3d10 down by one to 3d8", function () {
            expect(sizeRoll(3, 10, small)[0].formula).to.equal("3d8");
          });
        });

        // 2d4=1d8, 3d4=2d6, 4d4=2d8, 5d4=3d6, 6d4=3d8, etc...
        describe("d4 special rules", function () {
          it("2d4 up by one, converted to 1d8 and upgraded to 2d6", function () {
            expect(sizeRoll(2, 4, large)[0].formula).to.equal("2d6");
          });
          it("3d4 up by one, converted to 2d6 and upgraded to 3d6", function () {
            expect(sizeRoll(3, 4, large)[0].formula).to.equal("3d6");
          });
          it("4d4 up by one, converted to 2d8 and upgraded to 3d8", function () {
            expect(sizeRoll(4, 4, large)[0].formula).to.equal("3d8");
          });
          it("5d4 up by one, converted to 3d6 and upgraded to 4d6", function () {
            expect(sizeRoll(5, 4, large)[0].formula).to.equal("4d6");
          });
          it("6d4 up by one, converted to 3d8 and upgraded to 4d8", function () {
            expect(sizeRoll(6, 4, large)[0].formula).to.equal("4d8");
          });
        });

        describe("initial size rule", function () {
          // Rule: If the size decreases by one step [...] if the initial size is Medium or lower [...] instead decrease the damage by one step.
          // False assumption: the one step down the chart applying only to 1d8 and below
          // Incorrect answer ignoring the above rule: 2d6
          it("Medium 3d6 down by one size step to 2d8", function () {
            expect(sizeRoll(3, 6, small, medium)[0].formula).to.equal("2d8");
          });
          // Rule: If the size increases by one step [...] if the initial size is Small or lower [...] instead increase the damage by one step.
          // False assumption: the one step up the chart applying only to 1d6 and below
          // Incorrect answer ignoring the above rule: 3d6
          it("Small 2d6 up by one size step to 2d8", function () {
            expect(sizeRoll(2, 6, medium, small)[0].formula).to.equal("2d8");
          });
        });

        describe("entire pre-defined table", function () {
          describe("for medium creature", function () {
            const medSizeTransforms = [
              ["1", "1d3"],
              ["1", "1d4"],
              [null, "1d6"],
              [null, "1d8"],
              [null, "2d6"],
              [null, "3d6"],
              [null, "3d8"],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, null],
              [null, ""], // from this point on the rules no longer say what should happen for enlarging (going off chart)
              [null, ""],
              [null, ""],
              [null, ""],
            ];

            // Fill in parts that can be automatically determined
            medSizeTransforms.forEach(([reduced, enlarged], idx) => {
              if (reduced === null) medSizeTransforms[idx][0] = pf1.config.sizeDie[idx - 2];
              if (enlarged === null) medSizeTransforms[idx][1] = pf1.config.sizeDie[idx + 4];
            });

            describe("reduced twice", function () {
              medSizeTransforms.forEach(([reduced], idx) => {
                if (!reduced) return;
                const formula = pf1.config.sizeDie[idx];
                const [die, size] = formula.split("d", 2).map((n) => Number(n));
                it(`${formula} reduced twice to ${reduced}`, function () {
                  expect(sizeRoll(die || 1, size || 1, tiny)[0].formula).to.equal(reduced);
                });
              });
            });

            describe("enlarged twice", function () {
              medSizeTransforms.forEach(([_, enlarged], idx) => {
                if (!enlarged) return;
                const formula = pf1.config.sizeDie[idx];
                const [die, size] = formula.split("d", 2).map((n) => Number(n));
                it(`${formula} enlarged twice to ${enlarged}`, function () {
                  expect(sizeRoll(die || 1, size || 1, huge)[0].formula).to.equal(enlarged);
                });
              });
            });
          });

          describe("for large creature, reduced twice", function () {
            const lgSizeTransforms = [
              "1",
              "1",
              "1",
              "1d2",
              "1d3",
              "1d4",
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ];

            lgSizeTransforms.forEach((reduced, idx) => {
              // Fill in parts that can be automatically determined
              if (reduced === null) reduced = pf1.config.sizeDie[idx - 3];
              const formula = pf1.config.sizeDie[idx];
              const [die, size] = formula.split("d", 2).map((n) => Number(n));
              it(`${formula} reduced twice to ${reduced}`, function () {
                expect(sizeRoll(die || 1, size || 1, small, large)[0].formula).to.equal(reduced);
              });
            });
          });
        });
      });

      describe("if()", async function () {
        const tests = [
          ["1", "1d6", "1d6"],
          ["0", "1d6", "0"],
          ["3 < 2", "5", "0"],
          ["2 == 2", "2", "2"],
        ];
        for (const [cond, ifTrue, result] of tests) {
          const formula = `if(${cond}, ${ifTrue})`;
          it(`${formula} is ${result}`, async function () {
            const roll = await new Roll.defaultImplementation(formula).evaluate();
            const term = roll.terms[0];
            expect(term.simplify).to.equal(result);
          });
        }
      });

      describe("ifelse()", async function () {
        const tests = [
          ["1", "2", "3", "2"],
          ["0", "1d6", "2d6", "2d6"],
          ["3 < 2", "5", "100", "100"],
          ["2 == 2", "0", "2", "0"],
        ];

        for (const [cond, ifTrue, ifFalse, result] of tests) {
          const formula = `ifelse(${cond}, ${ifTrue}, ${ifFalse})`;
          it(`${formula} is ${result}`, async function () {
            const roll = await new Roll.defaultImplementation(formula).evaluate();
            const term = roll.terms[0];
            expect(term.simplify).to.equal(result);
          });
        }
      });

      describe("lookup()", async function () {
        const tests = [
          [["3", "-1", "10", "20", "30", "40", "50"], "30", 30],
          [["5", "-1", "1", "2", "3"], "-1", -1],
        ];

        for (const [vars, result, rval] of tests) {
          const formula = `lookup(${vars.join(", ")})`;
          it(`${formula} is ${result}`, async function () {
            const roll = await new Roll.defaultImplementation(formula).evaluate();
            const term = roll.terms[0];
            expect(term.simplify).to.equal(result);
            expect(roll.total).to.equal(rval);
          });
        }
      });
    },
    {
      displayName: "PF1: Roll Terminology",
    }
  );
}
