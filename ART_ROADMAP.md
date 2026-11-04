# Art polish · batch progress

## Current agreement

After the whole-sheet-generation limitation was explained, the user approved **separate AI-generated item, texture, and UI images**, up to ten per batch, with **animation-sheet generation on hold**.

Do not create more rigged poses or synthetic animation frames. Complete AI-drawn animation sheets can be cropped and integrated if supplied. The requested whole-sheet animation overhaul is **not complete**. Player movement is now cardinal-only: the user explicitly removed diagonal movement in v0.7.1. Eight-direction movement/art is no longer a pending feature for the current controls. Existing animation sheets from earlier work remain in the game; the latest static-art batches do not redraw or reconstruct them. Batches 4 and 5 correct runtime playback, carrying, collision, and input without constructing frames.

## Control revision · v0.7.1 · no image generations

- Removed diagonal player movement from keyboard combinations, thumb dragging, and click-to-move. Four cardinal directions remain, with most-recent-held input priority and no diagonal/staircase shortcuts.
- Removed the four diagonal touch buttons and their styles. The neutral center/empty corners cannot click through into the ground; captured thumb dragging still supports the four remaining directions.
- Old v2 diagonal-facing saves migrate without resetting supplies or progress. Existing face/leg playback corrections and all tool animation PNGs remain intact.
- Added 34 unit regressions for single-axis movement, input ownership/order, straight-leg target travel, and save migration. Current suite: **172 unit tests and 45 browser scenarios**.
- No generated assets were created or rebuilt. Historical eight-way descriptions below document v0.6/v0.7, not current behavior.

## Batch 5 · Hearth & Hand · v0.7 · six accepted images

**Seven image-tool calls used:** six successful standalone generations and one unsuccessful table-padding edit. The original table image remains in use. This is below the ten-generation cap; no further images are needed for this feature pass.

| AI-generated image       | Integration                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| Forest arrival panorama  | Opening loader and pre-JavaScript HTML fallback; 640 × 360                     |
| Camp arrival panorama    | Distinct new-world / return-to-camp loader; 640 × 360                          |
| Wooden crafting table    | Interactive world object and workshop illustration; 64 × 44, anchor 32/39      |
| Wood/iron workshop frame | Crafting window; 192 × 128, inset 26, round-repeated edges without center fill |
| Pine medallion           | Loading-screen emblem; 40 × 40                                                 |
| Crafting-table glyph     | Station requirements, recipe navigation and trail tips; 24 × 24                |

Raw sources: `.art-originals/hearth-workshop/` (ignored). Reproducible normalized sources: `public/art/generated/hearth-workshop/`. Run `scripts/build_hearth_assets.py --normalized-only` after all older static builders, then format. This stage only crops, keys, nearest-resizes, palette-reduces, and copies standalone images.

### Gameplay / interface work

- Separate custom opening/world loading flows, counted decoded assets and fonts, preparation steps, error/timeout retry, cache reuse, cancellation, input gating, and an HTML pre-bundle fallback.
- A solid camp workbench, E interaction, map marker, old-save overlap recovery, and table-gated pickaxe/shelter recipes. A redesigned searchable/filterable workshop shows material counts and station availability and supports atomic batches of 1–99.
- Diagonal-first substep collision, actual-motion facing, precise click arrival, and touch-drag sectors/dead zone. Upward diagonals use existing rear-facing art; downward diagonals use front-facing art, mirrored as whole frames to the west.
- Walk frames **0, 3, 4, 7** replace the still-misaligned 1/5 cells from v0.6. Idle/portrait playback holds cell 0, avoiding a painted-over face and detached torso bob. The original animation PNGs and tool timing remain unchanged; no new rigging or pose assembly.
- **Not delivered:** newly drawn omnidirectional sheets or a true crouching collection cycle. Existing shorter gathering cells remain in use.

The v0.7 suite included **138 unit tests and 43 browser scenarios**. New browser checks compare decoded head pixels, simulate delayed/failed/cancelled loading, exercise table interactions and batch crafting, and send real native touch-drag events in portrait and landscape layouts.

## Batch 4 · Trail & Camp · v0.6 · 10/10 generations

**All ten generations are used. No more until “continue.”** These are ten separate standalone images, not a combined generation or an animation sheet.

