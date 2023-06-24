import Datastore from "@seald-io/nedb";
import fs from "fs-extra";
import path from "node:path";
import url from "node:url";
import yargs from "yargs";
import prettier from "prettier";
import * as utils from "./utils.mjs";
import { getActionDefaultData, getChangeDefaultData } from "./pack-default-data.mjs";
import { ViteLoggerPF } from "./vite-logger.mjs";

const logger = new ViteLoggerPF(console);
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const __filename = url.fileURLToPath(import.meta.url);
const PACK_SRC = "../packs";
const PACK_CACHE = "../public/packs";
/**
 * Arrays of dot paths exempt from data trimming; `system.` is implied, as only system data is trimmed.
 * This should include paths to any objects that can contain arbitrary (i.e. not in template) properties.
 */
const TEMPLATE_EXCEPTION_PATHS = {
  Actor: [],
  Item: ["classSkills", "uses.autoDeductChargesCost", "flags", "casting", "learnedAt", "properties"],
  Component: [],
};

const templateData = loadDocumentTemplates();
const manifest = loadManifest();
const prettierConfig = await prettier.resolveConfig(".");

/**
 * Helper function that resolves a path from the pack source directory
 *
 * @param {...string} file - String path segments
 * @returns {string} The resolved path
 */
const resolveSource = (...file) => path.resolve(__dirname, PACK_SRC, ...file);
/**
 * Helper function that resolves a path from the pack cache directory
 *
 * @param {...string} file - String path segments
 * @returns {string} The resolved path
 */
const resolveCache = (...file) => path.resolve(__dirname, PACK_CACHE, ...file);
/**
 * Helper function that resolves a path from the pack dist directory
 *
 * @param {...string} file - String path segments
 * @returns {string} The resolved path
 */
const resolveDist = (...file) => path.resolve(__dirname, "../dist/packs", ...file);

// Only handle commands if this script was executed directly
if (process.argv[1] === __filename) {
  yargs(process.argv.slice(2))
    .demandCommand(1, 1)
    .command({
      command: "extract [packs...]",
      describe: `Extract packs from cache to source`,
      handler: async (argv) => {
        const options = {
          reset: !argv.keepDeleted ?? true,
        };
        if (argv.packs?.length) {
          const results = await Promise.allSettled(argv.packs.map((pack) => extractPack(`${pack}.db`, options)));
          results
            .filter((res) => res.status === "rejected")
            .forEach((res) => logger.error(`Error: ${res.reason.message}`));
        } else {
          await extractAllPacks(options);
        }
      },
    })
    // Option to overwrite the default `reset` option
    .option("keepDeleted", { alias: "k", type: "boolean" })
    .command({
      command: "compile",
      describe: `Compile json files from source into db files in cache`,
      handler: async () => {
        await compileAllPacks();
      },
    })
    .parse();
}

/**
 * Loads the document templates file.
 *
 * @returns {object} The document templates object, merged with their respective templates.
 */
function loadDocumentTemplates() {
  const templates = fs.readJsonSync(path.resolve(__dirname, "../public/template.json"));

  for (const doc of Object.values(templates)) {
    if (doc.types) delete doc.types;

    for (const [k, v] of Object.entries(doc)) {
      if (k === "templates") continue;

      if (v.templates instanceof Array) {
        for (const templateKey of v.templates) {
          doc[k] = utils.mergeObject(v, doc.templates?.[templateKey] ?? {});
        }
        delete v.templates;
      }
    }

    if (doc.templates) delete doc.templates;
  }

  return templates;
}

/**
 * Loads the system manifest file.
 *
 * @returns {object} The system manifest file as an object.
 */
function loadManifest() {
  return fs.readJsonSync(path.resolve(__dirname, "../public/system.json"));
}

/**
 * @typedef {object} PackOptions
 * @property {boolean} reset Whether entries not in the db file are to be deleted
 */

/**
 * Extracts all db files from {@link PACK_CACHE} into {@link PACK_SRC}
 *
 * @param {PackOptions} options - Additional options modifying the extraction process
 */
async function extractAllPacks(options) {
  const packs = await fs.readdir(resolveDist(), { withFileTypes: true });
  return Promise.all(
    packs.filter((p) => p.isFile() && path.extname(p.name) === ".db").map((p) => extractPack(p.name, options))
  );
}

/**
 * Extracts a single db file, creating a directory with the file's name in {@link PACK_SRC},
 * and storing each db entry in its own file.
 *
 * @param {string} filename - The db file name from {@link PACK_CACHE}
 * @param {PackOptions} options - Additional options modifying the extraction process
 */
