import fs from "fs-extra";
import url from "node:url";
import path from "node:path";
import { globby } from "globby";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const langDist = path.resolve(__dirname, "../public/lang");
const langSource = path.resolve(__dirname, "../lang");

/**
 * Merges additional files (e.g. help browser files) into language .json files
 *
 * @returns {Promise<void[]>} - A promise that resolves to an array of paths to the updated files
 */
async function buildLanguageFiles() {
  await fs.ensureDir(langDist);
  const baseFileNames = await fs.readdir(langSource);

  // Treat English image files as canonical source, map wiki path to localisation path
  const enHelpImageDirectory = await fs.readdir("help/en/img");
  const imageFileExtensions = [".jpg", ".webp"];
  const baseImageFiles = enHelpImageDirectory
    .filter((file) => imageFileExtensions.some((extension) => file.endsWith(extension)))
    .map((imageFile) => ({
      jsonPath: `PF1.Help/img/${imageFile}`,
      jsonValue: `help/en/img/${imageFile}`,
      fileName: imageFile,
    }));

  const languageFiles = baseFileNames
    .filter((fileName) => fileName.endsWith(".json"))
    .map(async (fileName) => {
      const rawJson = await fs.readJson(path.join(langSource, fileName));
      const language = fileName.replace(".json", "");

      const helpFiles = await globby(`help/${language}/**/*.md`);
      const helpStrings = await Promise.all(
        helpFiles.map(async (helpFile) => {
          const text = await fs.readFile(helpFile, "utf8");

          const jsonPath = `PF1.${helpFile.replace(".md", "").replace(`help/${language}/`, "Help/")}`;
          return [jsonPath, text];
        })
      );
      helpStrings.forEach(([jsonPath, jsonValue]) => (rawJson[jsonPath] = jsonValue));

      if (language === "en") {
        // English image files require no further changes
        baseImageFiles.forEach(({ jsonPath, jsonValue }) => (rawJson[jsonPath] = jsonValue));
      } else if (fs.existsSync(`help/${language}/img`)) {
        // Insert localised images by their wiki format path
        const files = await fs.readdir(`help/${language}/img`);
        files
          .filter((file) => baseImageFiles.find(({ fileName }) => file === fileName) !== undefined)
          .forEach((imageFile) => {
            rawJson[`PF1.Help/img/${imageFile}`] = `help/${language}/img/${imageFile}`;
          });
      }

      const filePath = path.join(langDist, fileName);
      console.log(`Writing ${filePath}`);
      return fs.writeJson(filePath, rawJson, { spaces: 2 });
    });
  return Promise.all(languageFiles);
}

buildLanguageFiles();