| AI-generated image               | Integration                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Stitched moss-green status frame | Health/needs panel; 160 × 80, nine-slice inset 14                            |
| Carved wood/gold dialog frame    | Equipment, reference books, settings, and other dialogs; 160 × 120, inset 20 |
| Iron/brass pocket frame          | Inventory and quickbar slots; 40 × 40, inset 8                               |
| Heart                            | Partial health pips and health menus; 16 × 16                                |
| Bread                            | Hunger meter and recovery advice; 16 × 16                                    |
| Water droplet                    | Thirst meter and related UI; 16 × 16                                         |
| Thermometer                      | Warmth meter and recovery advice; 16 × 16                                    |
| Stamina bolt                     | Stamina meter and recovery advice; 16 × 16                                   |
| Settings cog                     | Title, pause, and game settings; 24 × 24                                     |
| Trail compass                    | Fieldcraft, navigation, and touch-pad center; 24 × 24                        |

The original title-button frame is preserved. At v0.6 there were **four generated frame families, eleven generated UI glyphs, and fifteen generated inventory icons**.

### Interface and controls

- Readable stacked need meters, fractional health hearts, a paused **Your condition** menu (H), recovery advice, and low-need indicators without flashing.
- **Compact HUD** defaults on, with a saved preference to restore the minimap and extra hints. Essential controls, survival needs, and saving warnings remain available.
- A searchable **Fieldcraft** book with all fifteen item descriptions and all seven recipe requirements, available from title and pause menus. Saved-camp resume cards and responsive two-column landscape title actions add useful menu depth.
- Eight-way keyboard/touch movement and saved facing, normalized diagonal speed, corner-safe collision checks, and independent ownership of keyboard/multi-touch controls.
- The walking/running renderer selects existing complete source cells **0, 1, 4, 5** and advances by actual travelled distance. It skips the widest malformed legacy strides and does not walk in place when blocked. No limb rigging, interpolation, or new frames are used.
- Carried tools mirror the inventory bitmap at the grip so the axe blade faces away from the survivor. The full-body axe/pickaxe strike sheets and their frame-4 contact timing are unchanged.
- Plant collection keeps the feet planted and selects only the shorter existing reach poses. **This is not a new crouching cycle.** Proper crouching/bending collection artwork and genuinely drawn diagonal walking poses remain pending complete AI-drawn sheets.

### Provenance and rebuilding

Raw outputs: `.art-originals/trail-ui/` (ignored). Normalized inputs: `public/art/generated/trail-ui/`.

```sh
python scripts/build_trail_ui_assets.py --normalized-only
npm run format
```

The script keys, crops, nearest-resizes, palette-reduces, and copies static images. It never calls an animation builder or edits the existing item atlas. For current builds, follow this older stage with `build_hearth_assets.py --normalized-only`.

The v0.6 suite had **107 unit tests and 30 browser scenarios**, including eight-way speed/facing/save support, input ownership, gait selection, planted gathering, outward carrying, frame provenance, fieldcraft filtering, condition details, compact/full HUD preferences, and mobile layouts.

## Batch 3 · campfire interface · v0.5 · 10/10 generations

**All ten generations are used. Further image generation waits for “continue.”** Each entry below is a separate generated image, not part of a combined generation or an animation sheet.

| AI-generated image | Integration                                                  |
| ------------------ | ------------------------------------------------------------ |
| Herbal bandage     | Inventory, pockets, held-item rendering                      |
| Torch              | Inventory, pockets, held-item rendering                      |
| Forest stew        | Inventory, recipes, held-item rendering                      |
| Campfire kit       | Inventory, recipes, held-item rendering                      |
| Shelter kit        | Inventory, recipes, held-item rendering                      |
| Map                | Map/journey UI glyph                                         |
| Journal            | Journal/guide UI glyph                                       |
| Crafting mallet    | Crafting UI glyph                                            |
| Wood/leather panel | Nine-slice title buttons, HUD, pocket bar, equipment windows |
| Impact star        | Resource-contact sparks and campfire embers                  |

### Game interface and effects

- Fullscreen title screen with vertical keyboard-navigable actions and compact wilderness selection. **Only The Forest is playable.**
- Health hearts, need/stamina gauges, a day dial, compact objectives, generated panel framing, simplified held-item controls, and a centered satchel/crafting window. Touch layouts support portrait and landscape.
- **All 15 inventory icons now use generated images.** The inventory still has 15 items and 7 recipes; this batch changes presentation, not game balance or save schemas.
- Smoke, footstep dust/wet marks, rain impacts, cold breath/frost, held-torch light, and damage-edge feedback complement the generated sparkle. These are procedural rendering effects, not additional image generations or newly assembled actor frames.
- Effects use simulation time and respect pause, atmosphere, and reduced motion. Footprints are capped and expire; cosmetic state is not saved. Reduced motion keeps only static light/frost cues from this layer.

