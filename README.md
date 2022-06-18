# Pathfinder 1e for Foundry VTT

An implementation of the first edition of Pathfinder for Foundry Virtual
Tabletop (http://foundryvtt.com).

The software component of this system is distributed under the GNUv3 license
while the game content is distributed under the Open Gaming License v1.0a.

## Installation

Install the following game system in FoundryVTT's game system tab:

[https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases/permalink/latest/downloads/system.json](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases/permalink/latest/downloads/system.json)

If you wish to manually install the system, you must clone or extract it into the `Data/systems/pf1` folder.
You may do this by downloading a zip archive from the [Releases Page](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/releases).

## Building

1. Clone or download this repository.
2. Change directory to the repository root and run `npm ci`.
3. Run `npm run build` to create a `dist` directory containing all files necessary to use the system in Foundry.
   Alternatively, you can run `npm run build:serve` to build the system and start a Vite development server.

## API

This system provides module and macro developers with an API, including the ability to listen to system-specific hook events and extending the system's functionality.
Its documentation can be found in [this repository's wiki](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/home) in the `API` section.

## Information

While running the system in Foundry, you can find a Help browser in the Settings tab.
An English mirror of that information can also be found in [this repository's wiki](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/wikis/Help/Home) in the `System reference sheet / Help` section.

## Legal

"This system uses trademarks and/or copyrights owned by Paizo Inc., which are used under Paizo's Community Use Policy.
We are expressly prohibited from charging you to use or access this content.
This [website, character sheet, or whatever it is] is not published, endorsed, or specifically approved by Paizo Inc.
For more information about Paizo's Community Use Policy, please visit [paizo.com/communityuse](http://paizo.com/communityuse).
For more information about Paizo Inc. and Paizo products, please visit [paizo.com](https://paizo.com)."
