# 07 - UI, Timer and Save

## HUD (UIScene, runs in parallel with GameScene)
- HP triangles bottom-left (filled/empty), max up to 10. Guard HP bottom-right during a fight.
- Timer shown in a message strip: `MM:SS remaining`, always shown during first 30 s of each minute, and the last 10 minutes always on.
- Message strip for events ("You found a potion", "Press ACTION to draw sword").
- Pixel font, scaling with integer scale of the canvas.

## Timer
- 3600 s countdown, ticks only while GameScene is active (paused in menu/pause). Stored in save. Emits `timer:tick` each second and `timer:expired` -> game over screen.

## Menus
- Main menu: New Game, Continue (if save), Controls, Audio, Credits.
- Pause: Resume, Restart from checkpoint, Controls, Quit.
- Game over: reason (died / time up), Retry from checkpoint.
- Win screen: remaining time.

## Checkpoints and save
- Checkpoint objects set `lastCheckpoint` when touched (`checkpoint:reached`).
- Saved to `localStorage` key `pp.save.v1`:
```ts
interface SaveData { version:1; levelId:string; checkpointId:string|null; hp:number; maxHp:number; hasSword:boolean; timeRemaining:number; objectStates:Record<string,unknown>; }
```
- Autosave on checkpoint; manual quicksave key (F5) and quickload (F9) optional.
- Restart from checkpoint restores player + object states recorded at that moment; timer keeps the elapsed time by default (no refund).
- Corrupt/mismatched version save is ignored safely.

## Acceptance
- Unit tests for save/restore round trip and version rejection; timer pause/resume test.
