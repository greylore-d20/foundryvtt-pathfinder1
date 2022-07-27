import fs from "fs-extra";
import url from "node:url";
import path from "node:path";
import { globby } from "globby";
import yargs from "yargs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __filename = url.fileURLToPath(import.meta.url);
const langDist = path.resolve(__dirname, "../public/lang");
const langSource = path.resolve(__dirname, "../lang");

// Only handle commands if this script was executed directly
if (process.argv[1] === __filename) {
  yargs(process.argv.slice(2))
    .demandCommand(1, 1)
    .command({
      command: "build [languages...]",
      describe: "Build language files",
      handler: async (argv) => {
        if (argv.languages?.length) {
          await Promise.allSettled(argv.languages.map((language) => buildLanguageFile(language)));
        } else {
          await buildLanguageFiles();
        }
      },
    })
    .parse();
}
/**
 * @typedef {Record<string, string | Translation>} Translation
 */

/**
 * Merges additional files (e.g. help browser files) into language .json files
 *
 * @param {Record<"info" | "warn" | "error", (any) => void>} [logger=console] - A logger to use, defaults to `console`
 * @returns {Promise<{values: {language: string, content: Translation}[], errors: LanguageFileError[]}>} - An array of objects containing their language and their file's content
 */
export async function buildLanguageFiles({ logger = console } = {}) {
  const baseFileNames = await fs.readdir(langSource);
  const languageFiles = baseFileNames.filter((fileName) => fileName.endsWith(".json"));
  const baseImageFiles = await getImageData();
  const languagePromises = languageFiles.map((fileName) =>
    buildLanguageFile(path.basename(fileName, ".json"), { logger, baseImageFiles })
  );
  const languageResults = await Promise.all(languagePromises);
  return {
    values: languageResults.filter((result) => "content" in result),
    errors: languageResults.filter((result) => "error" in result),
  };
}

async function getImageData() {
  // Treat English image files as canonical source, map wiki path to localisation path
  const enHelpImageDirectory = await fs.readdir("help/en/img");
  const imageFileExtensions = [".jpg", ".webp"];
  return enHelpImageDirectory
    .filter((file) => imageFileExtensions.some((extension) => file.endsWith(extension)))
    .map((imageFile) => ({
      jsonPath: `PF1.Help/img/${imageFile}`,
      jsonValue: `help/en/img/${imageFile}`,
      fileName: imageFile,
    }));
}

/**
 * Merges additional files (e.g. help browser files) into language .json files
 *
 * @param {string} language - The language whose file is to be built
 * @param {Record<"info" | "warn" | "error", (any) => void>} [logger=console] - A logger to use, defaults to `console`
 * @param {{jsonPath: string, jsonValue: string, fileName: string }[]} [baseImageFiles] - A list of image files from the English documentation
 * @returns {Promise<{language: string, content: Translation} | LanguageFileError>} - An array of objects containing their language and their file's content
 */
export async function buildLanguageFile(language, { logger = console, baseImageFiles } = {}) {
  await fs.ensureDir(langDist);

  baseImageFiles ??= await getImageData();

  const fileName = `${language}.json`;

  try {
    const rawJson = await fs.readJson(path.join(langSource, fileName));

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
    logger.info(`Writing ${filePath}`);
    await fs.writeJson(filePath, rawJson, { spaces: 2 });
    return { language, content: rawJson };
  } catch (e) {
    const error = new LanguageFileError(`Error writing ${fileName}: ${e.message}`, {
      language,
      stack: e.stack,
    });
    logger.error(error);
    return error;
  }
}

class LanguageFileError extends Error {
  constructor(message, { language, stack }) {
    super(message);
    this.name = "LanguageFileError";
    this.language = language;
    this.stack = stack;
  }
}
