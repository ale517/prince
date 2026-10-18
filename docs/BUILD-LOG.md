# Build Log: how this game was made, from zero

A step-by-step record of building **Persian Prince**, an original browser tribute to the 1989 *Prince of Persia*, so you can replicate the process and reuse it for other games.

- **Stack:** TypeScript, Vite, Phaser (4.2 installed), Vitest, Web Audio.
- **Repo:** https://github.com/ale517/prince
- **Result so far:** menu, 4 playable test levels, platforming, traps, sword combat, a mirror shadow, HUD, timer, save, music, SFX, gamepad, mute button.
- **Not built yet:** the full prototype level (spec 06), rebindable keys, footstep/jump sounds.

Sections follow the order things were done. Commit hashes match `git log`.

---

## 0. The working method (this matters more than any code)

1. **Spec first, then code.** Agile with small chat-style iterations works badly with several AI agents, and heavy "big design up front" is too rigid. The compromise: write **short, agent-friendly specs** that define the *contracts* (types and interfaces) between modules, then implement one module at a time.
2. **Small, commented commits.** Each commit does one thing and says why (`area: what`). This is written into the spec ([specs/09](../specs/09-testing-and-milestones.md)). It makes every step reviewable and revertable.
3. **Tests for logic, eyes for visuals.** Pure logic (physics, combat, save, audio data) has Vitest tests. Rendering is checked in a real browser with screenshots.
4. **Verify before moving on.** After each step: `npm run typecheck`, `npm test`, then look at it in the browser.
5. **Git worktrees:** each parallel agent works in its own folder and branch of the same repo, so agents don't overwrite each other. The specs' contracts are what make this possible. This project was built sequentially, but the module boundaries allow parallel work.

Decisions made up front:

| Question | Choice |
|---|---|
| Engine | Phaser |
| Language | TypeScript |
| Bundler | Vite |
| Scope | One-level prototype first |
| Art | Original, generated in code (nothing from the 1989 game) |
| Specs | Multi-file `specs/` folder |

---

## 1. Specs (commits `868cea4`, `3b25152`)

Ten Markdown files in [specs/](../specs):

| File | Content |
|---|---|
| `00-overview` | Vision, scope, tech choices, glossary |
| `01-architecture` | Module layout, shared contracts, event bus |
| `02-world-and-physics` | Tile grid (32px tiles, 10x3 tiles per screen), collision, fall damage |
| `03-player` | Movement state machine: walk, run, jump, climb, hang, crouch |
| `04-combat-and-enemies` | Sword fighting, guards, AI skill levels, the shadow |
| `05-traps-and-objects` | Spikes, loose floors, gates, plates, chompers, potions |
| `06-level-format` | ASCII level format, the full prototype level |
| `07-ui-timer-save` | HUD, 60-minute timer, menus, save |
| `08-input-audio-art` | Keyboard and gamepad, audio, art pipeline |
| `09-testing-and-milestones` | Test plan, milestones, commit rules |

**Lesson:** the more precise the contracts in `01`, the easier every later module was. Write the types before the behaviour.

---

## 2. Project skeleton (`d098698`)

```
npm create vite@latest   # vanilla-ts template
npm i phaser
npm i -D vitest
```

