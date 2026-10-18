# Project Overview: "Persian Prince" (working title)

A browser-based, original tribute to the 1989 side-scrolling cinematic platformer *Prince of Persia*. Use original names, art and audio. Do not copy assets from the original game.

## Goals
- Playable prototype of ONE level (the dungeon/escape level) that exercises every core mechanic.
- Runs in a desktop browser (Chrome/Edge/Firefox) from `npm run dev` and as a static build.
- Keyboard and gamepad input.
- Spec-driven: each spec file is a contract an agent can implement independently.

## Non-goals (prototype)
- Levels 2-12, cutscenes, level editor, mobile/touch, multiplayer.

## Tech stack
| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Engine | Phaser 3 (Arcade physics NOT used; custom grid movement, see 02) |
| Build | Vite |
| Tests | Vitest (logic), Playwright (smoke) |
| Audio | Phaser WebAudio, placeholder generated sounds |
| Lint | ESLint + Prettier |

## Core design pillars
1. **Grid-based, tile-precise movement.** The world is a grid; the player moves in discrete animation-driven steps, not free physics.
2. **Animation-driven state machine.** Actions (run, jump, climb, fall) are fixed frame sequences with defined displacement.
3. **Deadly consequences.** Falls, spikes and blades kill; fights are duels of timing.
4. **Time pressure.** 60-minute real-time countdown.

## Spec index (and agent ownership)
| File | Module | Depends on |
|---|---|---|
| [01-architecture.md](01-architecture.md) | Project structure, scenes, interfaces | - |
| [02-world-and-physics.md](02-world-and-physics.md) | Tile grid, movement rules, collision | 01 |
| [03-player.md](03-player.md) | Player state machine, animations | 01, 02 |
| [04-combat-and-enemies.md](04-combat-and-enemies.md) | Sword fight, guard AI, shadow | 02, 03 |
| [05-traps-and-objects.md](05-traps-and-objects.md) | Spikes, loose floors, gates, chompers, potions | 02 |
| [06-level-format.md](06-level-format.md) | Level data schema + prototype level | 02, 05 |
| [07-ui-timer-save.md](07-ui-timer-save.md) | HUD, timer, checkpoints, menus | 01 |
| [08-input-audio-art.md](08-input-audio-art.md) | Input, gamepad, audio, art pipeline | 01 |
| [09-testing-and-milestones.md](09-testing-and-milestones.md) | Tests, milestones, DoD | all |

## Multi-agent workflow
- Write/freeze `01`, `02` and the TS interfaces in `src/contracts/` FIRST (single agent, on `main`).
- Then one git worktree + branch per module (`agent/player`, `agent/combat`, `agent/traps`, `agent/ui`, `agent/input-audio`).
- Agents edit only files in their ownership list (see 01). Cross-module changes require a spec update first.
- Merge order: world -> player -> traps -> combat -> ui -> input/audio -> level.

## Glossary
- **Tile**: one grid cell, 32x32 logical px (render scale x2-3).
- **Block**: tile type (floor, wall, empty, etc.).
- **Row/Screen**: a level is a grid of screens, each 10 tiles wide x 3 tiles tall visible.
