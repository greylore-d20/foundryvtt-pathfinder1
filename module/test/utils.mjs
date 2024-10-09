import { ItemPF } from "@item/item-pf.mjs";

/**
 * Fetches a pack entry's data, or the actual stored document
 *
 * @async
 * @param {string} packName - Pack in which the entry can be found
 * @param {string} entryName - Name of the entry
 * @param {boolean} [dataOnly] - Whether the entry's source data should be returned
 * @returns {Promise<object|ItemPF>} The entry's document or raw data
 */
export const fetchPackEntryData = async (packName, entryName, dataOnly = false) => {
  const pack = game.packs.get(packName);
  const entryId = pack.index.find((d) => d.name === entryName)?._id;
  const entry = await pack.getDocument(entryId);
  return dataOnly ? entry.toObject() : entry;
};
