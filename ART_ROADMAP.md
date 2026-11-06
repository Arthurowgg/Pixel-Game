# Art polish · batch progress

## Batch 10 · Undergrowth · v0.11.0 · six shipped images, nine calls

**9/10 image-generation calls used.** Every call produced one standalone prop on a flat magenta sheet; nothing was generated as a grid, a sheet or a rigged limb. Three calls were re-rolls: the first fern read as a dark blob at 22 × 18, and the first two wildflower sheets either smeared or grew a stray outline loop around a blossom. The clover tuft was added after the palette was settled.

| AI-generated image    | Runtime integration                                                        |
| --------------------- | -------------------------------------------------------------------------- |
| Mushroom cluster      | 18 × 14, `objects.mushrooms`; fairy ring, log shelves, scattered in groves |
| Fern frond (3rd try)  | 22 × 18, `objects.fern`; groves, trail verges, pond margins                |
| Wildflowers (3rd try) | 18 × 14, `objects.wildflowers`; clearing rims and trail verges             |
| Clover tuft           | 20 × 13, `objects.clover`; the commonest low ground cover                  |
| Mossy boulder         | 20 × 15, `objects.mossBoulder`; by the waystones, sparse elsewhere         |
| Marsh reeds           | 16 × 22, `objects.reeds`; pond shoreline only                              |

Placement lives in `src/game/decor.ts`: a 58 px jittered grid weighted by `groveDensity`, `trailDistance` and `inClearing`, plus the composed spots. It is keyed on the save seed and cached per seed, so props are identical across reloads and old saves pick them up without a migration.

Sources: `.art-originals/decor-pass/` (ignored); normalized input: `public/art/generated/decor-pass/`. Run **`scripts/build_decor_assets.py` after batches 8–9**: it keys the magenta sheet, crops, area-downsamples, reduces to 16 colours, applies the gain/desaturation pass and rewrites the shared registry.

## Batch 9 · Trails & Twilight animation pass · v0.10.2 · one shipped image, four calls

**4/10 image-generation calls used.** Three of them are art direction only and ship no pixels: a two-view survivor reference (front/side) and single hatchet/pickaxe sprites. At a 13 px in-hand size the generated tools lose their structure, so the survivor and its tools stay authored pixels; the reference drove the new eyes, hair, collar, belt and boot detail.

| AI-generated image            | Runtime integration                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Dust puff                     | 20 × 15, `effects.dustPuff`; wolf landings and hits, scaled and faded — no drawn lines |
| Survivor front/side reference | Art direction only; not shipped                                                        |
| Hatchet sprite                | Art direction only; informed the authored `AXE_SPRITE`                                 |
| Pickaxe sprite                | Art direction only; informed the authored `PICK_SPRITE`                                |

Sources: `.art-originals/actor-pass/` (ignored); normalized input: `public/art/generated/actor-pass/`. Run **`scripts/build_actor_assets.py --normalized-only` last**: it keys the flat magenta sheet, crops, area-downsamples, reduces the palette and rewrites the shared registry.

## Current agreement

After the whole-sheet-generation limitation was explained, the user approved **separate AI-generated item, texture, and UI images**, up to ten per batch, with **animation-sheet generation on hold**.

Do not create more AI-generated rigged poses or synthetic frames from AI stills. Complete AI-drawn animation sheets can be cropped and integrated if supplied. **v0.10.1 exception, requested by the user:** the survivor's animation frames are now authored directly in code from one pixel rig (`src/game/actor.ts`) because the stitched AI pose cells could not hold a consistent eye, arm or tool grip. That rig is hand-drawn pixel art with no AI image generation; every AI-generated sheet remains unchanged. The requested whole-sheet animation overhaul is **not complete**. Player movement is now cardinal-only: the user explicitly removed diagonal movement in v0.7.1. Eight-direction movement/art is no longer a pending feature for the current controls. Existing animation sheets from earlier work remain in the game; the latest static-art batches do not redraw or reconstruct them. Batches 4–8 correct runtime playback, carrying, collision, and input without constructing frames. The v0.10.1 animation pass replaces the survivor's runtime drawing with an authored rig and uses no image-generation calls.

## Batch 8 · Trails & Twilight · v0.10 · eight images, eight calls

**8/10 image-generation calls used.** No additional calls are needed for this pass. Each call produced one standalone static image; no grid, animation sheet, or rigged limb was generated.

The batch supplies the ground and chart furniture for the new lighting, exploration, and map pass. The camp clearing arrived on a magenta sheet with a fully opaque body and a straight-edged path arm; the builder keys the sheet (including its soft mauve fringe), erases the arm geometrically for `x ≥ 1070, y 240–565`, and crops to the organic rim instead of clipping it at runtime.

