// Override core border drawing
const Token_refreshBorder = Token.prototype._refreshBorder; // save original
Token.prototype._refreshBorder = (function () {
  const cached = Token.prototype._refreshBorder; // save original

  return function () {
    this.border.clear();
    const borderColor = this._getBorderColor();
    if (!borderColor) return;

    const { width, height } = this.data;
    const gt = CONST.GRID_TYPES;
    const hexTypes = [gt.HEXEVENQ, gt.HEXEVENR, gt.HEXODDQ, gt.HEXODDR];
    // Draw hex border, but only if width and height are equal
    if (hexTypes.includes(canvas.grid.type) && width === height) {
      // TODO: Render better border
      const polygon = canvas.grid.grid.getPolygon(-1, -1, this.w + 2, this.h + 2);
      this.border.lineStyle(4, 0x000000, 0.8).drawPolygon(polygon);
      this.border.lineStyle(2, borderColor || 0xff9829, 1.0).drawPolygon(polygon);
    }
    // Otherwise Draw Square border
    else {
      this.border.lineStyle(4, 0x000000, 0.8).drawRoundedRect(-1, -1, this.w + 2, this.h + 2, 3);
      this.border.lineStyle(2, borderColor || 0xff9829, 1.0).drawRoundedRect(-1, -1, this.w + 2, this.h + 2, 3);
    }
  };
})();
