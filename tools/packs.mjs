import fs from "fs-extra";
import path from "node:path";
import url from "node:url";
import yargs from "yargs";
import { Listr } from "listr2";
import pc from "picocolors";
import yaml from "js-yaml";
import * as fvtt from "@foundryvtt/foundryvtt-cli";

import * as utils from "./utils.mjs";
import { getActionDefaultData, getChangeDefaultData, getTokenDefaultData } from "./pack-default-data.mjs";
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
  Actor: ["attributes.spells.spellbooks"],
  Item: ["classSkills", "links.supplements", "flags", "casting", "learnedAt", "properties", "source", "items", "ammo"],
  Component: [],
  Token: [],
};

// Template exceptions only when the document is in actor
const TEMPLATE_ACTOR_EXCEPTION_PATHS = {
  Item: ["class"],
};

const templateData = loadDocumentTemplates();
const manifest = loadManifest();

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
        await extractPacks(argv.packs, { reset: !argv.keepDeleted ?? true });
      },
    })
    // Option to overwrite the default `reset` option
    .option("keepDeleted", { alias: "k", type: "boolean" })
    .command({
      command: "compile",
      describe: `Compile yaml files from source into dbs in cache`,
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
 * Extracts dbs from {@link PACK_CACHE} into {@link PACK_SRC}
 * If no packs are specified, all packs are extracted.
 *
 * @param {string[]} packNames - The names of the packs to extract
 * @param {object} [options={}] - Additional options to augment the behavior.
 * @param {boolean} [options.reset] - Whether to remove files not present in the db
 * @returns {Promise<PackResult[]>} An array of pack results
 */
async function extractPacks(packNames = [], options = {}) {
  const packDirs = await fs.readdir(resolveDist(), { withFileTypes: true });
  const packs = packNames.length ? packDirs.filter((p) => packNames.includes(p.name)) : packDirs;

  const tasks = new Listr(
    packs
      .filter((packDir) => packDir.isDirectory())
      .map((packDir) => {
        return {
          task: async (_, task) => {
            task.title = `Extracting ${packDir.name}`;
            const packResult = await extractPack(packDir.name, options);
            const yellowSign = pc.yellow("\u26a0");
            const redSign = pc.red("\u26a0");
            const notifications = [];

            if (packResult.addedFiles.length) {
              notifications.push(`${pc.green("\u26a0")} Added ${pc.bold(packResult.addedFiles.length)} files:`);
              const addedFiles = packResult.addedFiles.map((f) => path.basename(f)).join(", ");
              notifications.push(`${pc.dim(addedFiles)}`);
            }

            if (packResult.removedFiles.length) {
              if (options.reset) {
                notifications.push(
                  `${yellowSign} Removed ${pc.bold(packResult.removedFiles.length)} files without DB entry:`
                );
              } else {
                notifications.push(
                  `${yellowSign} Found ${pc.bold(packResult.removedFiles.length)} files without DB entry:`
                );
              }
              const removedFiles = packResult.removedFiles.map((f) => path.basename(f)).join(", ");
              notifications.push(`${pc.dim(removedFiles)}`);
            }

            const conflictsNumber = Object.keys(packResult.conflicts).length;
            if (conflictsNumber) {
              notifications.push(`${redSign} Found ${pc.bold(conflictsNumber)} ID conflicts:`);
              for (const [id, files] of Object.entries(packResult.conflicts)) {
                notifications.push(pc.dim(`${id} in ${pc.dim([...files].map((f) => path.basename(f)).join(", "))}`));
              }
            }

            if (notifications.length) {
              task.title = `Extracted ${packDir.name} with notifications:\n${notifications.join(`\n`)}`;
            } else {
              task.title = `Extracted ${packDir.name}`;
            }
          },
        };
      }),
    { concurrent: true }
  );
  return tasks.run();
}

/**
 * @typedef {object} PackResult
 * @property {string} packName - The name of the db
 * @property {string[][]} conflictingFiles - The files containing keys occuring more than once
 * @property {string[]} addedFiles - The files written during the extraction
 * @property {string[]} removedFiles - The files removed during the extraction
 */

/**
 * Extracts a single LevelDB, creating a directory with the db's name in {@link PACK_SRC},
 * and storing each entry in its own file.
 *
 * @param {string} packName - The directory name from {@link PACK_CACHE}
 * @param {object} [options={}] - Additional options to augment the behavior.
 * @param {boolean} [options.reset] - Whether to remove files not present in the db
 * @returns {Promise<PackResult>} The result of the extraction
 */
async function extractPack(packName, options = {}) {
  // This db directory in PACK_SRC
  const directory = resolveSource(path.basename(packName));
  if (!fs.existsSync(resolveDist(packName))) throw new Error(`${packName} does not exist`);

  // Index of already existing files, to be checked for files not touched with this extraction
  const filesBefore = [];
  const touchedFiles = [];
  /** @type {Map<string, Set<string>>} */
  const ids = new Map();
  let isFirstExtraction = false;
  if (!fs.existsSync(directory)) {
    isFirstExtraction = true;
    await fs.mkdir(directory);
  } else {
    for (const curFile of fs.readdirSync(directory)) {
      filesBefore.push(resolveSource(directory, curFile));
    }
  }

  // Find associated manifest pack data
  const packData = manifest.packs.find((p) => {
    if (p.path) return path.basename(p.path) === packName;
    else return p.name === packName;
  });
  if (!packData) logger.warn(`No data found for package ${packName} within the system manifest.`);

  await fvtt.extractPack(resolveDist(packName), resolveSource(directory), {
    transformEntry: (entry) => sanitizePackEntry(entry, packData?.type),
    transformName: (entry) => {
      const filename = `${utils.sluggify(entry.name)}.${entry._id}.yaml`;

      // Abuse the callback to avoid having to read and parse the file later
      const file = resolveSource(directory, filename);
      touchedFiles.push(file);
      if (ids.has(entry._id)) ids.get(entry._id).add(file);
      else ids.set(entry._id, new Set([file]));

      return filename;
    },
    yaml: true,
    yamlOptions: {
      sortKeys: true, // Prevent random key drift
    },
  });

  const filesAfter = fs.readdirSync(directory).map((f) => resolveSource(directory, f));

  // Find all untouched files whose IDs could not be retrieved while extracting
  await Promise.all(
    filesAfter
      .filter((f) => f.endsWith("yaml") && !touchedFiles.includes(f))
      .map(async (file) => {
        const content = await fs.readFile(file, "utf-8");
        const parsed = yaml.load(content);
        const { _key, _id } = parsed;
        const idFromKey = _key?.split("!").at(-1);
        if (idFromKey !== _id) throw new Error(`ID mismatch in ${file}: ${idFromKey} !== ${_id}`);
        if (ids.has(_id)) ids.get(_id).add(file);
        else ids.set(_id, new Set([file]));
      })
  );
  // Array of Sets containing conflicting files
  // const conflicts = [...ids.values()].filter((f) => f.size > 1);
  const conflicts = Object.fromEntries([...ids.entries()].filter(([, files]) => files.size > 1));
  const conflictingFileNames = new Set(
    Object.values(conflicts).flatMap((files) => [...files].map((f) => path.basename(f)))
  );

  // Find all files that were added by this run
  const addedFiles = isFirstExtraction ? [] : filesAfter.filter((f) => !filesBefore.includes(f)); //.filter((f) => !conflictingFiles.flat().includes(f));

  // Find all files that were not touched by this run (and thus are candidates for deletion);
  // exclude conflicting files, as they have to be checked manually
  const removedFiles = filesBefore.filter((f) => !touchedFiles.includes(f) && !conflictingFileNames.has(f));
  if (options.reset) {
    await Promise.all(removedFiles.map((f) => fs.remove(f)));
  }

  return { packName, addedFiles, removedFiles, conflicts };
}

function sanitizeActiveEffects(effects) {
  for (const ae of effects) {
    delete ae.changes;
    delete ae.origin;
    delete ae.transfer;
    delete ae.disabled;

    utils.pruneObject(ae);
  }
}

/**
 * Santize pack entry.
 *
 * This resets an entry's permissions to default and removes all non-pf1 flags.
 *
 * @param {object} entry Loaded compendium content.
 * @param {string} [documentType] The document type of the entry, determining which data is scrubbed.
 * @param {object} [options] - Additional options
 * @param {boolean} [options.childDocument] - Is this document within another?
 * @returns {object} The sanitized content.
 */
function sanitizePackEntry(entry, documentType = "", { childDocument = false } = {}) {
  // Delete unwanted fields
  delete entry.ownership;

  // Prune _stats
  if (childDocument && entry._stats) {
    Object.keys(entry._stats).forEach((key) => {
      if (key !== "compendiumSource") delete entry._stats[key];
    });

    if (Object.keys(entry._stats).length === 0) {
      delete entry._stats;
    }
  } else {
    delete entry._stats;
  }

  if ("effects" in entry) {
    if (entry.effects.length === 0) delete entry.effects;
    else sanitizeActiveEffects(entry.effects);
  }

  // Ignore folders; not present on inventoryItems
  if (entry._key?.startsWith("!folders")) return entry;

  // Always delete system migration marker
  delete entry.flags?.pf1?.migration;

  // Delete lingering abundant flag
  delete entry.flags?.pf1?.abundant;

  // Remove non-system/non-core flags
  if (entry.flags) {
    utils.pruneObject(entry.flags);
    for (const key of Object.keys(entry.flags)) {
      if (!["pf1", "core"].includes(key)) delete entry.flags[key];
    }
    if (utils.isEmpty(entry.flags)) delete entry.flags;
  }

  // Remove top-level keys not part of Foundry's core data model
  // For usual documents, this is enforced by Foundry. For inventoy items, it is not.
  const allowedCoreFields = [
    "name",
    "type",
    "img",
    "data",
    "flags",
    "items",
    "effects",
    "system",
    "prototypeToken",
    "_id",
    "_key",
    "folder",
  ];
  if (["Actor", "Item"].includes(documentType)) {
    for (const key of Object.keys(entry)) {
      if (!allowedCoreFields.includes(key)) delete entry[key];
    }
  }
  if (documentType === "JournalEntry") {
    const disallowedPageFields = ["_stats", "ownership", "video"];
    for (const page of entry.pages) {
      for (const key of Object.keys(page)) {
        if (disallowedPageFields.includes(key)) delete page[key];
      }
    }
  }

  // Remove folders anyway if null or document is in actor
  if (entry.folder === null || childDocument) delete entry.folder;

  // Adhere to template data
  if (templateData) {
    const systemData = entry.system ?? entry.data;
    const template = templateData[documentType]?.[entry.type];
    if (systemData && template) {
      entry.system = enforceTemplate(systemData, template, {
        documentName: documentType,
        type: entry.type,
        childDocument,
      });
    }
    if (documentType === "Actor") {
      if (entry.items?.length > 0) {
        // Treat embedded items like normal items for sanitization
        entry.items = entry.items.map((i) => sanitizePackEntry(i, "Item", { childDocument: true }));
      }
      if (entry.prototypeToken) {
        entry.prototypeToken = sanitizePackEntry(entry.prototypeToken, "Token", { childDocument: true });
      }
    }
    if (documentType === "Item" && entry.system.items && Object.keys(entry.system.items).length > 0) {
      // Treat embedded items like normal items for sanitization
      for (const [itemId, itemData] of Object.entries(entry.system.items)) {
        entry.system.items[itemId] = sanitizePackEntry(itemData, "Item", { childDocument: true });
      }
    }
  }

  if (documentType === "Token") {
    const defaultData = getTokenDefaultData();
    return enforceTemplate(entry, defaultData, { documentName: "Token", childDocument: true });
  }

  return entry;
}

/**
 * Enforce a template on an object.
 *
 * @param {object} object - The data object to be trimmed
 * @param {object} template - The template to enforce
 * @param {object} [options={}] - Additional options to augment the behavior.
 * @param {"Actor" | "Item" | "Component"} [options.documentName] - The document(-like) name to which this template belongs.
 * @param {"Action" | "Change"} [options.componentName] - The component name to which this template belongs.
 * @param {boolean} [options.childDocument] - Is this child document of an actor?
 * @param {string} [options.type] - The document type of the object, if it is not already present.
 * @returns {object} A data object which has been trimmed to match the template
 */
function enforceTemplate(object, template, options = {}) {
  // Do not enforce templates on documents which do not have them
  if (!object || !template || !["Actor", "Item", "Token", "Component"].includes(options.documentName)) return object;

  // Create a diff of the object and template to remove all default values
  const diff = utils.diffObject(template, object);
  const flattened = utils.flattenObject(diff);
  for (const path of Object.keys(flattened)) {
    // Delete additional properties unless in template or in the exception list
    // ... but remove exceptions anyway if they're null or empty string.
    const inTemplate = utils.hasProperty(template, path);
    let isExempt =
      options.documentName &&
      TEMPLATE_EXCEPTION_PATHS[options.documentName].some((exceptionPath) => path.startsWith(exceptionPath));

    // Excemptions when this document is in actor
    if (options.childDocument && !isExempt)
      isExempt =
        TEMPLATE_ACTOR_EXCEPTION_PATHS[options.documentName]?.some((exceptionPath) => path.startsWith(exceptionPath)) ??
        false;

    const value = flattened[path];
    if (!inTemplate && (!isExempt || (isExempt && (value === "" || value === null)))) {
      delete flattened[path];
    }

    // Delete null values if template has empty string
    const currentValue = utils.getProperty(object, path);
    const templateValue = utils.getProperty(template, path);
    if (templateValue === "" && currentValue === null) delete flattened[path];
    // Delete empty strings in general if they don't default to something more specific
    if (currentValue === "" && !(utils.getProperty(template, path)?.length > 0)) delete flattened[path];

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
    // Delete erroneous keys containing paths to delete
    if (path.includes(".-=")) {
      delete flattened[path];
    }

    // Item cleanup
    if (options.documentName === "Item") {
      // Delete ammo type when empty
      if (!flattened["system.ammo.type"]) {
        delete flattened["system.ammo.type"];
      }

      // Delete non-set class skills
      if (path.startsWith("classSkills.") && flattened[path] === false) {
        delete flattened[path];
      }

      // Delete non-set properties in weapons
      if (options.type === "weapon" && path.startsWith("properties.") && flattened[path] === false) {
        delete flattened[path];
      }
    }
  }

  /* -------------------------------------------- */
  /*  Handling components                         */
  /* -------------------------------------------- */
  if ("actions" in flattened && Array.isArray(flattened.actions)) {
    const defaultData = getActionDefaultData();
    flattened.actions = flattened.actions.map((action) => {
      action = enforceTemplate(action, defaultData, { documentName: "Component", componentName: "Action" });

      // Special cleanup
      if (!action.ability?.damage) delete action.ability?.damageMult;
      if (utils.isEmpty(action.ability)) delete action.ability;

      return action;
    });
  }
  if ("changes" in flattened && Array.isArray(flattened.changes)) {
    const defaultData = getChangeDefaultData();
    flattened.changes = flattened.changes.map((change) =>
      enforceTemplate(change, defaultData, { documentName: "Component", componentName: "Change" })
    );
    // Delete special cases
    flattened.changes.forEach((ch) => {
      if (ch.priority === null) delete ch.priority;
    });
  }

  return utils.expandObject(flattened);
}

/**
 * Compiles all directories in {@link PACK_SRC} into dbs in {@link PACK_CACHE}
 *
 * @returns {Promise<void>}
 */
async function compileAllPacks() {
  await fs.ensureDir(resolveCache());
  await Promise.all((await fs.readdir(resolveCache())).map(async (f) => fs.remove(resolveCache(f))));
  const dirs = (await fs.readdir(resolveSource(), { withFileTypes: true })).filter((f) => f.isDirectory());
  return Promise.all(dirs.map((d) => d.name).map((d) => compilePack(d)));
}

/**
 * Compiles a directory containing yaml files into a leveldb
 * with the directory's name in {@link PACK_CACHE}
 *
 * @param {string} name - Name of the db
 * @returns {Promise<void>}
 */
async function compilePack(name) {
  logger.info(`Creating pack ${resolveCache(name)}`);
  await fs.remove(`${resolveCache(name)}`);
  return fvtt.compilePack(resolveSource(name), resolveCache(name), { yaml: true });
}
