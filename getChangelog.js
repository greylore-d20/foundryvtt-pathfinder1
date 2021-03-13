const fs = require("fs");

try {
  const changelog = fs.readFileSync("./CHANGELOG.md", "utf-8");
  const recentChanges = changelog.toString().match(/^# Changelog\n*(## (.|\n)*?)^\n^## \d*/m)?.[1] ?? "";

  const manifestFile = fs.readFileSync("system.json", "utf-8");
  const manifest = JSON.parse(manifestFile.toString());
  let url = manifest.manifest;
  url = url.replaceAll("latest", manifest.version);

  const releaseNotes = `**Manifest URL: ${url}**\n\n${recentChanges}`;
  fs.writeFileSync("recent-changes.md", releaseNotes);
} catch (e) {
  console.error(e);
}
