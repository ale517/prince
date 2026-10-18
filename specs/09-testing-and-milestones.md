# 09 - Testing and Milestones

## Testing strategy
- **Unit (Vitest)**: world primitives, player transitions, fight rules, objects, save/timer, level validator.
- **Deterministic replay**: recorded input + seed produce identical state hashes; used as regression tests.
- **Smoke (Playwright)**: loads page, starts game, no console errors, canvas non-blank, completes scripted input to cross first screen.
- **Manual playtest checklist** per milestone.
- CI: `lint`, `typecheck`, `test`, `build` on every branch.

## Milestones
| # | Name | Deliverable | Modules |
|---|---|---|---|
| M0 | Foundations | Vite+Phaser+TS skeleton, contracts frozen, CI | 01 |
| M1 | Walk the world | Tile grid, camera, player run/step/jump/climb/fall with placeholder art | 02, 03 |
| M2 | Hazards | Spikes, loose floors, gates, plates, chompers, potions | 05 |
| M3 | Fight | Sword, guard AI, health, death/respawn | 04 |
| M4 | Game shell | HUD, timer, menus, save/checkpoints | 07 |
| M5 | Feel | Audio, gamepad, shadow enemy, art pass | 08, 04 |
| M6 | Level | Full prototype level, balance, bugfix | 06 |

## Definition of Done (per module)
- Implements its spec's acceptance items, public API unchanged vs contract.
- Unit tests pass, no lint/type errors, no `console.error` at runtime.
- Docs updated if behavior deviates (spec change first).
- Delivered as small, well-commented commits following the commit guidelines in [00-overview.md](00-overview.md).

## Performance targets
- 60 fps on a mid laptop (integrated GPU), initial load < 5 MB, < 3 s on broadband.

## Risks
- Animation-feel tuning is time-consuming: keep all constants in one file with a debug overlay (F1) showing state, tile coords, tick.
- Merge conflicts in shared constants: keep per-module constants files.
- Scope creep: any new mechanic needs a spec file entry first.

## Open questions
- Keep the 60-minute timer unforgiving or add an "easy" mode?
- Smooth screen scroll vs hard cut as default?
- Hosting target (itch.io / GitHub Pages)?