Scripts in [package.json](../package.json): `dev`, `build`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`).

Dev server: `npm run dev -- --port 5173`.

---

## 3. Shared contracts (`d1ffead`)

[src/contracts/](../src/contracts) holds only **types**: world, entity, objects, combat, and a typed `EventBus`. See [events.ts](../src/contracts/events.ts):

```ts
bus.on('player:damaged', (e) => ...);   // payload is type-checked
bus.emit('sfx:play', { key: 'hit' });
```

The bus decouples modules: combat emits `sfx:play`; audio listens; neither imports the other.

---

## 4. World and physics (`286ad1d`)

[src/world/](../src/world): a `TileGrid` of tile types (`empty`, `floor`, `wall`, ...) with collision queries ("is there floor under this tile?") and a **fall damage table**.

Key idea: the game is **tile-based** (32 px tiles), like the original. That keeps collision and level design simple.

---

## 5. Player state machine (`32d22ca`)

[src/player/player.ts](../src/player/player.ts) is **table-driven**: each state (`idle`, `walk`, `run`, `jump`, `hang`, `climb`, `fall`, `crouch`, ...) has a length in frames and the transitions out of it. Constants live in [constants.ts](../src/player/constants.ts), where movement is tuned.

Pattern: `step(input, world)` is a **pure update**: no rendering, no Phaser. That is what makes it testable ([tests/player.test.ts](../tests/player.test.ts)).

---

## 6. Level parser and the simulation (`32023a0`, `0b512df`)

- [src/level/ascii.ts](../src/level/ascii.ts) turns an ASCII map into a tile grid and object list. Levels are plain text, so they are easy to write and diff.
- [src/sim/simulation.ts](../src/sim/simulation.ts) owns the player, guards, shadow, objects and timer. It runs at a **fixed 12 Hz tick**. Update order each step: player, guards, shadow, fight system, objects, timer.

**Fixed timestep** is the most important game-loop concept: render at 60 FPS, but advance the logic in constant steps. Behaviour is then identical on any machine, and replayable and testable.

---

## 7. Input and the first playable scene (`6eeeb8c`)

[keyboardInput.ts](../src/input/keyboardInput.ts) maps keys to a logical `InputState` (`left/right/up/down/shift/action/pause`). Because the render loop (60 Hz) runs faster than logic (12 Hz), presses are **latched** between ticks so a quick tap is never lost.

[GameScene.ts](../src/scenes/GameScene.ts) draws the world and runs `sim.step()` from an accumulator:

```ts
acc += delta;
while (acc >= TICK_MS) { acc -= TICK_MS; sim.step(keys.poll()); }
```

---

## 8. Traps and objects (spec 05: `2f662f2`, `5869ba6`, `f11407e`)

[src/objects/](../src/objects): spikes, loose floor, gate + pressure plate, chomper, potion, exit, checkpoint. Each implements the `LevelObject` interface from the contracts (`update`, bounds, and later `restore`). A [registry](../src/objects/registry.ts) creates them from ASCII characters. Adding an object type means adding one file and one registry line.

---

## 9. Pixel-art characters (`eb563da`, `9c80af7`, `bc7aace`, then `5f155dd` to `6abb15c`)

No image files: art is **generated in code** ([src/art/](../src/art)).

- [pixelBuffer.ts](../src/art/pixelBuffer.ts): a tiny raster canvas.
- [princePose.ts](../src/art/princePose.ts): joint positions per pose; limbs are solved with **two-bone IK**.
- [prince.ts](../src/art/prince.ts): rasterizes the pose with a palette, outlines and clothing details. `Look = 'prince' | 'guard'` switches palette and clothes.
- Resolution went from 1x to **3x** (960x600 canvas, camera zoom 3) over several rounds after you asked for better quality.
- [tools/spriteSheet.ts](../tools/spriteSheet.ts) renders a contact-sheet PNG so you can inspect sprites without running the game: `npx tsx tools/spriteSheet.ts out.png`.

**Lesson:** iterate on art with a quick preview tool, not by launching the whole game.

---

## 10. Combat (spec 04: `c4eaf4e`, `67555ba`, `926d3e8`)

[src/combat/](../src/combat):
- `Guard`: a state machine with fight frames. Hit window is frames 3-5, parry is active in frames 1-4, reach is 40 px, a hit does 1 HP and pushes back 16 px.
- [aiTable.ts](../src/combat/aiTable.ts): skill levels 1-5 as data.
- [rng.ts](../src/combat/rng.ts): a **seeded RNG** shared by all guards so fights are reproducible in tests.
- [fightSystem.ts](../src/combat/fightSystem.ts): resolves strikes and parries and emits `sfx:play`.
- Try it: `?level=duel&skill=3`.

---

## 11. The mirror shadow (`88e0c89`, `51e534f`)

[shadow.ts](../src/combat/shadow.ts): `Shadow extends Player`. It **replays the prince's inputs 6 ticks late with left/right swapped**. It shares HP with the prince (a sword hit on it wounds you); walking into it unarmed merges you: full heal and +1 max HP. Try `?level=mirror`.

Replaying inputs is much simpler than writing AI for it.

---

## 12. Environment art (`736ac55`, `67bcc11`)

[environment.ts](../src/art/environment.ts) generates RGBA sprites procedurally: brick back wall, stone walls, floor slab, cracked loose tile, pillar, mirror, exit arch, torch. They are uploaded once as textures (`env:*`) and drawn as pooled, nearest-filtered images, which keeps them crisp. Torch flames are animated.

---

## 13. Timer, save, restore (spec 07: `1a7fc4d`)

[src/save/](../src/save):
- `GameTimer`: 60 minutes, counts ticks, emits `timer:expired`.
- `SaveData` v1 (`pp.save.v1` in localStorage): level, checkpoint, HP, max HP, sword, time remaining, object states. A version in the key lets you change the format later.
- `restore` is applied to a **freshly built** simulation, which is far simpler than serialising everything. Objects implement `restore(fields)`.

Rule chosen: retry keeps elapsed time (no refund); after time-up, the checkpoint's saved time is used.

---

## 14. Menus, HUD, game phases (`7f332f5`, `cbb044a`)

Three Phaser scenes ([src/main.ts](../src/main.ts)): `MenuScene`, `GameScene`, `UIScene`.

- `GameScene` has a **phase state machine**: `playing | paused | dead | timeup | won`. The sim only steps while `playing`.
- `UIScene` runs **in parallel** on top: HP triangles, guard HP, message strip, timer, overlay menus. It only *reads* the game and listens to its bus.
- [menu.ts](../src/scenes/menu.ts): a small reusable keyboard menu.
- `?level=hazard|move|duel|mirror` jumps straight into a level.

---

## 15. Audio (`2231b00`, `9fddf83`)

No audio files: everything is synthesised with the **Web Audio API** ([src/audio/](../src/audio)).

- [songs.ts](../src/audio/songs.ts): music as **data** (notes per step, per voice). Three tracks: dungeon, fight, victory. Pure data is unit-tested ([tests/audio.test.ts](../tests/audio.test.ts)).
- [audioManager.ts](../src/audio/audioManager.ts): a look-ahead step sequencer (a timer schedules notes about 250 ms ahead on the audio clock), SFX as short oscillator blips, master/music/SFX buses, volumes in localStorage.
- Browsers block audio until a user gesture, so it unlocks on the first key or click.
- `UIScene` maps game events to sounds and switches to fight music while a guard is awake.

---

## 16. Gamepad (`26f1d2d`, `7d06bf9`)

[gamepadInput.ts](../src/input/gamepadInput.ts): `mapPad` converts the standard gamepad layout to the same `InputState` (D-pad or stick with 0.3 deadzone; A/X action; LB/RT shift; Start pause). It merges into the keyboard latch, so **the game logic never knows which device is used**. `PadEdges` gives "just pressed" events for menus and pause.

---

## 17. Mute button (`42259b1`)

A clickable speaker icon in the HUD, plus "Sound: ON/OFF" in the main and pause menus. M also toggles.

---

## Project layout

```
specs/      the design documents
docs/       this log
src/
  contracts/  shared types + event bus
  world/ player/ combat/ objects/   game rules (no Phaser)
  level/ sim/ save/                 data + fixed-tick simulation
  art/ audio/ input/                generation and devices
  scenes/                           Phaser scenes (rendering and UI)
