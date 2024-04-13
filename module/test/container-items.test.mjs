import { createTestActor } from "./actor-utils.mjs";
import { fetchPackEntryData } from "./utils.mjs";

export const registerContainerItemTests = () => {
  quench.registerBatch(
    "pf1.container-items",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      /**
       * Handles a shared context to pass between functions
       *
       * @type {object}
       */
      const shared = {};
      /** @type {pf1.documents.actor.ActorPF} */
      let actor;
      const messages = [];
      const items = {};
      let settingUnits, settingWeightUnits;

      const configurations = [
        { units: "imperial", weightUnits: "default" },
        { units: "metric", weightUnits: "default" },
        { units: "imperial", weightUnits: "metric" },
        { units: "metric", weightUnits: "imperial" },
      ];

      before(async () => {
        // Use permanent actor to allow testing regular item creation calls
        actor = await createTestActor({}, { temporary: false });
        shared.actor = actor;

        settingUnits = game.settings.get("pf1", "units");
        settingWeightUnits = game.settings.get("pf1", "weightUnits");
      });
      after(async () => {
        await actor.delete();

        // Clean messages
        await ChatMessage.implementation.deleteDocuments(messages.map((o) => o.id));

        // Reset settings
        await game.settings.set("pf1", "units", settingUnits);
        await game.settings.set("pf1", "weightUnits", settingWeightUnits);
      });

      describe("basic container item", function () {
        before(async () => {
          items.container = await Item.implementation.create(
            {
              name: "Some Container",
              type: "container",
            },
            { parent: actor }
          );
        });

        it("should be able to be added to an actor", function () {
          expect(items.container instanceof CONFIG.Item.documentClasses.container).to.be.true;
        });
        it("should have an empty 'items' collection", function () {
          expect(items.container.items instanceof Collection).to.be.true;
          expect(items.container.items.contents.length).to.equal(0);
        });
        it("should add no weight to actor", function () {
          expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(0);
        });
        it("should render a sheet", async function () {
          await items.container.sheet._render(true);
          expect(items.container.sheet.rendered).to.be.true;
          items.container.sheet.close({ submit: false });
        });
      });

      for (const { units, weightUnits } of configurations) {
        describe(`Using ${units} units and ${weightUnits} weight units:`, function () {
          this.timeout(15_000); // These are too slow tests
          before(async () => {
            await game.settings.set("pf1", "units", units);
            await game.settings.set("pf1", "weightUnits", weightUnits);
            actor.reset();
          });

          it("Settings should be applied correctly", function () {
            expect(game.settings.get("pf1", "weightUnits")).to.equal(weightUnits);
            expect(game.settings.get("pf1", "units")).to.equal(units);
          });

          describe("alchemist's fire in a container", function () {
            before(async () => {
              const itemData = await fetchPackEntryData("pf1.items", "Alchemist's Fire", true);
              itemData.system.quantity = 10;
              await items.container.createContainerContent(itemData, { raw: true });
              items.alchemistsFire = items.container.items.contents[0];
            });
            after(async () => {
              await items.container.deleteContainerContent(items.alchemistsFire.id);
            });

            it("should be able to be added to the container", function () {
              expect(items.container.items.contents.length).to.equal(1);
              expect(items.alchemistsFire instanceof CONFIG.Item.documentClasses.weapon).to.be.true;
            });
            it("should add to the container's weight", function () {
              expect(items.container.system.weight.total).to.equal(10);
              expect(items.container.system.weight.contents).to.equal(10);
              expect(items.container.system.weight.total).to.equal(items.alchemistsFire.system.weight.value * 10);
              expect(items.container.system.weight.total).to.equal(items.alchemistsFire.system.weight.total);
            });
            it("should add the weight of the item to the actor", function () {
              expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(pf1.utils.convertWeight(10));
            });
            it("should increase the container's value", function () {
              expect(items.container.getValue({ recursive: true })).to.equal(100);
            });
            it("should increase the actor's total item value in the sheet", function () {
              expect(actor.sheet.calculateTotalItemValue({ recursive: true })).to.equal(200);
              expect(actor.sheet.calculateSellItemValue({ recursive: true })).to.equal(100);
            });

            describe("should be usable from inside the container and", function () {
              let roll;
              before(async () => {
                roll = await items.alchemistsFire.use({ skipDialog: true });
                messages.push(roll);
              });

              it("create a message", function () {
                expect(roll instanceof ChatMessage.implementation).to.be.true;
              });
              it("have the right formula", function () {
                expect(roll.flags.pf1.metadata.rolls.attacks[0].attack.formula).to.equal("1d20 + 2[Dexterity]");
              });
              it("reduce its quantity by 1", function () {
                expect(items.alchemistsFire.system.quantity).to.equal(9);
              });
              it("reduce the container's weight", function () {
                expect(items.container.system.weight.total).to.equal(9);
                expect(items.container.system.weight.contents).to.equal(9);
              });
              it("and reduce the actor's weight", function () {
                expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(pf1.utils.convertWeight(9));
              });
              it("reduce the container's overall value", function () {
                expect(items.container.getValue({ recursive: true })).to.equal(90);
              });
              it("reduce the actor's total item value in the sheet", function () {
                expect(actor.sheet.calculateTotalItemValue({ recursive: true })).to.equal(180);
                expect(actor.sheet.calculateSellItemValue({ recursive: true })).to.equal(90);
              });
            });

            describe("with weight reduction", function () {
              before(async () => {
                await items.alchemistsFire.update({ "system.quantity": 90 });
                // NOTE: This value is to be kept until the last test in this configuration and only cleaned up after that
                await items.container.update({ "system.weight.reduction.percent": 50 });
              });

              it("should have the right quantity", function () {
                expect(items.alchemistsFire.system.quantity).to.equal(90);
              });
              it("should have the right weight", function () {
                expect(items.container.system.weight.total).to.equal(45);
                expect(items.container.system.weight.contents).to.equal(90);
              });
              it("should increase the actor's carried weight", function () {
                expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(pf1.utils.convertWeight(45));
              });
            });

            describe("and own container weight", function () {
              before(async () => {
                // NOTE: This value is to be kept until the last test in this configuration and only cleaned up after that
                await items.container.update({ "system.weight.value": 10 });
              });

              it("should have the right total weight", function () {
                expect(items.container.system.weight.value).to.equal(10);
                expect(items.container.system.weight.total).to.equal(55);
              });
              it("should have the right contents weight", function () {
                expect(items.container.system.weight.contents).to.equal(90);
                expect(items.container.system.weight.converted.contents).to.equal(pf1.utils.convertWeight(90));
              });
              it("should increase the actor's carried weight", function () {
                expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(pf1.utils.convertWeight(55));
              });
            });
          });

          describe("with currency", function () {
            before(async () => {
              await items.container.update({
                "system.currency": {
                  gp: 100,
                  sp: 50,
                },
              });
            });
            after(async () => {
              await items.container.update({ "system.currency": { pp: 0, gp: 0, sp: 0, cp: 0 } });
            });

            it("should have the correct value", function () {
              expect(items.container.getValue({ recursive: true })).to.equal(105);
              expect(items.container.getTotalCurrency()).to.equal(105);
              expect(items.container.getValue({ recursive: true, inLowestDenomination: true })).to.equal(10500);
              expect(items.container.getTotalCurrency({ inLowestDenomination: true })).to.equal(10500);
            });
            it("should have the right weight", function () {
              expect(items.container.system.weight.total).to.equal(11.5);
              expect(items.container.system.weight.currency).to.equal(1.5);
            });
            it("should add its weight to the actor", function () {
              expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(
                Math.roundDecimals(pf1.utils.convertWeight(11.5), 1)
              );
            });
            it("should add its value to the actor", function () {
              expect(actor.sheet.calculateTotalItemValue({ recursive: true })).to.equal(105);
              expect(actor.sheet.calculateSellItemValue({ recursive: true })).to.equal(105);
            });

            describe("and own value", function () {
              before(async () => {
                await items.container.update({ "system.price": 100 });
              });
              after(async () => {
                await items.container.update({
                  "system.price": 0,
                  "system.weight.value": 0,
                  "system.weight.reduction.percent": 0,
                });
              });

              it("should have the correct value", function () {
                expect(items.container.getValue({ recursive: true })).to.equal(155);
                expect(items.container.getTotalCurrency()).to.equal(105);
              });
              it("should add its value to the actor", function () {
                expect(actor.sheet.calculateTotalItemValue({ recursive: true })).to.equal(205);
                expect(actor.sheet.calculateSellItemValue({ recursive: true })).to.equal(155);
              });
            });
          });
        });
      }
    },
    { displayName: "PF1: Container Item Tests" }
  );
};
