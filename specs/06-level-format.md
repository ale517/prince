# 06 - Level Format and Prototype Level

## JSON schema (`public/assets/levels/level01.json`)
```json
{
  "version": 1,
  "name": "The Dungeon",
  "screensW": 4, "screensH": 3,
  "tiles": ["<rows of chars, width = screensW*10, height = screensH*3>"],
  "legend": { ".":"empty", "#":"wall", "=":"floor", "P":"pillar", "L":"loose", "S":"spikes", "G":"gate", "_":"plate", "C":"chomper", "E":"exit" },
  "objects": [ { "id":"gate1","type":"gate","tx":14,"ty":4,"props":{"holdTicks":150} } ],
  "guards": [ { "id":"g1","tx":22,"ty":4,"facing":-1,"hp":3,"skill":2 } ],
  "start": { "tx":2, "ty":1, "facing":1 },
  "checkpoints": [ { "id":"cp1","tx":12,"ty":4 } ],
  "timeLimitSeconds": 3600
}
```
Validated at load with a schema (zod). Errors name the offending tile/object.

## Prototype level design (one level, ~12 screens)
1. **Start room**: tutorial: walk, run, jump, careful step.
2. **Loose floor corridor**: introduces loose tiles.
3. **Spikes pit**: running jump or careful step over.
4. **Potion alcove**: small potion + large potion hidden up a ledge climb.
5. **Gate + pressure plate puzzle**.
6. **Guard 1 (skill 1)**: sword pickup precedes it.
7. **Chomper gauntlet**: two chompers, phase offset.
8. **Mirror room** with shadow.
9. **Guard 2 (skill 3)** before exit.
10. **Exit door** opened by a plate via loose-floor drop.

Must be solvable in 10-15 minutes; includes at least two checkpoints and one shortcut.

## Loader/Validator
- `loadLevel(json): Level` -> builds `TileGrid`, `ObjectDef[]`, `GuardDef[]`.
- Validator checks: start on ground, plate links resolve, exit exists, every checkpoint on ground.
- Optional ASCII preview tool: `npm run level:preview`.
