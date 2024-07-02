<div align="center">
  <h1>Pathfinder 1e for Foundry VTT</h1>
  <br>
  <img alt="Gitlab pipeline status" src="https://img.shields.io/gitlab/pipeline-status/foundryvtt_pathfinder1e/foundryvtt-pathfinder1?branch=master&label=Checks&logo=gitlab">
  <img alt="Supported Foundry Versions" src="https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases/permalink/latest/downloads/system.json">
  <a href="https://forge-vtt.com/bazaar#package=pf1">
    <img src="https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf1&colorB=4aa94a" alt="Forge Install %" />
  </a>
  <a href="https://www.foundryvtt-hub.com/package/pf1/">
    <img src="https://img.shields.io/endpoint?logoColor=white&url=https%3A%2F%2Fwww.foundryvtt-hub.com%2Fwp-json%2Fhubapi%2Fv1%2Fpackage%2Fpf1%2Fshield%2Fendorsements" alt="Foundry Hub Endorsements" />
  </a>
  <a href="https://weblate.vtthub.de/engage/pf1/">
    <img src="https://weblate.vtthub.de/widgets/pf1/-/svg-badge.svg" alt="Translation status" />
  </a>
</div>

An implementation of the first edition of Pathfinder for Foundry Virtual
Tabletop (http://foundryvtt.com).

## Installation

Install the following game system in FoundryVTT's game system tab:

[https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases/permalink/latest/downloads/system.json](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases/permalink/latest/downloads/system.json)

If you wish to manually install the system, you must extract a built version into the `Data/systems/pf1` folder.
You may do this by downloading a `pf1.zip` archive from the [Releases Page](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases).
Be careful not to download a source code archive, as those will not work within Foundry.

## Building

1. Clone or download this repository.
2. Change directory to the repository root and run `npm ci`.
3. Run `npm run build` to create a `dist` directory containing all files necessary to use the system in Foundry.
   Alternatively, you can run `npm run build:serve` to build the system and start a Vite development server.

For additional information regarding the build process, see the [Setup](CONTRIBUTING.md#setup) section of the [contributing guide](CONTRIBUTING.md).

## API

This system provides module and macro developers with an API, including the ability to listen to system-specific hook events and extending the system's functionality.
Its automatically generated documentation can be found in the [API documentation](https://foundryvtt_pathfinder1e.gitlab.io/foundryvtt-pathfinder1/index.html).

## User Documentation

While running the system in Foundry, you can find a Help browser in the Settings tab.
An English mirror of that information can also be found in [this repository's wiki](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/Help/Home) in the `System reference sheet / Help` section.

The rest of [the wiki](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/home) also includes [FAQs](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/FAQs) and some other helpful content.

## Legal

The software component of this system is distributed under the GNUv3 license while the game content is distributed under the Open Gaming License v1.0a.

This system uses trademarks and/or copyrights owned by Paizo Inc., which are used under Paizo's Community Use Policy.
We are expressly prohibited from charging you to use or access this content.
This [website, character sheet, or whatever it is] is not published, endorsed, or specifically approved by Paizo Inc.
For more information about Paizo's Community Use Policy, please visit [paizo.com/communityuse](http://paizo.com/communityuse).
For more information about Paizo Inc. and Paizo products, please visit [paizo.com](https://paizo.com).
