/**
 * Fetch mapping of class identifier to class name.
 *
 * @returns {Record<string,string>}
 */
export async function getClassIDMap() {
  if (this.classIDMap) return this.classIDMap;

  const packTypePriority = {
    world: 4_000,
    module: 3_000,
    system: 2_000,
  };

  // Sort packs by above criteria, higher priority last so they override earlier entries
  let packs = [...game.packs]
    .map((p) => ({
      pack: p,
      visible: p.visible ?? true,
      disabled: p.config.pf1?.disabled ?? false,
      sort: packTypePriority[p.metadata.packageType],
    }))
    .filter((p) => !p.disabled && p.visible && p.pack.metadata.type === "Item")
    .sort((a, b) => a.sort - b.sort);

  await Promise.all(packs.map((p) => p.pack.getIndex({ fields: ["system.tag", "system.subType"] })));

  // Only take packs with Just classes, assume first item being class is good enough for this
  packs = packs.filter((p) => p.pack.index.size > 0 && [...p.pack.index][0]?.type === "class");

  const classes = {};

  for (const { pack } of packs) {
    for (const entry of pack.index) {
      if (entry.system?.subType && !["base", "npc"].includes(entry.system?.subType)) continue;

      const tag = entry.system?.tag;
      if (!tag) continue;

      classes[tag] = entry.name;
    }
  }

  this.classIDMap = classes;
  return classes;
}
