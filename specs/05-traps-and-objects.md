# 05 - Traps and Objects

All objects implement `LevelObject { id; tx; ty; update(tick); onEnter?(entity); onLeave?(entity); serialize() }` and are registered through `objects/registry.ts`.

| Object | Behavior |
|---|---|
| **Spikes** | Cycle: hidden -> extend (3 ticks) -> up (20 ticks) -> retract. Triggered when an entity is within 1 tile (or a plate). Entity on the tile when extended, or falling onto them: instant death (`source:'spikes'`). Guards also die. |
| **Loose floor** | When stepped on or landed on, shakes for 8 ticks, then falls; falling tile damages entity below (1 HP) and becomes `empty` (rubble sprite). Can be stood on once safely if player is careful-stepping off within 4 ticks. |
| **Gate (portcullis)** | States: closed, opening (animation 12 ticks), open, closing (slow, 40 ticks). Opened by a linked pressure plate; closes after `holdTicks` (default 150) when plate released. Blocks horizontal movement when not fully open. Player may crouch under at 1/4 open. |
| **Pressure plate** | Triggered by entity standing on it (or loose floor falling on it). Fields: `links:string[]`. |
| **Chomper (blade)** | Two-blade guillotine on a cycle (30 ticks). Instant death when closed on an entity in the tile. A step through between cycles is safe; safe window visible by animation. Use `phase` offset field to desync. |
| **Potion (small, red)** | Heals 1 HP. |
| **Potion (large)** | +1 max HP and full heal. |
| **Potion (poison, green)** | Damages 1 HP (never lethal: clamps at 1 HP). |
| **Torch** | Decorative animated sprite. |
| **Exit door** | Opens via plate; level completes when player enters after fully open. Emits `level:completed`. |

## Object data schema
```ts
interface ObjectDef { id:string; type:'spikes'|'loose'|'gate'|'plate'|'chomper'|'potion'|'torch'|'exit'|'mirror'|'checkpoint';
  tx:number; ty:number; props?: Record<string, number|string|boolean|string[]>; }
```

## Rules
- Object updates run in fixed tick order by id for determinism.
- Objects emit `trap:triggered` for audio/UI hooks.
- Each object has unit tests for state progression and a headless entity-overlap test.
