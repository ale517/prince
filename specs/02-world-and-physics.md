# 02 - World and Physics

## Grid
- Tile: 32x32 logical px. Screen: 10 columns x 3 rows. Level: up to 24 screens in a 2D map.
- Each tile has: `type`, `state` (module-specific), optional `link` (id of target object).
- Positions use tile coords plus sub-tile pixel offset `px` (0-31) for the player/guards.

## Tile semantics
| Type | Solid for walking | Blocks horizontally | Notes |
|---|---|---|---|
| empty | no (fall) | no | air |
| floor | yes | no | standing surface |
| wall/pillar | yes | yes | pillar is decorative-blocking in front |
| loose | yes until triggered | no | see 05 |
| gate | yes | yes when closed | see 05 |
| exit | yes | no | opens when reached via door mechanism |

A character stands on the tile at `(tx, ty)`; ground check is whether the tile below feet (`ty`) is a floor-like tile.

## Movement primitives (displacements in px per frame sequence)
| Action | Distance | Frames | Rule |
|---|---|---|---|
| Walk step (shift) | 1/4 tile (8 px) | 4 | never falls off edge, stops at edge |
| Run | continuous, 4 px/tick after 3-tick start | - | stops after 2-tick slide on release |
| Standing jump | 1 tile forward | 12 | lands if floor, else grabs ledge or falls |
| Running jump | 3 tiles forward | 14 | can clear 2-tile gap |
| Jump up | 1 row up | 10 | grab ledge if floor above-forward |
| Hang/climb | 1 row up | 12 | requires ledge, 1-tile clearance |
| Drop down | 1 row down | 6 | from hanging |
| Fall | 1 row / 8 ticks, accel | - | see damage |

All values are tunable in `src/world/constants.ts`.

## Falling and damage
- Fall height counted in rows. 1 row: no damage. 2 rows: 1 HP. 3 rows: 2 HP... >=4 rows or `HP <= damage`: death.
- Landing plays recover animation; damage emitted as `DamageEvent{source:'fall'}`.

## Collision queries (public API)
```ts
groundAt(tx:number,ty:number):boolean
blockedAt(tx:number,ty:number,dir:1|-1):boolean
ledgeAbove(tx:number,ty:number,dir:1|-1):boolean
rowsToGround(tx:number,ty:number):number
```
No generic physics engine: all checks are tile lookups, so behavior is deterministic.

## Camera
- Screen-flip scrolling: when the player crosses a screen boundary the camera snaps to the adjacent screen (hard cut, no smooth scroll). Optional smooth 150ms slide behind a setting.

## Acceptance
- Unit tests for every primitive: distance, edge stop, gap clearing, fall damage table, ledge grab.
