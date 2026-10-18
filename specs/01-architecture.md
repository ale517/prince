# 01 - Architecture

## Folder structure
```
src/
  main.ts                 # Phaser config, boot
  contracts/              # shared interfaces/types (frozen; change via spec only)
    world.ts  player.ts  combat.ts  objects.ts  level.ts  input.ts  events.ts
  scenes/                 # BootScene, MenuScene, GameScene, UIScene, GameOverScene
  world/                  # TileGrid, collision queries, camera/screen logic
  player/                 # Player entity + state machine
  combat/                 # Fight system, Guard, Shadow
  objects/                # Spike, LooseFloor, Gate, Chomper, Potion, PressurePlate
  level/                  # Level loader/validator
  ui/                     # HUD, timer, menus
  input/                  # InputManager (keyboard + gamepad)
  audio/                  # AudioManager
  save/                   # SaveManager
public/assets/            # sprites, audio, levels/*.json
tests/
specs/
```

## Ownership (agent boundaries)
| Agent | Owns | May import from |
|---|---|---|
| world | `src/world`, `contracts/world.ts` | contracts |
| player | `src/player` | contracts, world API |
| combat | `src/combat` | contracts, world, player API |
| traps | `src/objects` | contracts, world |
| ui-save | `src/ui`, `src/save`, `src/scenes/UIScene` | contracts, events |
| input-audio | `src/input`, `src/audio` | contracts |
| level | `src/level`, `public/assets/levels` | contracts |

## Scenes
- `BootScene` loads assets -> `MenuScene` -> `GameScene` (+ parallel `UIScene`) -> `GameOverScene`.

## Game loop
- Fixed timestep logic at **12 fps animation ticks** (original feel) while rendering at 60 fps with interpolation. `Simulation.step()` is pure/deterministic given (state, input) so it is unit-testable.

## Event bus (`contracts/events.ts`)
Typed events through one `EventEmitter`:
`player:damaged`, `player:died`, `player:healed`, `guard:died`, `trap:triggered`, `gate:opened`, `potion:collected`, `checkpoint:reached`, `level:completed`, `timer:tick`, `timer:expired`, `sfx:play`.

## Core contracts (sketch)
```ts
export type TileType = 'empty'|'floor'|'wall'|'pillar'|'loose'|'spikes'|'gate'|'plate'|'chomper'|'exit'|'torch';
export interface TileGrid { width:number; height:number; get(x:number,y:number):Tile; set(x:number,y:number,t:Tile):void; }
export interface Entity { id:string; tx:number; ty:number; facing:1|-1; update(dtTick:number):void; }
export interface InputState { left:boolean; right:boolean; up:boolean; down:boolean; shift:boolean; action:boolean; pause:boolean; }
export interface DamageEvent { target:string; amount:number; source:'sword'|'fall'|'spikes'|'chomper'; }
```

## Quality rules
- `strict: true`, no `any` in contracts. Game logic has no Phaser imports where practical (render adapters separate) so Vitest can run it headless.
- Every module exports a single public `index.ts`.
