import { ActorPF } from "../documents/actor/actor-pf.mjs";
import { ItemPF } from "../documents/item/item-pf.mjs";
import { fetchPackEntryData } from "./utils.mjs";

/**
 * Options affecting the creation of test actors
 *
 * @typedef {object} CreateTestActorOptions
 * @property {boolean} [temporary] - Whether only a temporary actor should be created
 * @property {boolean} [prepareData] - Whether a temporary actor's data should be prepared
 */

/**
 * @param {object} data - Additional data merged into the actor to be created
 * @param {CreateTestActorOptions} options - Additional options affecting the actor's creation
 * @returns {Promise<ActorPF>} The created actor
 */
export const createTestActor = async (data = {}, options = {}) => {
  const createData = mergeObject(
    {
      name: "Dummy",
      type: "character",
      system: {
        abilities: {
          str: { value: 12 },
          dex: { value: 14 },
          con: { value: 16 },
          int: { value: 13 },
          wis: { value: 15 },
          cha: { value: 17 },
        },
      },
    },
    data
  );
  const { temporary = false, prepareData = true } = options;
  /** @type {ActorPF} */
  const actor = await CONFIG.Actor.documentClass.create(createData, { temporary });
  if (temporary && prepareData) actor.prepareData();
  return actor;
};

/**
 * Adds an item from a compendium to an actor
 *
 * @async
 * @param {ActorPF} actor - The actor to which the item will be added
 * @param {string} packName - The compendium's name in which the item can be found
 * @param {string} itemName - The name of the item to be added
 * @param {object} [extraData] - Additional data to be merged into the item's data
 * @returns {Promise<ItemPF>} The item added to the actor
 */
export const addCompendiumItemToActor = async (actor, packName, itemName, extraData) => {
  const packItemData = await fetchPackEntryData(packName, itemName, true);
  const data = mergeObject(packItemData, extraData ?? {});
  const isTemporaryActor = !actor.id;
  const item = await CONFIG.Item.documentClass.create(data, { parent: actor, temporary: isTemporaryActor });
  if (isTemporaryActor) actor.prepareData();
  return item;
};

/**
 * Opens the sheet and closes it.
 * This could emit errors on its own in some cases, so it can be an important test.
 *
 * @param {object} shared - The shared context for this batch of tests.
 * @param {import("@ethaks/fvtt-quench").QuenchBatchContext} context
 * @param {object} [options] - Optional options to pass.
 * @param {string} [options.altName] - An alternate name to give to the test.
 */
export const unitTest_renderActorSheet = (shared, context, options = { altName: null }) => {
  const { describe, before, it, expect } = context;

  describe(options.altName ?? "render sheet", function () {
    let sheet;
    before(() => {
      sheet = shared.actor.sheet;
    });

    it("sheet should be an ActorSheet", function () {
      expect(sheet instanceof ActorSheet).to.be.true;
    });

    it("sheet should render", async function () {
      await sheet.render(true);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });
      await sheet.close();
    });
  });
};
