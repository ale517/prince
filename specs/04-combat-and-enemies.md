# 04 - Combat and Enemies

## Duel rules
- Combat begins when a guard is within 4 tiles on the same row and facing, or the player draws a sword near a guard.
- Moving while sword is drawn uses `advance`/`retreat` (half-tile steps). Running with a sword drawn is not allowed.
- Actions: `strike` (hit window frames 3-5), `parry` (active frames 1-4, blocks strikes from the front), `advance`, `retreat`.
- A hit deals 1 HP. A parried strike causes the attacker a 3-tick stagger and a pushback of 1/2 tile, giving a riposte opening.
- Pushback: a hit pushes the target back 1/2 tile; pushing off an edge causes a fall (see 02 fall rules).
- Sword cannot be used while falling, hanging or climbing.

## Guard AI
Data-driven parameters per guard (`level.guards[]`):
```ts
interface GuardDef { id:string; tx:number; ty:number; facing:1|-1; hp:number; skill:1|2|3|4|5; patrol?:{min:number;max:number}; }
```
`skill` maps to a table in `src/combat/aiTable.ts`:
| Skill | Parry chance | Strike chance | Reaction ticks | Advance bias |
|---|---|---|---|---|
| 1 | 20% | 25% | 6 | low |
| 3 | 45% | 40% | 4 | med |
| 5 | 75% | 60% | 2 | high |
AI is a small state machine: `idle -> alert -> approach -> fight -> retreat -> dead`. Uses a seeded RNG (injected) for determinism and testing.

## Guard behaviours
- Idle guards patrol or stand; spot player by line of sight in the same row within 8 tiles.
- Guards do not fall off ledges voluntarily and are killed by spikes or chompers.
- On death: lie on ground, drop nothing. Emit `guard:died`.

## Shadow / mirror enemy
- Triggered by a `mirror` marker tile. Player's reflection steps out (shadow) that mirrors the player's inputs on a delay of 6 ticks, with inverted facing.
- If the player sheathes the sword and walks into the shadow, they merge (restore HP, +1 maxHp optional). If the shadow is struck, the player takes the damage instead (shared-HP rule) so the intended solution is to merge.
- Prototype implementation: `Shadow` entity reading a ring buffer of the player's past inputs.

## Public API
```ts
interface FightSystem { update(player:Player, guards:Guard[], tick:number):void; }
interface Guard extends Entity { hp:number; state:GuardState; }
```

## Acceptance
- Unit tests: hit window, parry riposte, pushback off edge, seeded AI reproducibility.
- Playtest: skill 1 guard beatable by a new player, skill 5 requires parry/riposte.
