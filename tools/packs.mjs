import Datastore from "@seald-io/nedb";
import fs from "fs-extra";
import path from "node:path";
import url from "node:url";
import yargs from "yargs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const PACK_SRC = "../packs";
const PACK_CACHE = "../public/packs";
const TEMPLATE_EXCEPTION_PATHS = {
  Actor: [],
  Item: ["classSkills"],
};
const templateData = loadDocumentTemplates();
const manifest = loadManifest();

/** Helper function that resolves a path from the pack source directory */
const resolveSource = (...file) => path.resolve(__dirname, PACK_SRC, ...file);
/** Helper function that resolves a path from the pack cache directory */
const resolveCache = (...file) => path.resolve(__dirname, PACK_CACHE, ...file);
/** Helper function that resolves a path from the pack dist directory */
const resolveDist = (...file) => path.resolve(__dirname, "../dist/packs", ...file);

const argv = yargs(process.argv.slice(2))
  .demandCommand(1, 1)
  .command(
    "extract [packs...]",
    `Extract packs from cache to source`,
    () => {},
    async (argv) => {
      const options = {
        reset: !argv.keepDeleted ?? true,
        keepIds: !argv.resetIds ?? true,
      };
      if (argv.packs?.length) {
        const results = await Promise.allSettled(argv.packs.map((pack) => extractPack(`${pack}.db`, options)));
        results
          .filter((res) => res.status === "rejected")
          .forEach((res) => console.error(`Error: ${res.reason.message}`));
      } else {
        await extractAllPacks(options);
      }
    }
  )
  // Option to overwrite the default `reset` option
  .option("keepDeleted", { alias: "k", type: "boolean" })
  // Option to overwrite the default `keepIds` option
  .option("resetIds", { alias: "r", type: "boolean" })
  .command("compile", `Compile json files from source into db files in cache`, async () => {
    await compileAllPacks();
  }).argv;

/**
 * Sluggify a string.
 *
 * This function will take a given string and strip it of non-machine-safe
 * characters, so that it contains only lowercase alphanumeric characters and
 * hyphens.
 *
 * @param {string} string String to sluggify.
 * @returns {string} The sluggified string
 */
function sluggify(string) {
  return string
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+|-{2,}/g, "-");
}

/**
 * Removes keys from the first parameter which are not present in the second parameter.
 *
 * @param {object} object - The object to alter.
 * @param {object} source - The source to compare with the first parameter.
 * @param {object} [options] - Additional options to augment the behavior.
 * @param {object} [options.keepDefaults=true] - Whether to keep entries which are identical to the source.
 * @param {string[]} [options.path] - A string containing the names of the parent objects from previous adhereTemplate calls.
 */
function adhereTemplate(object, source, options = {}) {
  if (!source) return;
  const sourceKeys = Object.keys(source);
  const path = options.path ?? [];

  for (const k of Object.keys(object)) {
    if (
      !sourceKeys.includes(k) &&
      (!options.documentType || !TEMPLATE_EXCEPTION_PATHS[options.documentType].includes(path.join(".")))
    ) {
      delete object[k];
      continue;
    }

    if (typeof object[k] === "object" && object[k] != null && typeof source[k] === "object" && source[k] != null) {
      // Leave arrays alone
      if (object[k] instanceof Array || source[k] instanceof Array) continue;
      // Create new objects
      // @TODO: Make this less painful
      const newOptions = {};
      mergeObject(newOptions, options);
      mergeObject(newOptions, { path: (newOptions.path ?? []).slice().concat(k) });
      // Adhere deeply to template
      adhereTemplate(object[k], source[k], newOptions);
      // Delete if empty object
      if (Object.keys(object[k]).length === 0) delete object[k];
    } else if (
      options.keepDefaults === false &&
      object[k] === source[k] &&
      (!options.documentType || !TEMPLATE_EXCEPTION_PATHS[options.documentType].includes(path.join(".")))
    ) {
      delete object[k];
    }
  }
}

/**
 * Merges the contents of the second object into the first object, recursively.
 *
 * @param {object} first - The object to insert values into.
 * @param {object} second - The object to get values from.
 * @returns {object} The merged result.
 */