tests/      Vitest (83 tests)
tools/      spriteSheet.ts preview tool
```

**Rule of thumb:** keep game rules free of Phaser so they can be tested in Node. Only `scenes/` and the generators touch Phaser or the browser.

---

## How to run and check

```
npm install
npm run dev -- --port 5173     # open http://localhost:5173
npm run typecheck
npm test
npx tsx tools/spriteSheet.ts out.png
```

URL shortcuts: `?level=hazard`, `?level=move`, `?level=duel&skill=3`, `?level=mirror`, and `&debug` for debug text.

Controls: arrows or WASD move; Up jumps; Shift steps; Space draws the sword and strikes; Esc/P pause; R restart from checkpoint; M mute.

---

## Replicating this for another game: a checklist

1. Write the **vision and scope** (one level, one mechanic set) in a spec.
2. Define **contracts**: entity, world, events. Types first.
3. Build the **fixed-tick simulation** with no rendering. Test it.
4. Add a **thin scene** that draws it and feeds input. Get something moving on screen early.
5. Add features one **module per spec**, each with tests and small commits.
6. Add **UI and save** once the rules are stable.
7. Add **audio and input devices** last; they plug into the event bus and `InputState`.
8. At every step: typecheck, test, look at it in the browser, commit, push.

## Known gaps and open questions

- Spec 06 (the full prototype level) is not built; only four test levels exist.
- No crouch-under-gate and no `drinking` state (potions are picked up while crouched).
- Guard balance is untested by a human player; movement and animation numbers are first guesses.
- Guards are not saved, and chompers restart their phase after a restore.
- No footstep, land, jump, sword-draw or level-complete sounds (the player doesn't emit those events yet).
- Mute is not persisted; keys are not rebindable.
- The first Enter press after a screen change is sometimes swallowed (cause not found).
- Open design questions: strict vs easy timer, hard-cut vs smooth screen scroll, hosting target.
- Audio has not been judged by ear; the tracks need tuning.
