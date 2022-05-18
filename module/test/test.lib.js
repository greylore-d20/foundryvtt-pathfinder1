export const createTestActor = async () => {
  // Delete previous test actor, if any exists
  let actor = game.actors.getName("Quench Test Actor");
  if (actor) await actor.delete();

  // Create new test actor
  actor = await CONFIG.Actor.documentClass.create({
    name: "Quench Test Actor",
    type: "character",
  });

  return actor;
};

export const addCompendiumItemToActor = async (actor, compendiumId, itemName, extraData) => {
  const pack = game.packs.get(compendiumId);
  const item = (await pack.getDocuments({ name: itemName }))[0];
  const data = extraData ? mergeObject(item.data.toObject(), extraData) : item.data.toObject();
  const items = await CONFIG.Item.documentClass.createDocuments([data], { parent: actor });
  actor.prepareData();
  return items[0];
};
