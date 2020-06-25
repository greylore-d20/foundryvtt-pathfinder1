const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

const conf = {
  name: "pf1",
  entry: {
    index: "./pf1.js",
  },
  mode: "development",
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: true,
        terserOptions: {
          compress: {
            keep_classnames: true,
          },
        },
      }),
    ],
  },
  output: {
    library: "pf1",
    libraryTarget: "umd",
    umdNamedDefine: true,
    publicPath: "systems/pf1/dist/",
    filename: "pf1.js",
    chunkFilename: "bundles/[name].js",
    path: path.resolve(__dirname, "dist"),
  },
};

module.exports = conf;
