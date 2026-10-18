# 03 - Player

## Stats
- Max HP starts at 3, each life potion (large) adds +1 (cap 10). Start each level at full HP.
- Lives: single life per attempt; death restarts from last checkpoint.

## State machine
States: `idle, startRun, run, stopRun, turn, step, jumpStanding, jumpRunning, jumpUp, hang, climbUp, drop, fall, land, crouch, drawSword, fightIdle, advance, retreat, strike, parry, hurt, sheathe, drinking, dead, enterExit`.

Transition rules are table-driven (`playerTransitions.ts`): `(state, input, worldQuery) -> nextState`. Each state defines: frame count, per-frame dx/dy, interruptible-from-frame, and animation key.

## Input mapping (logical)
| Input | Action |
|---|---|
| left/right | face + run |
| left/right + shift | careful step |
| up | jump up / grab / climb; with right/left = jump |
| up + direction while running | running jump |
| down | crouch / drop from hang / pick potion |
| shift (hold) | grab ledge while jumping; careful edge |
| action | draw/sheathe sword, strike in fight, interact |

## Behaviors
- Edge: running off an edge -> fall; careful step stops at edge; crouch at edge + down -> hang then drop.
- Ledge grab: while jump animation ends adjacent to a ledge and shift held -> `hang`; up -> `climbUp`.
- Loose floor: standing on one triggers its fall (05).
- Interact: down on potion tile drinks it.
- Death: HP 0 -> `dead` animation -> emit `player:died` -> UI offers restart from checkpoint.

## Public API
```ts
interface Player extends Entity { hp:number; maxHp:number; state:PlayerState; hasSword:boolean; applyDamage(e:DamageEvent):void; heal(n:number):void; addMaxHp(n:number):void; }
```

## Acceptance
- Deterministic replay test: recorded input array reproduces identical final position/state.
- All states reachable per transition table; no dead-end states.
