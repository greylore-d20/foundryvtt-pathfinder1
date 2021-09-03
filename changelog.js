const fs = require("fs");
const git = require("simple-git");

/**
 * @param writeFile
 */
async function getCurrentLog(writeFile = true) {
  try {
    const changelog = fs.readFileSync("./CHANGELOG.md", "utf-8");
    const recentChanges = changelog.toString().match(/^# Changelog\n*(## (.|\n)*?)^\n^## \d*/m)?.[1] ?? "";

    const manifestFile = fs.readFileSync("system.json", "utf-8");
    const manifest = JSON.parse(manifestFile.toString());
    let url = manifest.manifest;
    url = url.replaceAll("latest", manifest.version);

    const releaseNotes = `**Manifest URL: ${url}**\n\n${recentChanges}`;

    if (writeFile) fs.writeFileSync("recent-changes.md", releaseNotes);
    else return releaseNotes;
  } catch (e) {
    console.error(e);
  }
}

/**
 *
 */
async function getChangelogData() {
  const base = process.cwd();
  const changelogsDir = `${base}/changelogs/`;
  const unreleasedChangelogsDir = `${changelogsDir}unreleased/`;
  const paths = {
    changelogsDir,
    unreleasedChangelogsDir,
    changelog: `${base}/CHANGELOG.md`,
    defaultConfig: `${base}/changelogs/config.json`,
  };

  const gitBranch = await git().silent(true).raw(["symbolic-ref", "--short", "HEAD"]);
  let branchNumberRaw = gitBranch.match(/(\d)+/);
  const branchNumber = branchNumberRaw && Number(branchNumberRaw[0]) ? branchNumberRaw[0] : undefined;
  const { version } = JSON.parse(fs.readFileSync("system.json", "utf-8"));

  const config = JSON.parse(fs.readFileSync(paths.defaultConfig, "utf-8"));

  const today = new Date();
  const currentDate = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  return {
    paths,
    gitBranch,
    branchNumber,
    version,
    config,
    currentDate,
  };
}

/**
 * @param newVersion
 */
async function releaseLog(newVersion) {
  try {
    const { paths, version, currentDate, config } = await getChangelogData();
    const date = currentDate;
    const releaseVersion = newVersion ?? version;

    let beginningText;
    let endText = "";
    let changelog;

    if (fs.existsSync(paths.changelog)) {
      changelog = fs.readFileSync(paths.changelog, "utf8");
      const match = changelog.toString().match(/((.|\s)+?){1}((## (.|\s)+))/);
      beginningText = match[1];
      endText = match[3];
    } else {
      beginningText = fs.readFileSync(paths.emptyChangelog, "utf8");
    }

    const hasUnreleasedDir = fs.existsSync(paths.unreleasedChangelogsDir);
    const changelogFiles = hasUnreleasedDir ? fs.readdirSync(paths.unreleasedChangelogsDir) : [];

    const { changelogs, formatErrors } = changelogFiles.reduce(
      (acc, file) => {
        const content = JSON.parse(fs.readFileSync(`${paths.unreleasedChangelogsDir}${file}`, "utf8"));
        const error = checkJsonFormat(content, config.types);
        if (error === "") acc.changelogs.push(content);
        else acc.formatErrors.push(`${file}: ${error}`);
        return acc;
      },
      { changelogs: [], formatErrors: [] }
    );

    if (formatErrors.length) {
      const errors = formatErrors.reduce((acc, err) => `${acc}\n - ${err}`, "");
      throw new Error(`Wrong changelog files format\nIn ${paths.unreleasedChangelogsDir}${errors}`);
    }

    const data = changelogs.reduce((acc, { message, type, issue, branch }) => {
      const issueNumber = issue ?? branch; // retrocompatibility
      if (!acc[type]) acc[type] = [];
      acc[type].push({ message, issueNumber });
      return acc;
    }, {});

    const formattedData = config.types.reduce((text, type) => {
      if (data[type]) {
        text += `\n### ${type}\n\n`;
        data[type].forEach(({ message, issueNumber }) => {
          if (issueNumber === "" || !config.gitIssueTemplate) {
            text = `${text}- ${message}\n`;
          } else {
            const link = config.gitIssueTemplate.replace(/NUMBER/g, issueNumber);
            text = `${text}- ${message} ${link}\n`;
          }
        });
      }
      return text;
    }, "");

    const formattedChangelogs = `## ${releaseVersion} - ${date}\n${formattedData}\n`;

    const text = `${beginningText}${formattedChangelogs}${endText}`;

    fs.writeFileSync(paths.changelog, text);
    console.info(`${formattedChangelogs}\nappended in /CHANGELOG.md`);

    // delete JSON changelog files
    changelogFiles.forEach((file) => {
      fs.accessSync(`${paths.unreleasedChangelogsDir}${file}`);
      fs.unlinkSync(`${paths.unreleasedChangelogsDir}/${file}`);
    });
  } catch (error) {
    console.info(error);
    process.exit(1);
  }
}

const checkJsonFormat = (content, types) => {
  if (!content.message && !content.type) return 'missing "message" and "type" keys';
  if (!content.message) return 'missing "message" key';
  if (!content.type) return 'missing "type" key';
  if (!types.includes(content.type)) return "unknown type";
  return "";
};

exports.releaseLog = releaseLog;
exports.getCurrentLog = getCurrentLog;
