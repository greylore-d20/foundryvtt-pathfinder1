/**
 * Measure the distance between two pixel coordinates
 * See BaseGrid.measureDistance for more details
 *
 * @deprecated
 * @param segments
 * @param options
 */
export const measureDistances = function (segments, options = {}) {
  foundry.utils.logCompatibilityWarning(
    "pf1.utils.canvas.measureDistances() is deprecated in favor of canvas.grid.measurePath()",
    {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    }
  );
  return canvas.grid.measureDistances(segments, options);
};
