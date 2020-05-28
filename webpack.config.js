const path = require("path");

module.exports = {
  name: "pf1",
  entry: {
    index: "./pf1.js",
  },
  mode: "development",
  output: {
    publicPath: "systems/pf1/dist/",
    filename: "pf1.js",
    chunkFilename: "bundles/[name].js",
    path: path.resolve(__dirname, "dist"),
  },
};