async function extractPack(filename, options) {
  // This db files directory in PACK_SRC
  const dbFileNameBase = path.basename(filename, ".db");
  const directory = resolveSource(path.basename(filename, ".db"));
  if (!fs.existsSync(resolveDist(filename))) throw new Error(`${filename} does not exist`);
  const db = new Datastore({ filename: resolveDist(filename), autoload: true });

  logger.info(`Extracting pack ${filename}`);

  // Index of already existing files, to be checked for files not touched with this extraction
  const currentFiles = [];
  let sameNameFiles = [];

  if (!fs.existsSync(directory)) {
    await fs.mkdir(directory);
  } else if (options.reset) {
    for (const curFile of fs.readdirSync(directory)) {
      currentFiles.push(resolveSource(directory, curFile));
    }
  }

  // Find associated manifest pack data
  const packData = manifest.packs.find((p) => {
    return path.basename(p.path, ".db") === dbFileNameBase;
  });

  if (!packData) logger.warn(`No data found for package ${filename} within the system manifest.`);
  const docs = await db.findAsync({});
  const docPromises = docs.map(async (doc) => {
    doc = sanitizePackEntry(doc, packData?.type);
    const slugName = utils.sluggify(doc.name);

    // Check for files with the same name but different ids, track them for possible warnings later
    currentFiles.forEach((f) => {
      const baseName = path.basename(f, ".json");
      if (baseName.includes(".")) {
        const [id, ...name] = baseName.split(".").reverse();
        if (name.reverse().join(".") === slugName && id !== doc._id) sameNameFiles.push(f);
      }
    });

    const entryFilepath = resolveSource(directory, `${slugName}.${doc._id}.json`);

    const formattedContent = prettier.format(JSON.stringify(doc, null, 2), {
      ...prettierConfig,
      parser: "json",
    });
    await fs.writeFile(entryFilepath, formattedContent);
    return entryFilepath;
  });
  const writtenFiles = await Promise.all(docPromises);

  const removedFiles = [];
  if (options.reset) {
    const toRemove = currentFiles.filter((f) => !writtenFiles.includes(f));
    if (toRemove.length > 0) {
      logger.info(`Removing ${toRemove.length} files from ${dbFileNameBase}`);

      // If a file with the same name but different id was written and the old one marked for removal,
      // emit a warning since this might be an accidental ID change
      sameNameFiles = [...new Set(sameNameFiles)];
      const mismatchedIdFiles = toRemove.filter((f) => sameNameFiles.includes(f));
      if (mismatchedIdFiles.length > 0) {
        logger.warn(
          `${dbFileNameBase}: files with similar names but different ids marked for removal: ${mismatchedIdFiles
            .map((f) => path.basename(f))
            .join(", ")}`
        );
      }

      // Remove file and track successful removals for logging
      await Promise.all(
        toRemove.map(async (f) => {
          await fs.remove(f);
          removedFiles.push(f);
        })
      );
    }
  }

  return { filename, writtenFiles, removedFiles };
}

/**
 * Santize pack entry.
 *
 * This resets an entry's permissions to default and removes all non-pf1 flags.
 *
 * @param {object} entry Loaded compendium content.
 * @param {string} [documentType] The document type of the entry, determining which data is scrubbed.
 * @returns {object} The sanitized content.
 */
function sanitizePackEntry(entry, documentType = "") {
  // Delete unwanted fields
  delete entry.ownership;
  delete entry.folder;
  delete entry._stats;
  if ("effects" in entry && entry.effects.length === 0) delete entry.effects;

  // Remove non-system/non-core flags
  for (const key of Object.keys(entry.flags ?? {})) {
    if (!["pf1", "core"].includes(key)) delete entry.flags[key];
  }
  if (utils.isEmpty(entry.flags)) delete entry.flags;

  // Remove top-level keys not part of Foundry's core data model
  // For usual documents, this is enforced by Foundry. For inventoy items, it is not.
  if (["Actor", "Item"].includes(documentType)) {
    for (const key of Object.keys(entry)) {
      if (!["name", "type", "img", "data", "flags", "items", "system", "_id"].includes(key)) delete entry[key];
    }
  }

  // Adhere to template data
  if (templateData) {
    const systemData = entry.system ?? entry.data;
    const template = templateData[documentType]?.[entry.type];
    if (systemData && template) {
      entry.system = enforceTemplate(systemData, template, {
        documentType,
      });
    }
    if (documentType === "Actor" && entry.items?.length > 0) {
      // Treat embedded items like normal items for sanitization
      entry.items = entry.items.map((i) => sanitizePackEntry(i, "Item"));
    }
    if (documentType === "Item" && entry.system.inventoryItems?.length > 0) {
      // Treat embedded items like normal items for sanitization
      entry.system.inventoryItems = entry.system.inventoryItems.map((i) => sanitizePackEntry(i, "Item"));
    }
  }
  return entry;
}

