import { D20RollPF } from "@dice/d20roll.mjs";

/**
 * @param {string} formula
 * @param {Partial<RollTerm.EvaluationOptions> & D20RollConstructorOptions & {rollData?: object}} [options]
 * @returns {Promise<D20RollPF>}
 */
async function rollD20(formula, options = {}) {
  const { rollData = {}, ...rollOptions } = options;
  const roll = new D20RollPF(formula, rollData ?? {}, rollOptions);
  await roll.evaluate();
  return roll;
}

export function registerD20RollTests() {
  quench.registerBatch(
    "pf1.dice.d20roll",
    async (context) => {
      const { describe, it, expect, after, assert } = context;

      describe("D20RollPF", function () {
        describe("#evaluate", function () {
          it("should roll a d20", async function () {
            const roll = await rollD20("1d20");
            expect(roll.total).to.be.a("number");
            expect(roll.total).to.be.within(1, 20);
            expect(roll.terms[0].formula).to.equal("1d20");
          });

          it("should roll a d20 with a modifier", async function () {
            const roll = await rollD20("1d20+2");
            expect(roll.total).to.be.a("number");
            expect(roll.total).to.be.within(3, 22);
            expect(roll.terms[0].formula).to.equal("1d20");
            expect(roll.terms[2].formula).to.equal("2");
          });

          it("should coerce a numeric first term into a static roll when none is given", async function () {
            const roll = await rollD20("20+2");
            expect(roll.total).to.equal(22);
            expect(roll.terms[0].formula).to.equal("1d20");
            expect(roll.terms[2].formula).to.equal("2");
          });

          it("should resolve data", async function () {
            const roll = await rollD20("1d20+@mod", { rollData: { mod: 2 } });
            expect(roll.total).to.be.a("number");
            expect(roll.total).to.be.within(3, 22);
            expect(roll.terms[0].formula).to.equal("1d20");
            expect(roll.terms[2].formula).to.equal("2");
          });

          it("should reject a formula beginning with a number when a static roll is given", async function () {
            const formula = "20 + 2";
            try {
              await rollD20(formula, { staticRoll: 10 });
            } catch (err) {
              expect(err instanceof Error).to.be.true;
              expect(err.message).to.equal(`Invalid D20RollPF formula provided: ${formula}`);
              return;
            }
            assert.fail();
          });

          it("should reject a formula beginning with neither a roll nor a number", async function () {
            const formula = " + 2";
            try {
              await rollD20(formula);
            } catch (err) {
              expect(err instanceof Error).to.be.true;
              expect(err.message).to.equal(`Invalid D20RollPF formula provided: ${formula}`);
              return;
            }
            assert.fail();
          });

          it("should not replace a non-rollable first term with a static roll", async function () {
            const formula = "+";
            try {
              await rollD20(formula);
            } catch (err) {
              expect(err instanceof Error).to.be.true;
              expect(err.message).to.equal(`Invalid D20RollPF formula provided:  ${formula} `);
              return;
            }
            assert.fail();
          });

          it("should replace an active result with the static roll", async function () {
            const roll = await rollD20("3d20kh", { staticRoll: 10 });
            expect(roll.total).to.equal(10);
            expect(roll.terms[0].results.find((r) => r.active).result).to.equal(10);
          });

          it("should recognize a static roll of 20 as crit", async function () {
            const roll = await rollD20("1d20", { staticRoll: 20 });
            expect(roll.total).to.equal(20);
            expect(roll.isCrit).to.be.true;
          });

          it("should recognize a static roll of 1 as nat 1", async function () {
            const roll = await rollD20("1");
            expect(roll.total).to.equal(1);
            expect(roll.isNat1).to.be.true;
          });

          it("should handle a bonus to the roll", async function () {
            const roll = await rollD20("1d20", { bonus: 2 });
            expect(roll.total).to.be.within(3, 22);
            expect(roll.terms[0].formula).to.equal("1d20");
            expect(roll.terms[2].formula).to.equal("2");
          });

          it("should handle a static roll with a bonus", async function () {
            const roll = await rollD20("1d20", { staticRoll: 10, bonus: 2 });
            expect(roll.total).to.equal(12);
            expect(roll.terms[0].formula).to.equal("1d20");
            expect(roll.terms[0].total).to.equal(10);
            expect(roll.terms[2].formula).to.equal("2");
            expect(roll.formula).to.equal("1d20 + 2");
          });
        });

        describe("#formula", function () {
          it("should return a correct basic formula", function () {
            const roll = new D20RollPF("1d20+2");
            expect(roll.formula).to.equal("1d20 + 2");
          });

          it("should return a correct formula with a static roll", function () {
            const roll = new D20RollPF("1d20+2", {}, { staticRoll: 10 });
            expect(roll.formula).to.equal("1d20 + 2");
            expect(roll.options.staticRoll).to.equal(10);
          });

          it("should return a full formula if a bonus is included", function () {
            const roll = new D20RollPF("1d20+2", {}, { bonus: 2 });
            expect(roll.formula).to.equal("1d20 + 2 + 2");
          });
        });

        describe("#toMessage", function () {
          const messages = [];
          after(async () => {
            await ChatMessage.deleteDocuments(messages.map((m) => m.id));
          });

          let msg;
          it("should create a chat message", async function () {
            const roll = new D20RollPF("1d20");
            msg = await roll.toMessage();
            messages.push(msg);
            expect(msg).to.be.an.instanceof(ChatMessage);
          });
          it("message main roll should be 1d20", function () {
            expect(msg.rolls[0].formula).to.equal("1d20");
          });
          it("message sound should be the default sound", function () {
            expect(msg.sound).to.equal(CONFIG.sounds.dice);
          });

          it("should create a chat message with options", async function () {
            const roll = new D20RollPF("1d20+@mod", { mod: 3 }, { staticRoll: 12, bonus: 2, flavor: "Test" });
            const message = await roll.toMessage(
              {},
              {
                rollMode: "selfroll",
                subject: { test: true },
                chatTemplateData: { properties: [{ header: "Tprops", value: ["proptest"] }] },
                noSound: true,
              }
            );
            messages.push(message);
            expect(message).to.be.an.instanceof(ChatMessage);
            expect(message.rolls[0].formula).to.equal("1d20 + 3 + 2");
            expect(message.rolls[0].total).to.equal(17);
            expect(message.whisper).to.include(game.user.id);
            expect(message.flags.pf1.subject).to.deep.equal({ test: true });
            expect(message.sound).to.equal(undefined);

            // HTML
            const element = document.createElement("div");
            element.innerHTML = message.content;
            expect(element.querySelector(".flavor-text").textContent).to.include("Test");
            expect(element.querySelector(".flavor-text i.abnormal.take-x")).to.exist;
            expect(element.querySelector(".flavor-text i.abnormal.take-x").dataset.tooltip).to.equal(
              game.i18n.format("PF1.TakeX", { number: 12 })
            );
            expect(element.querySelector(".tag-list .tag").textContent).to.include("proptest");
          });
        });
      });

      describe("pf1.dice.d20Roll", function () {
        const messages = [];
        after(async () => {
          await ChatMessage.deleteDocuments(messages.map((m) => m.id));
        });

        it("should roll a d20 with only skipDialog set", async function () {
          const message = await pf1.dice.d20Roll({ skipDialog: true });
          messages.push(message);
          expect(message.rolls[0]).to.be.an.instanceof(D20RollPF);
          expect(message.rolls[0].total).to.be.within(1, 20);
          expect(message.rolls[0].terms[0].formula).to.equal("1d20");
        });

        it("should render a dialog", async function () {
          const messagePromise = pf1.dice.d20Roll();
          // Dirty and slow check for the dialog to be rendered
          await quench.utils.pause(200);
          const dialog = Object.values(ui.windows).find((w) => w instanceof Dialog && "takeTen" in w.data.buttons);
          dialog.element[0].querySelector(".takeTen").click();
          const message = await messagePromise;
          messages.push(message);
          expect(message).to.be.an.instanceof(ChatMessage);
          expect(message.rolls[0].formula).to.equal("1d20");
        });

        it("should render a dialog with options set", async function () {
          const messagePromise = pf1.dice.d20Roll({ staticRoll: 12, bonus: 2, flavor: "Test" });
          // Dirty and slow check for the dialog to be rendered
          await quench.utils.pause(400);
          const dialog = Object.values(ui.windows).find(
            (app) => app instanceof Dialog && "takeTen" in app.data.buttons
          );
          const element = dialog.element[0];

          // Testing dialog contents
          const title = element.querySelector(".window-title").textContent;
          expect(title).to.equal("Test");
          const d20 = element.querySelector('input[name="d20"]');
          expect(d20.value).to.equal("12");
          d20.value = 13;
          const bonus = element.querySelector('input[name="bonus"]');
          expect(bonus.value).to.equal("2");
          bonus.value = 3;

          element.querySelector(".normal").click();
          const message = await messagePromise;
          messages.push(message);

          expect(message).to.be.an.instanceof(ChatMessage);
          expect(message.rolls[0].formula).to.equal("1d20 + 3");
          expect(message.rolls[0].total).to.equal(16);

          // Message HTML
          const messageElement = document.createElement("div");
          messageElement.innerHTML = message.content;
          expect(messageElement.querySelector(".flavor-text").textContent).to.include("Test");
          expect(messageElement.querySelector(".flavor-text i.abnormal.take-x")).to.exist;
          expect(messageElement.querySelector(".flavor-text i.abnormal.take-x").dataset.tooltip).to.equal(
            game.i18n.format("PF1.TakeX", { number: 13 })
          );
        });
      });
    },
    {
      displayName: "PF1: Roll – D20RollPF",
    }
  );
}
