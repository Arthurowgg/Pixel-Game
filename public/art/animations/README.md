# Wildpine animation sheets

**Animation generation is currently on hold.** This document describes the previously assembled sheets retained in the project; the latest standalone-asset batch does not change them or claim to fulfill the whole-sheet request.

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

`wildlife.png` is retained as an original build-stage artifact, but the runtime no longer loads it. The new wolf sheets replace its clips. The inventory has its own **`../item-sprites.png`** atlas with all 16 items, described by `../item-sprites.json`. Both the Canvas held-item renderer and the SVG-backed HUD icons crop that shared bitmap. All sixteen item icons come from generated artwork; the Workbench reuses its existing glyph. The inventory/UI pipelines are `scripts/build_camp_ui_assets.py` and `scripts/build_trail_ui_assets.py`, `scripts/build_hearth_assets.py`, `scripts/build_embers_assets.py`, and the final `scripts/build_roots_assets.py`, independent of animation generation.

## Whole seated camp state and stronger attacks · v0.9

The 17 active sheets, inactive wildlife artifact, all existing actor/tool sources, and both animation manifests are unchanged. **No new animation builder or rigging was used.**

The approved sitting exception is `../objects/seated-bench.png`: one complete AI-drawn survivor-and-bench static image, not an assembled body or cropped animation frame. Its matching empty `camp-bench.png` shares a 48 × 42 canvas and 24/40 anchor, derived from the same source crop/scale. A collision-checked cardinal approach ends at the seat; the whole occupied image replaces both the empty bench and standing survivor. Movement/actions/danger cancel seating. Log feeding moves the complete log icon from the seated hand location without animating or reconstructing limbs. Other campfires without this bench retain standing rest.

Chopping releases timed, bounded instances of the **existing `leaf-drift` clip**; after the existing pine-fall clip, the new generated stump persists until regrowth. Atmosphere-off/reduced-motion hides drifting leaves. Snap/pounce attacks still play whole existing wolf cells. The pounce adds a longer warning, a fixed landing marker, and up to five pixels of whole-sprite lift, disabled by reduced motion. Health bars use the wolf's persisted maximum health. No new bite, fallen-wolf, or crouching poses have been supplied.

The v0.8 section below is historical; its standing-only camp restriction was explicitly superseded for this one complete static seated state.

## Runtime combat/camp feedback · v0.8

The user chose **existing artwork only** for this pass. The 17 active sheets, inactive wildlife PNG, all source poses/tool PNGs, and both manifests remain unchanged. No actor generation or animation builder ran.

- Wolf AI advances through stalk/circle, a 0.55-second warning, a locked-point lunge (up to 0.32 seconds), recovery, retreat, and hurt. The renderer selects complete existing alert/run cells; warning brackets, a progress mark, position changes and contact feedback clarify intent. A defeated wolf's complete idle cell fades over 1.25 seconds, stored only at runtime.
- **There are no new bite or fallen-wolf clips.** The defeat effect is a whole-frame fade, not a newly drawn lying-down pose.
- Quiet camp uses the existing neutral standing frame with the carried item visually stowed, without changing actual equipment. Log feeding reuses the same safe 0/1/2 whole forage cells as gathering, and moves one complete generated log icon from the current hand toward the fire. A 1.05-second feed action spends its one log at 0.58 seconds, with cancellation before contact.
- **There is no sitting pose.** Sitting, biting, fallen-wolf and genuinely crouching gathering artwork remain deferred until complete AI-drawn sheets can be supplied. Nothing is rigged or reconstructed to imply those sheets exist.
- Four-direction player movement and the liked axe/pickaxe contact frames remain intact. Only controls changed: left-click uses/attacks, E interacts, right-click moves, F is unbound; no automatic tool selection.

## Runtime corrections · v0.7.1

All existing animation PNGs—including the axe and pickaxe sheets the user likes—remain unchanged. The animation overhaul is still on hold.

- Player movement/facing is **four-directional only**, following the request to remove diagonals in v0.7.1. Up/down use the existing rear/front cells; left mirrors the complete right-facing frame. Old diagonal save directions migrate to up/down, preserving the camp. No diagonal poses are needed or planned for the current controls.
- Locomotion uses the existing complete walk cells **0, 3, 4, 7**. The 1/5 coat-lift cells used in v0.6 still misaligned the torso and supporting boot, so those are now skipped too. The selected cells have byte-identical head pixels, checked in the browser. Sprint uses those same cells at a faster distance-driven cadence instead of the more exaggerated legacy run row.
- Idle and menu portraits hold their intact neutral cell. The old painted blink and torso-only bob are not replayed. No pixels are patched, limbs rigged, or replacement poses assembled.
- Cardinal substeps prevent tunnelling and diagonal collision slides; facing follows actual displacement. Click targets use one straight leg at a time and clamp travel to the remaining distance on that axis. Most-recent-held keyboard/touch direction takes priority without combining axes.
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
python scripts/build_embers_assets.py --normalized-only
python scripts/build_roots_assets.py --normalized-only
npm run format
```

Requires Pillow. The final Roots & Refuge stage restores the camp/satchel registry and Workbench atlas entry after the older static stages. No animation builder was used for art batches 2–7, and all 18 existing animation PNGs, including the inactive wildlife artifact, retain their pre-batch hashes.

Leaf motion/playback, ripples, sun shafts, canopy shadows, and ground microtextures reuse existing artwork or procedural pixel/lighting work—not additional image generations. Remaining prop/UI and whole-sheet animation work is tracked in `ART_ROADMAP.md` at the repository root.
