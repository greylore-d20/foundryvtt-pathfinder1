import { convertDistance } from "./utils/lib.mjs";

/**
 * Initialize module compatibility/integration code.
 *
 * Currently integrated modules:
 * - Drag Ruler
 */
export function initializeModules() {
  // Drag Ruler
  {
    Hooks.once("dragRuler.ready", (SpeedProvider) => {
      const enhancedTerrain = game.modules.get("enhanced-terrain-layer")?.active;

      class Pf1SpeedProvider extends SpeedProvider {
        get colors() {
          return [
            { id: "walk", default: 0x00ff00, name: "SETTINGS.pf1DragRulerWalk" },
            { id: "dash", default: 0xffff00, name: "SETTINGS.pf1DragRulerDash" },
            { id: "run", default: 0xff8000, name: "SETTINGS.pf1DragRulerRun" },
          ];
        }

        getRanges(token) {
          const baseSpeed = convertDistance(this.getBaseSpeed(token))[0];
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
          const [y, x] = canvas.grid.grid.getGridPositionFromPixels(token.x, token.y);
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
              name: "SETTINGS.pf1DragRulerUseElevationName",
              hint: "SETTINGS.pf1DragRulerUseElevationHint",
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
