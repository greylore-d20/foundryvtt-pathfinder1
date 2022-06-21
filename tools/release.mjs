import fs from "fs-extra";
import { releaseLog } from "./changelog.mjs";
import yargs from "yargs";
import git from "simple-git";

const argv = yargs(process.argv.slice(2))
  .demandCommand(1, 1)
  .command("major", "Bump version to next major", async () => {
    await inc("major");
    commitTag();
  })
  .command("minor", "Bump version to next minor", async () => {
    await inc("minor");
    commitTag();
  })
  .command("patch", "Bump version to next patch", async () => {
    await inc("patch");
    commitTag();
  })
  .help().argv;

/**
 * Gets the current system version
 *
 * @returns {string | boolean} The current version
 */
function getTagVersion() {
  try {
    const file = fs.readFileSync("public/system.json", "utf-8");
    const data = JSON.parse(file);
    return data.version;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Increments the system's version and writes manifest
 *
 * @param {"major" | "minor" | "patch" } importance - The step by which the version should be increased
 */
async function inc(importance) {
  const version = getTagVersion();
  if (version) {
    let newVersion = version.split(".");
    switch (importance) {
      case "patch":
        newVersion[2]++;
        break;
      case "minor":
        newVersion[2] = 0;
        newVersion[1]++;
        break;
      case "major":
        newVersion[2] = 0;
        newVersion[1] = 0;
        newVersion[0]++;
        break;

      default:
        break;
    }
    newVersion = newVersion.join(".");
    await releaseLog(newVersion);

    const manifest = fs.readJsonSync("public/system.json");
    manifest.version = newVersion;
    fs.writeJsonSync("public/system.json", manifest);
  } else {
    throw new Error("Could not determine version!");
  }
}

/**
 * Commits current changes to the manifest and creates a new annotated tag
 */
function commitTag() {
  const version = getTagVersion();
  if (version) {
    git().commit(`Release v${version}`, ["public/system.json"]).addAnnotatedTag(`v${version}`, `Release v${version}`);
  } else {
    throw new Error("Could not determine version!");
  }
}
