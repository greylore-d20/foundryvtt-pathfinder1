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

const SYSTEM_MANIFEST = "public/system.json";

/**
 * Gets the current system version
 *
 * @returns {string | boolean} The current version, or false if it cannot be determined
 */
function getTagVersion() {
  try {
    const file = fs.readFileSync(SYSTEM_MANIFEST, "utf-8");
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

    const manifest = fs.readJsonSync(SYSTEM_MANIFEST);
    manifest.version = newVersion;
    const prettierConfig = await prettier.resolveConfig(".");
    const formattedManifest = prettier.format(JSON.stringify(manifest, null, 2), { ...prettierConfig, parser: "json" });
    await fs.writeFile(SYSTEM_MANIFEST, formattedManifest);
  } else {
    throw new Error("Could not determine version!");
  }
}

/**
 * Commits current changes to the manifest to the current branch,
 * and creates a release tag on the version's release branch.
 *
 * @returns {Promise<void>} A promise that resolves when the commit and tag are complete
 * @throws {Error} If the version cannot be determined
 */
async function commitTag() {
  const version = getTagVersion();
  if (version) {
    const releaseBranchName = `v${version.split(".")[0]}.x`;
    const simpleGit = git();

    console.log(`Committing manifest and changelog for version ${version}`);
    await simpleGit.commit(`Release v${version}`, [SYSTEM_MANIFEST, "CHANGELOG.md", "changelogs"]);

    console.log(`Checking out branch for release generation ${releaseBranchName}`);
    if ((await simpleGit.branchLocal().current) !== releaseBranchName) {
      if ((await simpleGit.branchLocal()).all.includes(releaseBranchName)) {
        await simpleGit.checkout(releaseBranchName);
      } else {
        await simpleGit.checkoutLocalBranch(releaseBranchName);
      }
    }
    console.log(`Creating tag v${version}`);
    await simpleGit.addAnnotatedTag(`v${version}`, `Release v${version}`);

    console.log(`Release creation complete!`);
    console.log(`To publish, run: git push --follow-tags origin ${releaseBranchName}`);
  } else {
    throw new Error("Could not determine version!");
  }
}
