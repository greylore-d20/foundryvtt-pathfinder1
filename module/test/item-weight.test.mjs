import { createTestActor } from "./actor-utils.mjs";
import { fetchPackEntryData } from "./utils.mjs";
import { convertWeight, getWeightSystem } from "../utils/lib.mjs";

export const registerItemWeightTests = () => {
  quench.registerBatch(
    "pf1.item-weight",
    async (context) => {
      const { describe, it, expect, before, after } = context;

      let actor;
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

        // Create world item
        const acid = await fetchPackEntryData("pf1.items", "Acid");
        const pack = game.packs.get("pf1.items");
        items.worldAcid = await game.items.importFromCompendium(pack, acid.id);
        const embeddedDocs = await actor.createEmbeddedDocuments("Item", acid.toObject());
        items.embeddedAcid = embeddedDocs[0];

        settingUnits = game.settings.get("pf1", "units");
        settingWeightUnits = game.settings.get("pf1", "weightUnits");
      });
      after(async () => {
        await items.embeddedAcid?.sheet?.close({ force: true });
        await items.worldAcid.sheet?.close({ force: true });
        await items.worldAcid.delete();
        await actor.sheet.close({ force: true });
        await actor.delete();

        await game.settings.set("pf1", "units", settingUnits);
        await game.settings.set("pf1", "weightUnits", settingWeightUnits);
      });

      for (const { units, weightUnits } of configurations) {
        describe(`Using ${units} units and ${weightUnits} weight units:`, function () {
          this.timeout(15_000); // These are slow tests
          before(async () => {
            await game.settings.set("pf1", "units", units);
            await game.settings.set("pf1", "weightUnits", weightUnits);
          });

          it("Settings should be applied correctly", function () {
            expect(game.settings.get("pf1", "weightUnits")).to.equal(weightUnits);
            expect(game.settings.get("pf1", "units")).to.equal(units);
            let expectedSystem = weightUnits;
            if (expectedSystem === "default") expectedSystem = units;
            expect(getWeightSystem()).to.equal(expectedSystem);
          });

          for (const kind of ["world", "embedded"]) {
            describe(`${kind.capitalize()} item 'Acid'`, function () {
              let item, getItemSheetWeight, getActorSheetCarried;
              before(async () => {
                item = items[`${kind}Acid`];
                await item.update({ "system.quantity": 1, "system.weight.value": 1 });
                item.reset(); // Force reset for weight system change
                getItemSheetWeight = async () => {
                  await item.sheet._render(true);
                  return item.sheet._element.find("input[name='system.weight.value']").val();
                };
                getActorSheetCarried = async () => {
                  await actor.sheet._render(true);
                  return actor.sheet._element.find(".inventory-tags.tag-list span").first().text();
                };
              });

              it("should have a weight of 1 lbs/0.5 kg", async function () {
                expect(item.system.quantity).to.equal(1);
                expect(item.system.weight.total).to.equal(1);
                expect(item.system.weight.converted.value).to.equal(convertWeight(1));
                expect(item.system.weight.converted.total).to.equal(convertWeight(1));
                expect(await getItemSheetWeight()).to.equal(getPresentationForWeight(1));
              });
              it("should have a price of 10g", function () {
                expect(item.system.price).to.equal(10);
              });

              if (kind === "embedded") {
                it("should add its weight to the actor", async function () {
                  expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(convertWeight(1));
                  expect(await getActorSheetCarried()).to.equal(getCarriedPresentationForWeight(1));
                });
              }

              describe("with a quantity of 2", function () {
                before(async () => {
                  await item.update({ "system.quantity": 2 });
                });

                it("should have a total weight of 2 lbs/1 kg", async function () {
                  expect(item.system.quantity).to.equal(2);
                  expect(item.system.weight.total).to.equal(2);
                  expect(item.system.weight.converted.value).to.equal(convertWeight(1));
                  expect(item.system.weight.converted.total).to.equal(convertWeight(2));
                  expect(await getItemSheetWeight()).to.equal(getPresentationForWeight(2));
                });
                it("should have a sell value of 10g", function () {
                  expect(item.getValue({ sellValue: 1 })).to.equal(20);
                  expect(item.getValue()).to.equal(10);
                  expect(item.system.price).to.equal(10);
                });

                if (kind === "embedded") {
                  it("should add its weight to the actor", async function () {
                    expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(convertWeight(2));
                    expect(await getActorSheetCarried()).to.equal(getCarriedPresentationForWeight(2));
                  });
                }

                describe("and a weight value of 10", function () {
                  before(async () => {
                    await item.update({ "system.weight.value": 10 });
                  });

                  it("should have a total weight of 20 lbs/10 kg", async function () {
                    expect(item.system.quantity).to.equal(2);
                    expect(item.system.weight.total).to.equal(20);
                    expect(item.system.weight.converted.value).to.equal(convertWeight(10));
                    expect(item.system.weight.converted.total).to.equal(convertWeight(20));
                    expect(await getItemSheetWeight()).to.equal(getPresentationForWeight(20));
                  });

                  if (kind === "embedded") {
                    it("should add its weight to the actor", async function () {
                      expect(actor.system.attributes.encumbrance.carriedWeight).to.equal(convertWeight(20));
                      expect(await getActorSheetCarried()).to.equal(getCarriedPresentationForWeight(20));
                    });
                  }
                });
              });
            });
          }
        });
      }
    },
    { displayName: "PF1: Item Weight and Price Tests" }
  );
};

/**
 * Returns a weight's presentation as it its shown in item sheets
 *
 * @param {number} weight - The weight for which a string is generated
 * @returns {string} The weight's presentation
 */
const getPresentationForWeight = (weight) => `${Math.roundDecimals(convertWeight(weight), 2).toFixed(2)}`;

/**
 * Returns a weight's presentation as it its shown in the actor sheet's carried weight tag
 *
 * @param {number} weight - The weight for which a string is generated
 * @returns {string} The weight's presentation
 */
const getCarriedPresentationForWeight = (weight) => {
  let usystem = game.settings.get("pf1", "weightUnits"); // override
  if (usystem === "default") usystem = game.settings.get("pf1", "units");
  const displayWeight = Math.roundDecimals(convertWeight(weight), 1);
  if (usystem === "metric") return game.i18n.format("PF1.CarryLabelKg", { kg: displayWeight });
  else return game.i18n.format("PF1.CarryLabel", { lbs: displayWeight });
};