| AI-generated image | Runtime integration                                              |
| ------------------ | ---------------------------------------------------------------- |
| Camp clearing      | 312 × 216, anchor 156/108; replaces the flat painted dirt patch  |
| Fallen log         | 64 × 40, anchor 32/34; clearing decoration                       |
| Waystone           | 38 × 46, anchor 19/42; one of three landmark props               |
| Field-map frame    | 192 × 128, nine-slice inset 14; replaces the CSS-only map border |
| Map paper          | 96 × 96; tiled parchment backing under the chart                 |
| Chart pine         | 16 × 22; discovered-tree pin                                     |
| Chart boulder      | 18 × 14; discovered-stone pin                                    |
| Forest cursor      | 28 × 32, hotspot 4/9; replaces the platform arrow over the world |

Sources: `.art-originals/trails-twilight/` (ignored); normalized inputs: `public/art/generated/trails-twilight/`. Run **`scripts/build_twilight_assets.py --normalized-only` last**, after every older static builder, because it rewrites the shared registry. The builder only keys, crops, nearest-resizes, palette-reduces, and copies; it never builds animation frames.

Gameplay: smooth daylight/darkness with a 90-unit torch pool and fire-lit ground; 40-unit exploration cells feeding a zoomable, pannable field chart with landmark pins and a charted percentage; five trails with a camp spur, four clearings, eight groves, and three waystone landmarks; six-chop pines, four-strike stone, and a 1.8-second berry hold with movement cancellation; a compact vitals card, one quickbar with a held-item strip and a touch handcraft slot, and a plain-language day/weather chip. The pre-batch hashes of all 17 animation sheets, both manifests, the item atlas, and every older prop were re-checked and are byte-identical; only `generated-assets.json` changes.

Historical batch notes below describe the choices at that time. This batch supersedes their static-map and three-chop descriptions.

## Batch 7 · Roots & Refuge · v0.9 · eight images, nine calls

**9/10 image-generation calls used.** No additional calls are needed for this pass. Eight distinct standalone images were retained; one additional generation revised the seated source's framing. No multi-asset grid or animation sheet was generated.

The user explicitly reversed the earlier standing-only decision **for sitting only**: a complete AI-drawn seated survivor **together with the bench** and a matching empty bench are approved. No assembled limbs, sitting transitions, new wolf bite/fallen poses, or crouching sheets are implied.

| AI-generated image               | Runtime integration                                                             |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Smaller wooden Workbench         | 42 × 30, anchor 21/26; replaces the world prop, not its liked icon              |
| Complete seated survivor + bench | 48 × 42, anchor 24/40; replaces the standing actor and empty bench while seated |
| Matching empty bench             | 48 × 42, same source crop/scale/anchor as the occupied state                    |
| Pine stump                       | 26 × 22, anchor 13/19; follows the existing fall clip                           |
| Worn satchel frame               | 192 × 128, inset 20; dedicated dynamic inventory                                |
| Wood/iron fieldwork frame        | 192 × 128, inset 18; handcraft and Workbench                                    |
| Camp clearing                    | 240 × 184, anchor 120/92; replaces the old rectangular log/rug decorations      |
| Satchel linen                    | 64 × 64; subtle tiled menu backing                                              |

The original Workbench glyph is unchanged. Its nearest-neighbor 16 × 16 copy occupies the previously empty final atlas cell; all prior 15 cells are preserved. Packing a static item atlas is not drawing a new animation sheet.

Sources: `.art-originals/roots-reclaimed/` (ignored); normalized inputs: `public/art/generated/roots-reclaimed/`. Run **`scripts/build_roots_assets.py --normalized-only` last**, after the older static builders. It only keys, crops, nearest-resizes, palette-reduces, and packs/copies static art. The final seated source touches its top/bottom edges; normalization adds transparent padding only, never invented anatomy.

Gameplay: no free station; three hand recipes; five station-required recipes; explicit saved station identity/reach; a real ghost/contact placement loop; owned-item/search/filter/sort satchel and six drag/drop/tap/keyboard pockets; safe cardinal approach to the actual seated state; generated stump and timed leaf feedback; stronger health plus distinct snap/pounce attacks with dodgeable locked targets. Existing controls, settings, saves, loaders, and actor/tool sheets remain intact.

Historical batch notes below describe the choices at that time. This batch supersedes their free-station and standing-only camp descriptions.

## Batch 6 · Ember & Instinct · v0.8 · seven accepted images

