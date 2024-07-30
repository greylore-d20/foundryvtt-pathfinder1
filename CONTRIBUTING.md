# Contributing

All manner of contributions to the project are welcome:

- Opening issues for bugs or feature requests
- Creating or maintaining translations
- Contributing code to fix bugs or add features
- Helping out in any way

We really appreciate it.

## Issues

Issues are a valuable part of this project.

**Before creating a new issue, search already existing ones for possible keywords to avoid creating duplicates.**

When creating a new issue, the following information is especially appreciated:

- Clear reproduction steps, i.e. the fewest amount of steps from “installing a new world” to “this is where it breaks”.
  - If you cannot reproduce the problem reliably, provide an estimation of how often you encounter the issue, and under which conditions.
- Describe the expected behavior and contrast it with the one observed.
  - Screenshots are useful if the problem in question is a visual one, e.g. if something is rendered incorrectly.
- Feature requests should not only contain a summary of the desired feature, but ideally examples for which this feature would be necessary or useful.
  - If the change in question includes matters of design or layout, attaching mock-ups is a valuable tool to make sure all contributors can visualize it.

## Localization

Translations of `lang` files are managed using [Weblate](https://weblate.vtthub.de/projects/pf1/), a web-based translation platform.
Editing translations on Weblate is the preferred way to contribute translations.

The contents of the help browser are written in Markdown and managed separately.
To contribute translations for those files, create and/or edit files in the [`help`](help) directory, following the directory structure of the [English files](help/en).
To merge changes to markdown files into `lang` files and check them within Foundry, run `npm run lang`.

## Merge Requests

Merge requests are the most direct way to get ideas or changes implemented into the system and provide a streamlined way to update and share system translations.

### Setup

This project uses [npm](https://www.npmjs.com/) as its package manager, [less](http://lesscss.org/) to create CSS files, [Vite](https://vitejs.dev/) to bundle JS and build all other files, and [ESLint](https://eslint.org/) as well as [Prettier](https://prettier.io/) to lint and format code.
npm installation instructions for specific operating systems are given at the above URL.

To create a development setup:

- Fork the project to create a repository to push changes to.
  - Optionally, you can configure your GitLab repository to mirror changes from this project.
  - This can be set up in the repository's settings, under "Repository" > "Mirroring repositories" and adding "Pull" mirroring.
- Clone the forked repository into a local directory using `git clone` or another git client of your choice.
- Install JavaScript dependencies with `npm ci`.
- In an optional, but recommended step, create a `foundryconfig.json` and insert a configuration specific to your setup:

```json5
{
  dataPath: "<path to your home directory>/.local/share/FoundryVTT>",
  appPath: "<path to your Foundry installation>",
  routePrefix: "<your routePrefix for Foundry, or leave this out if you do not use one>",
  openBrowser: true, // Open a web browser when running `npm run build:serve`; defaults to false
}
```

- Run `npm run link jsconfig` to create a `jsconfig.json` file.

To build the system, you now have multiple options:

- Recommended:

  - Run `npm run build:serve`.
    This builds the system _and_ starts a Vite development server, which serves as a proxy for a Foundry server running on port `30000`.
    File changes will either trigger a reload of the browser page, or be hot reloaded (in case of less or handlebars files).

- Alternative methods:
  - Run `npm run build`.
    This builds the complete, production-ready system into a `dist` directory.
    Copying this directory into your game's `Data/systems/` folder with its name changed to `pf1`, or symlinking the `dist` directory as `pf1` will install the system.
  - Run `npm run build:watch`.
    This builds the system and afterwards watches for changes, rebuilding the system when a change is detected.

> _Note_:
> If you want the build process to skip building packs, you can run `npx vite build`.

After the system has been built at least once, you can also run `npm run serve` to directly start the development server.
This will not trigger a build and therefore not mirror any changes to compendium, language, or help files, handlebars template files, or any other static content stored in `public`, but does allow rapidly starting an environment to test JavaScript changes.

If you entered a `dataPath` in your `foundryconfig.json` and want to create a symlink from Foundry's `Data/systems/pf1` directory to the generated `dist` directory, run `npm run link dist`.

Installing the system's dependencies will also install a git commit hook, which will automatically lint and format files before they are committed.
If committing changes is not possible due to ESLint or Prettier encountering non-fixable problems, change the code in question to follow the rules setup for that file type.

### Compendium Changes

The system provides extra tooling to deal with compendiums, including their compilation to and from JSON.
Source files for all pack entries are stored in `packs`, with each compendium in its own directory.
When `npm run packs:compile` is run – which happens automatically when invoking `npm run build` – the compendiums are compiled into a `.db` file, which is then stored in `public/packs`.
From there, the actual build process copies the `.db` files into the `dist` directory.

Compendium content can be edited from within Foundry, so that changes are stored in their respective `.db` files.
To then transfer these changes to the compendium's source files, run `npm run packs:extract`.
This will extract the contents of `dist/packs/*.db` into their respective directories.
If Foundry's `Data/systems/pf1` is symlinked to `dist`, you can change content in Foundry, close the server, and then run `npm run packs:extract` to immediately see the changes in the source files.

### Documentation

All changes have to be documented in the [changelog](CHANGELOG.md).
To add your changes to it, run `npm run addlog`.
[Changelogify](https://github.com/wanadev/changelogify) will then prompt you for a message that will appear in the changelog, the type of change, and an issue number that will be used to create a link in the log.
The issue number is optional – if there is no issue your merge request will close, you can leave the number out.
This prompt will create a file in `changelogs/unreleased`, which you will have to commit alongside your changes.

For commit messages, describe what the commit does in a very short summary in the first line, e.g. "Add BAB to combat tab".
After the first line, reference issues or merge requests the commit relates to, using [keywords](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically) recognized by GitLab whenever applicable (e.g. "Fixes #123").

### Opening merge requests

Give the merge request a concise title, referencing issues or explaining the merge request's content in the description.
The description can also contain references to open issues to automatically close upon a successful merge.
This project's CI/ CD will run after opening a merge request and create a result of either "passed" or "failed".
In the latter case, check the job for which error caused it to fail, and correct the issue if possible.

If you encounter any problems at any point during the setup, feel free to message one of the developers via Discord, or leave a message in the `#pf1e` channel of the [FoundryVTT Discord server](https://discord.gg/foundryvtt) or the `#pathfinder1e-dev` channel of the [League Discord server](https://discord.gg/rNzh6U2qMG).
