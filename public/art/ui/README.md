# Generated game interface art

The interface preserves Wildpine’s rough forest palette, while using different frames for different jobs. Every source below was generated as **one standalone image**, chroma-keyed, cropped, resized with nearest-neighbor sampling, and palette-reduced. These were not generated together in a single multi-asset prompt.

## Five frame families

| Asset                | Native pixels | Nine-slice inset | Usage                                                                      |
| -------------------- | ------------- | ---------------- | -------------------------------------------------------------------------- |
| `panel.png`          | 128 × 80      | 18               | Original woodland title buttons, day dial, objectives, pocket-bar surround |
| `status-frame.png`   | 160 × 80      | 14               | Stitched moss-green survival-status panel                                  |
| `dialog-frame.png`   | 160 × 120     | 20               | Carved wood/gold equipment windows, menus, guide, fieldcraft book          |
| `slot-frame.png`     | 40 × 40       | 8                | Recessed iron/brass inventory and quickbar slots                           |
| `workshop-frame.png` | 192 × 128     | 26               | Dedicated wood/iron camp workshop                                          |

Each is one real generated frame. The original frames stretch their edges and filled centers while preserving the corner pixels. The workshop frame uses inset 26 with round-repeated edges and **no center fill**, so its inner stitching never stretches across the content. The original title frame remains in use. The registries are `src/game/generated-assets.json` and `public/art/generated-assets.json`.

## Thirteen interface glyphs

| Asset                | Native pixels | Usage                                        |
| -------------------- | ------------- | -------------------------------------------- |
| `backpack.png`       | 24 × 24       | Satchel / Hold actions; forager batch        |
| `map.png`            | 24 × 24       | Map and journey navigation                   |
| `journal.png`        | 24 × 24       | Journal and survival guide                   |
| `hammer.png`         | 24 × 24       | Crafting actions                             |
| `heart.png`          | 16 × 16       | Health pips and condition menu               |
| `food.png`           | 16 × 16       | Hunger meter and advice                      |
| `water.png`          | 16 × 16       | Thirst meter and related UI                  |
| `thermometer.png`    | 16 × 16       | Warmth meter and advice                      |
| `stamina.png`        | 16 × 16       | Stamina meter and advice                     |
| `settings.png`       | 24 × 24       | Settings controls                            |
| `compass.png`        | 24 × 24       | Fieldcraft, navigation, and touch-pad center |
| `pine-emblem.png`    | 40 × 40       | Opening and world-entry loading crest        |
| `workbench-icon.png` | 24 × 24       | Crafting stations and workshop navigation    |

The campfire-interface batch also supplies **`../effects/impact-star.png`**, one 16 × 16 generated bitmap for contact sparks and embers. Smoke, dust, rain splashes, cold breath/frost, and lighting are procedural effects, not additional generated images or assembled character frames.

## Loading scenes and the world table

The Hearth & Hand batch also supplies `../loading/forest-arrival.png` and `../loading/camp-arrival.png` (640 × 360), and `../objects/workbench.png` (64 × 44, anchor 32/39). The table is a single generated prop, not an assembled object or character frame. Its smaller 24 × 24 UI glyph was generated separately.

The first loader tracks decoded title/UI images and fonts. World entry tracks its images, baked ground, initial rendered frame, and ready state. Progress is counted work, not an estimated time. Slow/failed loads keep the simulation inactive and offer retry/cancel controls. Source and runtime paths are recorded in both generated-asset registries.

## Rebuild the latest batch

```sh
python scripts/build_hearth_assets.py --normalized-only
npm run format
```

Requires Pillow. Inputs: `../generated/hearth-workshop/`; local originals: `.art-originals/hearth-workshop/`. This restores two landscapes, one prop, one frame, and two glyphs without touching inventory or animation images.

If rebuilding older static assets as well, run these in order:

```sh
python scripts/build_inventory_assets.py --normalized-only
python scripts/build_camp_ui_assets.py --normalized-only
python scripts/build_trail_ui_assets.py --normalized-only
python scripts/build_hearth_assets.py --normalized-only
npm run format
```

The **Hearth & Hand builder must run last**, since older stages may restore an older registry. All fifteen inventory icons are already generated; this batch adds a world station, not a new inventory item.

Condition and fieldcraft menus are read-only and pause the world. The workshop deliberately changes inventory, applying exact batch costs only after validating station reach and materials. The movement fixes select existing complete cells; see `../animations/README.md` for remaining crouch/diagonal-art limitations.