### Provenance and rebuilding

Raw outputs: `.art-originals/camp-ui/` (ignored). Reproducible normalized inputs: `public/art/generated/camp-ui/`. Preparation keys, crops, nearest-resizes, and reduces palettes; it does not draw replacement silhouettes or construct animation poses.

```sh
python scripts/build_camp_ui_assets.py --normalized-only
npm run format
```

Requires Pillow. This was the v0.5 static-art stage; follow it with `build_trail_ui_assets.py --normalized-only`. For this stage, run it after any older art builder to restore all generated icons and the latest UI/effect registries. It never invokes an animation builder. See `public/art/ui/README.md` for sizes and nine-slice metadata.

Validation: **87 unit tests and 23 browser scenarios pass**, including the production `/Pixel-Game/` build. Coverage includes the title keyboard menu, heart meters, equipment layout, effect preferences/pausing/contact, source images, gameplay/save compatibility, and portrait/landscape controls. The normalized rebuild is byte-for-byte identical, all pre-batch animation hashes match, the Pages asset check passes, and the dependency audit reports zero vulnerabilities.

## Batch 2 · forager assets · v0.4 · 10/10 generations

| AI-generated image | Integration                                           |
| ------------------ | ----------------------------------------------------- |
| Pine wood          | Inventory, recipes, pockets, held items               |
| River stone        | Inventory, recipes, held items                        |
| Wild fiber         | Inventory, recipes, held items                        |
| Wild berries       | Inventory, recipes, pockets, held items               |
| Golden mushroom    | Inventory, recipes, held items                        |
| Spring water       | Inventory, recipes, pockets, held items               |
| Pine nuts          | New food from felled pines; restores 14 hunger        |
| Berry tea          | New campfire recipe; restores 25 thirst and 24 warmth |
| Forest floor       | Generated terrain bitmap beneath the world            |
| Backpack           | Generated satchel/Hold icon                           |

Tea costs two berries and one water, with a burning fire nearby. One portion of nuts drops on the final tree impact alongside four wood. Both items support Hold, Use/F, arbitrary pocket assignments, contact-frame consumption, cancellation, and save/load. Existing v1/v2 saves receive empty nuts/tea slots; explicitly invalid supplied values remain rejected.

This batch completed ten of fifteen inventory icons; batch 3 replaces the other five. Terrain is baked after its bitmap loads, including on the first adventure, with nearest-neighbor rendering.

Normalized inputs: `public/art/generated/forager-batch/`; originals: `.art-originals/asset-batch2/`. `scripts/build_inventory_assets.py --normalized-only` rebuilds this stage without animation work. **Follow it with `build_camp_ui_assets.py --normalized-only`**, or its older registry would hide the newer UI assets.

## Still to generate / replace

The wider all-assets request is **not finished**:

- **Forest props and decorations:** remaining camp furniture, shelter details, trail/spring artwork, additional ground cover and world props. Existing generated pines, bushes, rocks, and fire provide references.
- **Remaining general UI glyphs:** weather, combat/actions, sound, pause, and miscellaneous interface symbols. Backpack, map, journal, crafting, workbench, pine medallion, compass, settings, and the five vital symbols are generated; not every UI glyph is.
- **More generated textures:** the forest floor is integrated; other surfaces still include procedural detail.
- **Complete AI-drawn directional animation sequences:** especially a true crouching berry-collection cycle and intact four-direction walk/run art. Pending supplied sheets or a supported whole-sheet workflow. Do not silently substitute assembled poses.

Suggested next batch: forest props/ground cover and remaining weather/action glyphs, within the ten-generation cap. No further images should be generated until the user says “continue.”

## Earlier batch 1 · retained, not newly generated here

Ten earlier generations supplied four survivor poses, four wolf gait poses, an axe, and a pickaxe. They were assembled into six 4 × 2 directional actor/tool sheets and two wolf sheets, with left-facing poses mirrored. These earlier animations predate the current workflow decision and are **not** claimed to be single-prompt whole-sheet generations.

Existing forest polish includes procedural sun shafts, canopy shadows, ground/path details, drifting leaves, pond rings, cold mist, a persisted atmosphere switch, and reduced-motion handling. No new animation images were generated or changed in batches 2, 3, 4, or 5.