/**
 * Enforce a template on an object.
 *
 * @param {object} object - The data object to be trimmed
 * @param {object} template - The template to enforce
 * @param {object} [options={}] - Additional options to augment the behavior.
 * @param {"Actor" | "Item" | "Component"} [options.documentType] - The document name to which this template belongs.
 * @param {"Action" | "Change"} [options.componentType] - The component name to which this template belongs.
 * @returns {object} A data object which has been trimmed to match the template
 */
function enforceTemplate(object, template, options = {}) {
  // Do not enforce templates on documents which do not have them
  if (!object || !template || !["Actor", "Item", "Component"].includes(options.documentType)) return object;

  // Create a diff of the object and template to remove all default values
  const diff = utils.diffObject(template, object);
  const flattened = utils.flattenObject(diff);
  for (const path of Object.keys(flattened)) {
    // Delete additional properties unless in template or in the exception list
    const inTemplate = utils.hasProperty(template, path);
    const isExempt =
      options.documentType &&
      TEMPLATE_EXCEPTION_PATHS[options.documentType].some((exceptionPath) => path.startsWith(exceptionPath));
    if (!inTemplate && !isExempt) {
      delete flattened[path];
    }

    // Delete null values if template has empty string
    const currentValue = utils.getProperty(object, path);
    const templateValue = utils.getProperty(template, path);
    if (templateValue === "" && currentValue === null) delete flattened[path];

    const templateHasArray = Array.isArray(utils.getProperty(template, path));
    const isEmptyArray = flattened[path] instanceof Array && flattened[path].length === 0;
    if (templateHasArray && isEmptyArray) {
      delete flattened[path];
    }
  }

  /* -------------------------------------------- */
  /*  Handling special cases/cleanup              */
  /* -------------------------------------------- */
  for (const path of Object.keys(flattened)) {
    // Delete false classSkills in class items
    if (options.documentType === "Item" && path.startsWith("classSkills.") && flattened[path] === false) {
      delete flattened[path];
    }
    // Delete erroneous keys containing paths to delete
    if (path.includes(".-=")) {
      delete flattened[path];
    }

    if (options.componentType === "Action") {
      // if (path === "uses.per") delete flattened[path];
    }
  }

  // Trimming components
  if ("actions" in flattened && Array.isArray(flattened.actions)) {
    const defaultData = getActionDefaultData();
    flattened.actions = flattened.actions.map((action) =>
      enforceTemplate(action, defaultData, { documentType: "Component", componentType: "Action" })
    );
  }
  if ("changes" in flattened && Array.isArray(flattened.changes)) {
    const defaultData = getChangeDefaultData();
    flattened.changes = flattened.changes.map((change) =>
      enforceTemplate(change, defaultData, { documentType: "Component", componentType: "Change" })
    );
  }

  return utils.expandObject(flattened);
}

/**
 * Compiles all directories in {@link PACK_SRC} into db files in {@link PACK_CACHE}
 */
async function compileAllPacks() {
  await fs.ensureDir(resolveCache());
  await Promise.all((await fs.readdir(resolveCache())).map(async (f) => fs.remove(resolveCache(f))));
  const dirs = (await fs.readdir(resolveSource(), { withFileTypes: true })).filter((f) => f.isDirectory());
  return Promise.all(dirs.map((d) => d.name).map((d) => compilePack(d)));
}

/**
 * Compiles a directory containing json files into a single db file
 * with the directory's name in {@link PACK_CACHE}
 *
 * @param {string} name - Name of the db file
 */
async function compilePack(name) {
  logger.info(`Creating pack ${resolveCache(name)}.db`);
  await fs.remove(`${resolveCache(name)}.db`);
  const db = new Datastore({ filename: `${resolveCache(name)}.db`, autoload: true });
  const files = (await fs.readdir(resolveSource(name))).filter((f) => path.extname(f) === ".json");
  await Promise.all(
    files.map(async (f) => {
      const json = await fs.readJson(resolveSource(name, f));
      try {
        await db.insertAsync(json);
      } catch (error) {
        logger.error(`Could not insert entry ${json.name} with id ${json.id}\n`, error);
      }
    })
  );
  db.compactDatafile();
}
