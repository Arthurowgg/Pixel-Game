# Wildpine animation sheets

**Animation generation is currently on hold.** This document describes the previously assembled sheets retained in the project; the latest standalone-asset batch does not change them or claim to fulfill the whole-sheet/omnidirectional request.

The active manifest contains **63 clips across 17 transparent PNG sheets**. New weapon and wolf animations are literal **four-column, two-row** sheets. Each cell is a complete frame; the game slices both rows, rather than stretching or moving a single picture.

The polish batch uses **ten individual image generations**: four survivor action poses, four wolf gait poses, an axe, and a pickaxe. Those poses are palette-matched, aligned, assembled, and packed by `scripts/build_polish_sheets.py`. The image generator did not generate the whole multi-frame grid in one prompt.

## New one-animation-per-image sheets

| Sheet                     | Frame size | Content                                                                                     |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `survivor-axe-right.png`  | 64 × 80    | Eight complete actor + axe frames, including generated wind-up/contact/follow-through poses |
| `survivor-axe-down.png`   | 64 × 80    | Eight front-facing axe frames                                                               |
| `survivor-axe-up.png`     | 64 × 80    | Eight rear-facing axe frames, with equipment behind the body                                |
| `survivor-mine-right.png` | 64 × 80    | Eight complete actor + pickaxe frames                                                       |
| `survivor-mine-down.png`  | 64 × 80    | Eight front-facing mining frames                                                            |
| `survivor-mine-up.png`    | 64 × 80    | Eight rear-facing mining frames                                                             |
| `wolf-run.png`            | 64 × 48    | Contact, compression, gathered suspension, and extended gallop                              |
| `wolf-idle.png`           | 64 × 48    | Alert crouch and tail movement; shared by idle/alert clips                                  |
| `leaf-drift.png`          | 24 × 24    | Eight pixel-leaf orientations                                                               |
| `pond-ring.png`           | 32 × 24    | Eight expanding, fading ripple frames                                                       |

All of these sheets use **4 columns × 2 rows**. Left-facing player poses mirror the complete right-facing frame. The original empty-handed rigs remain available for the other actions and for holding arbitrary items.

## Supporting sheets

| Sheet              | Cell    | Content                                                             |
| ------------------ | ------- | ------------------------------------------------------------------- |
| `survivor.png`     | 48 × 48 | Empty-handed directional idle/walk/run/gather/use/build/attack rigs |
| `forest.png`       | 64 × 80 | Anchored pine sway and hit recoil                                   |
| `falling-tree.png` | 96 × 96 | Falling pine                                                        |
| `resources.png`    | 40 × 40 | Rocks, cracks, breakage, bushes, plants, harvesting, spent bushes   |
| `effects.png`      | 48 × 48 | Fire, chips, dust, leaves, swipe, water, recovery, construction     |
| `camp.png`         | 96 × 64 | Shelter cloth and construction                                      |
| `held.png`         | 24 × 32 | Held burning torch                                                  |

`wildlife.png` is retained as an original build-stage artifact, but the runtime no longer loads it. The new wolf sheets replace its clips. The inventory has its own **`../item-sprites.png`** atlas with all 15 items, described by `../item-sprites.json`. Both the Canvas held-item renderer and the SVG-backed HUD icons crop that shared bitmap. All fifteen item icons now come from generated artwork. The inventory/UI pipelines are `scripts/build_camp_ui_assets.py` and `scripts/build_trail_ui_assets.py`, and the final `scripts/build_hearth_assets.py`, independent of animation generation.

## Runtime corrections · v0.7

All existing animation PNGs—including the axe and pickaxe sheets the user likes—remain unchanged. The animation overhaul is still on hold.

- Eight-way movement/facing is implemented in the simulation and touch controls. Upward diagonals use existing rear-facing cells and downward diagonals use front-facing cells; westward travel mirrors the whole frame. These are not newly drawn diagonal poses.
- Locomotion uses the existing complete walk cells **0, 3, 4, 7**. The 1/5 coat-lift cells used in v0.6 still misaligned the torso and supporting boot, so those are now skipped too. The selected cells have byte-identical head pixels, checked in the browser. Sprint uses those same cells at a faster distance-driven cadence instead of the more exaggerated legacy run row.
- Idle and menu portraits hold their intact neutral cell. The old painted blink and torso-only bob are not replayed. No pixels are patched, limbs rigged, or replacement poses assembled.
- Diagonal-first substeps prevent tunnelling and unnecessary axis-probe snags; facing follows actual displacement. Pointer destinations clamp to remaining travel distance.
- Gait is driven by actual distance travelled, not the global clock. Blocked motion does not advance gait, footstep effects, sprint drain, or distance statistics. Pause freezes the current cell.
- The inventory bitmap is mirrored at its grip **only while carrying** an axe/pickaxe. Full-body strike frames remain the originals, with contact at frame 4.
- During plant gathering, movement is briefly held and playback avoids the two fully outstretched reach poses. This reuses existing whole cells, without deforming bodies or drawing limbs. **A genuine crouching collection sequence is not provided by the existing artwork and remains outstanding.**

## Frame metadata

`manifest.json` is copied into `src/game/animation-manifest.json`. Each clip describes:

- `sheet`: PNG basename.
- `x`, `y`: first frame's top-left corner.
- `w`, `h`: cell dimensions.
- `frames`, `fps`, `loop`: playback parameters.
- `columns`: row-major layout width; absent on legacy single-row clips.
- `anchor: [x, y]`: stable world foot/pivot position.
- `hands: [[x, y, clockwiseDegrees], …]`: one grip transform per survivor frame.
- `impactFrame`: frame index 4 on the complete weapon sheets.

For frame `i` and `columns = clip.columns ?? clip.frames`:

```text
sourceX = clip.x + (i % columns) × clip.w
sourceY = clip.y + floor(i / columns) × clip.h
```

Weapon clips run at **12 fps**. Their impact is at **1/3 second**, frame index 4—the first cell on the second row. The simulation's existing damage/consumption timing is unchanged. Rewards occur once, pause freezes the shared clock, and switching equipment before impact cancels without spending an item.

Use nearest-neighbor sampling. Do not filter or interpolate the source pixels. Held objects remain separate layers during walking/idle and non-weapon actions, while axe/pickaxe strikes use the complete precomposited sheet frame without drawing the tool a second time.

## Preservation and static rebuilds

Historical `build_animation_sheets.py` and `build_polish_sheets.py` document the earlier constructed sheets. **Do not run them under the current static-only agreement.** The game and CI use the supplied PNGs directly. Integrating future complete AI-drawn sheets should only crop their intact frames and update the manifest.

To rebuild the current static artwork without touching animation PNGs:

```sh
python scripts/build_inventory_assets.py --normalized-only
python scripts/build_camp_ui_assets.py --normalized-only
python scripts/build_trail_ui_assets.py --normalized-only
python scripts/build_hearth_assets.py --normalized-only
npm run format
```

Requires Pillow. The final Hearth & Hand stage restores the latest loading/workshop registry after older stages. No animation builder was used for art batches 2–5, and all 18 existing animation PNGs, including the inactive wildlife artifact, retain their pre-batch hashes.

The leaves, ripples, sun shafts, canopy shadows, and ground microtextures are procedural pixel/lighting work—not additional image generations. Remaining prop/UI and whole-sheet animation work is tracked in `ART_ROADMAP.md` at the repository root.
