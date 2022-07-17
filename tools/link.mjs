// SPDX-FileCopyrightText: 2021 Johannes Loher
// SPDX-FileCopyrightText: 2022 Ethaks
//
// SPDX-License-Identifier: MIT

import path from "node:path";
import url from "node:url";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs-extra";

import { foundryConfig } from "./foundry-config.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __filename = url.fileURLToPath(import.meta.url);
const resolve = (...args) => path.resolve(__dirname, "..", ...args);

// Configuration

/**
 * The directory that will be linked in Foundry's data directory.
 *
 * @type {string}
 */
const DIST_DIRECTORY = path.resolve(__dirname, "../dist");

/**
 * The type of Foundry package of this project
 *
 * @type {"module" | "system"}
 */
const PACKAGE_TYPE = "system";

/** The name of the JS config file */
const JS_CONFIG_FILE = "jsconfig.json";

// Command handling

if (process.argv[1] === __filename) {
  yargs(hideBin(process.argv))
    .demandCommand(1, 1)
    .command({
      command: "dist",
      describe: "Link dist directory to Foundry's Data",
      handler: async (argv) => {
        await linkPackage(argv.clean);
      },
    })
    .command({
      command: "jsconfig",
      describe: "Generate jsconfig.json file",
      handler: async (argv) => {
        if (argv.clean) {
          await cleanJsConfig();
          return;
        }

        await generateJsConfig({ app: argv.app });
      },
    })
    .option("app", { default: true, describe: "Include a link to Foundry's app directory in jsconfig.json" })
    .option("clean", { default: false, describe: "Remove jsconfig.json file" })
    .parse();
}

/**
 * Get the template for the `jsconfig.json` file from `jsconfig.template.json`.
 */
function getJsConfigTemplate() {
  const templatePath = resolve("jsconfig.template.json");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Could not find jsconfig.json.template at ${templatePath}`);
  } else {
    return fs.readJSONSync(templatePath);
  }
}

/**
 * Get the data path of Foundry VTT based on what is configured in {@link foundryConfig}.
 */
function getDataPath() {
  if (foundryConfig?.dataPath) {
    if (!fs.existsSync(path.resolve(foundryConfig.dataPath))) {
      throw new Error("User data path invalid, no Data directory found");
    }
    return path.resolve(foundryConfig.dataPath);
  } else {
    throw new Error(`No user data path defined in foundryconfig.json`);
  }
}

/**
 * Get the app path of Foundry VTT based on what is configured in {@link foundryConfig}.
 */
function getAppPath() {
  if (foundryConfig?.appPath) {
    if (!fs.existsSync(path.resolve(foundryConfig.appPath))) {
      throw new Error("App path invalid, no app directory found");
    }
    return path.resolve(foundryConfig.appPath);
  } else {
    throw new Error(`No app path defined in foundryconfig.json`);
  }
}

/**
 * Get the name/id of the package based on its manifest file.
 */
function getPackageName() {
  if (!fs.existsSync(resolve("public", `${PACKAGE_TYPE}.json`))) {
    throw new Error(`Could not find ${PACKAGE_TYPE}.json`);
  }
  const manifest = fs.readJSONSync(resolve("public", `${PACKAGE_TYPE}.json`));
  const name = manifest.id || manifest.name;
  if (!name) {
    throw new Error(`Could not find name in ${PACKAGE_TYPE}.json`);
  }
  return name;
}

/**
 * Link the built package to the user data folder.
 *
 * @param {boolean} clean Whether to remove the link instead of creating it
 */
async function linkPackage(clean) {
  const linkDirectory = path.resolve(getDataPath(), "Data", `${PACKAGE_TYPE}s`, getPackageName());

  if (clean) {
    console.log(`Removing link to built package at ${linkDirectory}.`);
    await fs.remove(linkDirectory);
  } else if (!fs.existsSync(linkDirectory)) {
    console.log(`Linking built package to ${linkDirectory}.`);
    await fs.ensureDir(path.resolve(linkDirectory, ".."));
    await fs.symlink(DIST_DIRECTORY, linkDirectory);
  }
}

/**
 * Generates a `jsconfig.json` file in the project's root directory.
 *
 * @param {boolean} app - Whether to include a link to the Foundry app directory
 */
async function generateJsConfig({ app }) {
  const content = getJsConfigTemplate();

  if (app) {
    content.compilerOptions.paths["@foundry/*"] = [path.resolve(getAppPath(), "*")];
  }

  console.log(`Writing ${JS_CONFIG_FILE}`);
  await fs.writeJson(resolve(JS_CONFIG_FILE), content, { spaces: 2 });
}

/** Remove the jsconfig.json file if it exists */
async function cleanJsConfig() {
  if (!fs.existsSync(resolve(JS_CONFIG_FILE))) {
    console.log(`${JS_CONFIG_FILE} does not exist, no need to clean.`);
    return;
  }

  console.log(`Removing ${JS_CONFIG_FILE}.`);
  await fs.remove(resolve(JS_CONFIG_FILE));
}