**7/10 image generations used.** Each call produced one standalone static UI image. The user chose **existing actor art only**, declining separate sitting, biting, and fallen poses. No animation sheets or replacement body parts were constructed.

| AI-generated image            | Integration                                               |
| ----------------------------- | --------------------------------------------------------- |
| Sage/brass settings frame     | Dedicated settings window; 192 × 128, nine-slice inset 18 |
| Dark wood/copper hearth frame | Quiet live campfire panel; 192 × 96, inset 20             |
| Audio emblem                  | Audio settings tab and sound check; 24 × 24               |
| Display emblem                | Pixel-scale/display controls and preview; 24 × 24         |
| Controls emblem               | Settings controls tab; 24 × 24                            |
| Wolf mark                     | Encounter warning and control reference; 24 × 24          |
| Left-button mouse emblem      | Held-item use button and control affordance; 24 × 24      |

Raw originals: `.art-originals/embers-instinct/` (ignored). Checked-in normalized inputs: `public/art/generated/embers-instinct/`. Runtime copies: `public/art/ui/`. Run **`scripts/build_embers_assets.py --normalized-only` last**, after the previous inventory → camp UI → trail UI → Hearth & Hand stages. Only cropping, keying, nearest-neighbor resizing, palette reduction, and copying are used.

- Wolves now have staggered wind-ups, locked dodgeable lunges, recovery, orbit slots, spacing, obstacle steering, hit interruptions and brief whole-frame defeat fades. Rendering uses the existing wolf alert/run/idle sheets; it does **not** provide a newly drawn biting or fallen cycle.
- Camp focus clears the HUD while safe, keeps fuel/world time live, and offers one log action. Existing safe forage cells and the complete generated log icon supply placement feedback; there is **no sitting pose**. Movement/danger cancels an unplaced log, and the table remains accessible.
- Settings have four functional tabs, actual view/audio/effect controls, fullscreen error handling, guarded defaults, and local preference migration.
- Left-click uses/attacks, E interacts, right-click/WASD moves, F is unbound, tools must be chosen manually, and the gameplay control legend is removed. Cardinal movement, existing tool swings, face/leg fixes, and save migration are retained.
- Current validation: **229 unit tests and 61 browser scenarios**, plus root/Pages builds, generated-source reproducibility and actor/manifest preservation checks.

**Still pending:** complete AI-drawn sheets for genuinely new sitting, biting, fallen-wolf, and crouching artwork. The seven UI images are not actor animations and do not fulfill that deferred work.

## Control revision · v0.7.1 · no image generations

- Removed diagonal player movement from keyboard combinations, thumb dragging, and click-to-move. Four cardinal directions remain, with most-recent-held input priority and no diagonal/staircase shortcuts.
- Removed the four diagonal touch buttons and their styles. The neutral center/empty corners cannot click through into the ground; captured thumb dragging still supports the four remaining directions.
- Old v2 diagonal-facing saves migrate without resetting supplies or progress. Existing face/leg playback corrections and all tool animation PNGs remain intact.
- Added 34 unit regressions for single-axis movement, input ownership/order, straight-leg target travel, and save migration. The v0.7.1 suite had **172 unit tests and 45 browser scenarios**.
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

- **Forest props and decorations:** remaining camp furniture and shelter details, spring/pond artwork, and additional ground cover. The camp clearing, fallen log, waystone, chart icons/frame/paper, and cursor from batch 8 provide references.
- **Remaining general UI glyphs:** weather, combat/actions, sound, pause, and miscellaneous interface symbols. Backpack, map, journal, crafting, workbench, pine medallion, compass, settings, and the five vital symbols are generated; not every UI glyph is.
- **More generated textures:** the forest floor is integrated; other surfaces still include procedural detail.
- **Complete AI-drawn directional animation sequences:** especially a true crouching berry-collection cycle and intact four-direction walk/run art. Pending supplied sheets or a supported whole-sheet workflow. Do not silently substitute assembled poses.

Suggested next batch: shelter/spring props and the remaining weather/action glyphs, within the ten-generation cap. No further images should be generated until the user says “continue.”

## Earlier batch 1 · retained, not newly generated here

Ten earlier generations supplied four survivor poses, four wolf gait poses, an axe, and a pickaxe. They were assembled into six 4 × 2 directional actor/tool sheets and two wolf sheets, with left-facing poses mirrored. These earlier animations predate the current workflow decision and are **not** claimed to be single-prompt whole-sheet generations.

Existing forest polish includes procedural sun shafts, canopy shadows, ground/path details, drifting leaves, pond rings, cold mist, a persisted atmosphere switch, and reduced-motion handling. No new animation images were generated or changed in batches 2–6.