function mergeObject(first, second) {
  // Return non-object immediately
  if (typeof second !== "object" || second === undefined || second === null) {
    return second;
  }
  // Parse array
  if (second instanceof Array) {
    const result = [];
    for (let a = 0; a < second.length; a++) {
      result.push(mergeObject({}, second[a]));
    }
    return result;
  }
  // Parse object
  const result = typeof first === "object" ? first : {};
  for (const [k, v] of Object.entries(second)) {
    result[k] = mergeObject(result[k], v);
  }
  return result;
}

/**
 * @todo Test this function.
 * Duplicates an object.
 * @param {object} obj - The object to duplicate.
 * @returns {object} The deeply cloned object.
 */
function duplicate(obj) {
  return mergeObject({}, obj);
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
          doc[k] = mergeObject(v, doc.templates?.[templateKey] ?? {});
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
 * Santize pack entry.
 *
 * This resets an entry's permissions to default and removes all non-pf1 flags.
 *
 * @param {object} entry Loaded compendium content.
 * @param {string} [documentType] The document type of the entry, determining which data is scrubbed.
 * @returns {object} The sanitized content.
 */
function sanitizePackEntry(entry, documentType = "") {
  // Reset permissions to default
  entry.permission = { default: 0 };
  // Remove non-system/non-core flags
  for (const key of Object.keys(entry.flags ?? {})) {
    if (!["pf1"].includes(key)) delete entry.flags[key];
  }
  // Adhere to template data
  if (templateData) {
    adhereTemplate(entry.data, templateData[documentType]?.[entry.type], { keepDefaults: false, documentType });
    // Adhere actor's items to template data
    if (documentType === "Actor" && entry.items?.length > 0) {
      for (const i of entry.items) {
        adhereTemplate(i.data, templateData.Item[i.type], { keepDefaults: false, documentType: "Item" });
      }
    }
  }
  return entry;
}

/**
 * @typedef {object} PackOptions
 * @property {boolean} keepIds Whether existing IDs are to be kept, regardless of db ids
 * @property {boolean} reset Whether entries not in the db file are to be deleted
 */

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

  console.log(`Extracting pack ${filename}`);

  // Index of already existing files, to be checked for files not touched with this extraction
  const currentFiles = [];

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

  if (!packData) console.warn(`No data found for package ${filename} within the system manifest.`);
  const docs = await db.findAsync({});
  const docPromises = docs.map(async (doc) => {
    doc = sanitizePackEntry(doc, packData?.type);

    const entryFilepath = resolveSource(directory, `${sluggify(doc.name)}.json`);

    if (options.keepIds) {
      try {
        const prev = fs.readJsonSync(entryFilepath);
        if (prev?._id) doc._id = prev._id;
      } catch (_) {}
    }

    await fs.writeJson(entryFilepath, doc, { spaces: 2 });
    return entryFilepath;
  });
  const writtenFiles = await Promise.all(docPromises);

  const removedFiles = options.reset
    ? await Promise.all(
        currentFiles
          .filter((f) => !writtenFiles.includes(f))
          .map(async (f) => {
            await fs.remove(f);
            return f;
          })
      )
    : [];

  return { filename, writtenFiles, removedFiles };
}

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
 * Compiles a directory containing json files into a single db file
 * with the directory's name in {@link PACK_CACHE}
 *
 * @param {string} name - Name of the db file
 */
async function compilePack(name) {
  console.log(`Creating pack ${resolveCache(name)}.db`);
  await fs.remove(`${resolveCache(name)}.db`);
  const db = new Datastore({ filename: `${resolveCache(name)}.db`, autoload: true });
  const files = (await fs.readdir(resolveSource(name))).filter((f) => path.extname(f) === ".json");
  await Promise.all(
    files.map(async (f) => {
      const json = await fs.readJson(resolveSource(name, f));
      try {
        await db.insertAsync(json);
      } catch (error) {
        console.error(`Could not insert entry ${json.name} with id ${json.id}\n`, error);
      }
    })
  );
  db.compactDatafile();
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
