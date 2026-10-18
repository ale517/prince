# 08 - Input, Audio, Art

## Input
`InputManager.poll(): InputState` merges keyboard + gamepad each tick.

| Logical | Keyboard | Gamepad (standard mapping) |
|---|---|---|
| left/right/up/down | Arrows / WASD | D-pad or left stick (deadzone 0.3) |
| shift | Shift | Right trigger / LB |
| action | Space / Z | A / X |
| pause | Esc / P | Start |
- Connect/disconnect handled at runtime with a message-strip notice.
- Rebindable keys stored in `localStorage` (stretch goal).
- Input is sampled at logic tick rate and recorded for replay tests.

## Audio
- `AudioManager.play(key, opts)` and `playMusic(key)`; listens to `sfx:play`.
- SFX list: footstep, land, jump, sword draw, clash, hit, hurt, death, spike, gate loop, chomper, loose floor crumble, potion drink, checkpoint, level complete.
- Music: 1 looping dungeon track, a fight sting, a victory jingle.
- Placeholders: generate with jsfxr / sfxr-style synthesis (CC0) and simple chiptune loops made in a free tool (BeepBox). Document all sources in `public/assets/CREDITS.md`.
- Autoplay policy: audio unlocks on first user input. Master/music/SFX volume sliders persisted.

## Art pipeline
- Original placeholder pixel art, 32px tile grid, characters ~ 32x64 per frame. Style: limited 16-color palette, dungeon stone, warm torch light.
- Sprite sheets with Phaser atlas JSON (Aseprite export or `free-tex-packer`).
- Naming: `player_run_01`, `guard_strike_03`, `tile_floor`, `obj_spikes_up`...
- Animation table lives in `src/anim/animations.ts` (key, frames, frameRate 12, repeat).
- Rendering: `pixelArt: true`, integer scaling, base resolution 320x200 (scaled x3 = 960x600).
- Optional lighting: simple additive torch glow sprite; no shaders required.
- Legal: all assets original or CC0; do not use or trace assets from the 1989 game.
