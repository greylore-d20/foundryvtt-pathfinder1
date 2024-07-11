/**
 * Initialize module compatibility/integration code.
 *
 * Currently integrated modules:
 * - Drag Ruler
 * - DSN (scattered game.dice3d usage)
 */
export function initializeModuleIntegration() {
  const integration = game.settings.get("pf1", "integration");
  // Drag Ruler <https://foundryvtt.com/packages/drag-ruler>
  if (game.modules.get("drag-ruler")?.active && integration.dragRuler) {
    Hooks.once("dragRuler.ready", (SpeedProvider) => {
      // TODO: Disable enhanced terrain layer support until the module is fixed or support for it is removed
      const enhancedTerrain = false; // game.modules.get("enhanced-terrain-layer")?.active && integration.enhancedTerrainLayer;

      class Pf1SpeedProvider extends SpeedProvider {
        get colors() {
          return [
            { id: "walk", default: 0x00ff00, name: "PF1.SETTINGS.DragRulerWalk" },
            { id: "dash", default: 0xffff00, name: "PF1.SETTINGS.DragRulerDash" },
            { id: "run", default: 0xff8000, name: "PF1.SETTINGS.DragRulerRun" },
          ];
        }

        getRanges(token) {
          const baseSpeed = pf1.utils.convertDistance(this.getBaseSpeed(token))[0];
          const rollData = token.actor.getRollData(),
            inHeavyArmor = rollData.armor.type >= pf1.config.armorTypes.heavy,
            inHeavyLoad = rollData.attributes.encumbrance.level >= pf1.config.encumbranceLevels.heavy;

          let runMultiplier = 4;
          if (inHeavyArmor || inHeavyLoad) runMultiplier = 3;
          return [
            { range: baseSpeed, color: "walk" },
            { range: baseSpeed * 2, color: "dash" },
            { range: baseSpeed * runMultiplier, color: "run" },
          ];
        }

        getBaseSpeed(token) {
          const { i: x, j: y } = canvas.grid.getOffset(token);
          const useElevation = this.getSetting("useElevation");
          const speeds = token.actor.system.attributes.speed;

          if (useElevation && token.document.elevation > 0) {
            const flySpeed = speeds.fly.total;
            if (flySpeed > 0) {
              return flySpeed;
            }
          }

          if (
            enhancedTerrain &&
            canvas.terrain.terrainFromGrid(x, y).some((terrain) => terrain.data.environment === "water")
          ) {
            const swimSpeed = speeds.swim.total;
            if (swimSpeed > 0) {
              return swimSpeed;
            }
          }

          if (useElevation && token.document.elevation < 0) {
            const burrowSpeed = speeds.burrow.total;
            if (burrowSpeed > 0) {
              return burrowSpeed;
            }
          }

          return speeds.land.total;
        }

        get settings() {
          return [
            {
              id: "useElevation",
              name: "PF1.SETTINGS.DragRulerUseElevationName",
              hint: "PF1.SETTINGS.DragRulerUseElevationHint",
              scope: "world",
              type: Boolean,
              default: true,
            },
          ];
        }
      }
      dragRuler.registerSystem("pf1", Pf1SpeedProvider);
    });
  }
}
