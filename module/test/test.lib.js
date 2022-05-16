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
