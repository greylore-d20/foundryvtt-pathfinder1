import fs from "fs-extra";
import yargs from "yargs";
import git from "simple-git";
import prettier from "prettier";

import { releaseLog } from "./changelog.mjs";

yargs(process.argv.slice(2))
  .demandCommand(1, 1)
  .command("major", "Bump version to next major", async () => {
    await inc("major");
    await commitTag();
  })
  .command("minor", "Bump version to next minor", async () => {
    await inc("minor");
    await commitTag();
  })
  .help()
  .parse();

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
 * @param {"major" | "minor" } importance - The step by which the version should be increased
 */
async function inc(importance) {
  const version = getTagVersion();
  if (version) {
    let newVersion = version.split(".");
    switch (importance) {
      case "minor":
        newVersion[1]++;
        break;
      case "major":
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
    const prettierConfig = await prettier.resolveConfig(".");
    const formattedManifest = prettier.format(JSON.stringify(manifest, null, 2), { ...prettierConfig, parser: "json" });
    await fs.writeFile("public/system.json", formattedManifest);
  } else {
    throw new Error("Could not determine version!");
  }
}

/**
 * Commits current changes to the manifest and creates a new annotated tag
 */
async function commitTag() {
  const version = getTagVersion();
  if (version) {
    console.log(`Committing manifest and changelog for version ${version}`);
    await git().commit(`Release v${version}`, ["public/system.json", "CHANGELOG.md", "changelogs"]);
    console.log(`Checking out branch for release generation v${version.split(".")[0]}.x`);
    await git().checkoutLocalBranch(`v${version.split(".")[0]}.x`);
    console.log(`Creating tag v${version}`);
    await git().addAnnotatedTag(`v${version}`, `Release v${version}`);
    console.log(`Release creation complete!`);
    console.log(`To publish, run: git push --follow-tags origin v${version.split(".")[0]}.x`);
  } else {
    throw new Error("Could not determine version!");
  }
}
