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

## Merge Requests

Merge requests are the most direct way to get ideas or changes implemented into the system and provide a streamlined way to update and share system translations.

### Setup

This project uses [npm](https://www.npmjs.com/) as its package manager, [less](http://lesscss.org/) to create CSS files, [rollup](https://rollupjs.org/guide/en/) to bundle JS, and [ESLint](https://eslint.org/) as well as [Prettier](https://prettier.io/) to lint and format code.
npm installation instructions for specific operating systems are given at the above URL.

To create a development setup:

- Fork the project to create a repository to push changes to.
  - Optionally, you can configure your GitLab repository to mirror changes from this project.
  - This can be set up in the repository's settings, under "Repository" > "Mirroring repositories" and adding "Pull" mirroring.
- Clone the forked repository into a local directory using `git clone` or another git client of your choice.
- Install JavaScript dependencies with `npm ci`.
- Run `npm run build:watch` to watch for changes.
  - Do not change the `pf1.css` file directly; instead, always edit the less files and run the gulp task.
- The file watcher will create a `dist` directory. Copy this to Foundry's `Data/systems` directory as `pf1`, or symlink it accordingly.

This setup will compile files whenever necessary and activate a commit hook to automatically lint and format any JS, less or markdown files.

All changes have to be documented in the [changelog](CHANGELOG.md).
To add your changes to it, run `npm run addlog`.
[Changelogify](https://github.com/wanadev/changelogify) will then prompt you for a message that will appear in the changelog, the type of change, and an issue number that will be used to create a link in the log.
The issue number is optional – if there is no issue your merge request will close, you can leave the number out.
This prompt will create a file in `changelogs/unreleased`, which you will have to commit alongside your changes.

If committing changes is not possible due to ESLint or Prettier encountering non-fixable problems, change the code in question to follow the rules setup for that file type.

For commit messages, describe what the commit does in a very short summary in the first line, e.g. "Add BAB to combat tab".
After the first line, reference issues or merge requests the commit relates to, using [keywords](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically) recognized by GitLab whenever applicable (e.g. "Fixes #123").

### Opening merge requests

Give the merge request a concise title, referencing issues or explaining the merge request's content in the description.
The description can also contain references to open issues to automatically close upon a successful merge.
This project's CI/ CD will run after opening a merge request and create a result of either "passed" or "failed".
In the latter case, check the job for which error caused it to fail, and correct the issue if possible.

If you encounter any problems at any point during the setup, feel free to message one of the developers via Discord or leave a message in the `#pf1e` channel of the FoundryVTT Discord server.
