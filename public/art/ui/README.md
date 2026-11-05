# Generated game interface art

The interface preserves Wildpine’s rough forest palette, while using different frames for different jobs. Every source below was generated as **one standalone image**, chroma-keyed, cropped, resized with nearest-neighbor sampling, and palette-reduced. These were not generated together in a single multi-asset prompt.

## Eight active frame families

| Asset                 | Native pixels | Nine-slice inset | Usage                                                                      |
| --------------------- | ------------- | ---------------- | -------------------------------------------------------------------------- |
| `panel.png`           | 128 × 80      | 18               | Original woodland title buttons, day dial, objectives, pocket-bar surround |
| `status-frame.png`    | 160 × 80      | 14               | Stitched moss-green survival-status panel                                  |
| `dialog-frame.png`    | 160 × 120     | 20               | Carved wood/gold equipment windows, menus, guide, fieldcraft book          |
| `slot-frame.png`      | 40 × 40       | 8                | Recessed iron/brass inventory and quickbar slots                           |
| `fieldwork-frame.png` | 192 × 128     | 18               | New wood/iron Handcraft and Workbench                                      |
| `satchel-frame.png`   | 192 × 128     | 20               | Dedicated dynamic inventory                                                |
| `settings-frame.png`  | 192 × 128     | 18               | Sage/brass settings window                                                 |
| `hearth-frame.png`    | 192 × 96      | 20               | Dark wood/copper live campfire panel                                       |

Each is one real generated frame. The original frames stretch their edges and filled centers while preserving the corner pixels. The new workshop frame uses inset 18 with round-repeated edges and **no center fill**, so its inner stitching never stretches across the content. The satchel, settings, and hearth frames also use round-repeated edges without center fill. The original title frame remains in use. The registries are `src/game/generated-assets.json` and `public/art/generated-assets.json`.

## Eighteen interface glyphs

| Asset                 | Native pixels | Usage                                        |
| --------------------- | ------------- | -------------------------------------------- |
| `backpack.png`        | 24 × 24       | Satchel / Hold actions; forager batch        |
| `map.png`             | 24 × 24       | Map and journey navigation                   |
| `journal.png`         | 24 × 24       | Journal and survival guide                   |
| `hammer.png`          | 24 × 24       | Crafting actions                             |
| `heart.png`           | 16 × 16       | Health pips and condition menu               |
| `food.png`            | 16 × 16       | Hunger meter and advice                      |
| `water.png`           | 16 × 16       | Thirst meter and related UI                  |
| `thermometer.png`     | 16 × 16       | Warmth meter and advice                      |
| `stamina.png`         | 16 × 16       | Stamina meter and advice                     |
| `settings.png`        | 24 × 24       | Settings controls                            |
| `compass.png`         | 24 × 24       | Fieldcraft, navigation, and touch-pad center |
| `pine-emblem.png`     | 40 × 40       | Opening and world-entry loading crest        |
| `workbench-icon.png`  | 24 × 24       | Crafting stations and workshop navigation    |
| `audio-emblem.png`    | 24 × 24       | Audio settings and sound check               |
| `display-emblem.png`  | 24 × 24       | Display settings and live preview            |
| `controls-emblem.png` | 24 × 24       | Control reference tab                        |
| `wolf-mark.png`       | 24 × 24       | Pack warning and combat reference            |
| `mouse-emblem.png`    | 24 × 24       | Left-click held-item use affordance          |

The campfire-interface batch also supplies **`../effects/impact-star.png`**, one 16 × 16 generated bitmap for contact sparks and embers. Smoke, dust, rain splashes, cold breath/frost, and lighting are procedural effects, not additional generated images or assembled character frames.

## Loading scenes and camp props

The Hearth & Hand batch also supplies `../loading/forest-arrival.png` and `../loading/camp-arrival.png` (640 × 360), and the original world table. Roots & Refuge replaces `../objects/workbench.png` with a smaller **42 × 30**, anchor **21/26**, standalone generated prop. Its original 24 × 24 UI glyph is preserved and reused in the inventory atlas. New generated camp props are the matched empty/occupied bench states (48 × 42, anchor 24/40), pine stump (26 × 22), and camp clearing (240 × 184). The occupied state is one approved complete AI drawing, never assembled limbs. `../textures/satchel-linen.png` adds a 64 × 64 backing texture. The old workshop-frame file remains as historical art but is not the active workshop frame.

The first loader tracks decoded title/UI images and fonts. World entry tracks its images, baked ground, initial rendered frame, and ready state. Progress is counted work, not an estimated time. Slow/failed loads keep the simulation inactive and offer retry/cancel controls. Source and runtime paths are recorded in both generated-asset registries.

## Rebuild the latest batch

```sh
python scripts/build_roots_assets.py --normalized-only
npm run format
```

Requires Pillow. Inputs: `../generated/roots-reclaimed/`; local originals: `.art-originals/roots-reclaimed/`. This restores eight static images, the registry, and the sixteenth atlas cell without altering the prior fifteen cells or any animation PNG. Nine generation calls produced eight unique images, below the ten-call cap.

If rebuilding older static assets as well, run these in order:

```sh
python scripts/build_inventory_assets.py --normalized-only
python scripts/build_camp_ui_assets.py --normalized-only
python scripts/build_trail_ui_assets.py --normalized-only
python scripts/build_hearth_assets.py --normalized-only
python scripts/build_embers_assets.py --normalized-only
python scripts/build_roots_assets.py --normalized-only
npm run format
```

The **Roots & Refuge builder must run last**, since older stages may restore an older registry. All sixteen inventory icons use generated artwork. The Workbench reuses the existing glyph rather than spending an extra generation.

Condition and fieldcraft menus are read-only and pause the world. The workshop deliberately changes inventory, applying exact batch costs only after validating station reach and materials. The movement fixes select existing complete cells; see `../animations/README.md` for remaining whole-sheet/crouching-art limitations.

As of v0.7.1 the touch pad exposes only four cardinal buttons. Diagonal buttons were removed at the user’s request; keyboard, touch dragging, and click-to-move also use one movement axis at a time. This control revision changes no generated images.

As of v0.8, right-click is ground navigation, left-click uses/attacks with the manually equipped item, E is general interaction, and F is unbound. The campfire panel is **not** a pause dialog: fuel and survival time keep running. Its single log button consumes only at placement contact and yields back to movement or danger. As of v0.9, the camp bench uses the explicitly approved whole seated static image. Animated sitting transitions, bite and fallen actor sheets remain pending; wolf feedback still uses existing whole frames.

**C always opens Handcraft** (Workbench, torch, bandage). **E on a placed Workbench** opens the full workshop, with station identity and reach checked at craft time; cooking also requires a burning fire. No station is gifted to new or migrated saves. The satchel defaults to owned items, with optional missing items, search/category/sort controls, live details, and six drag/drop or tap/keyboard pockets. Buttons can clear a pocket without throwing away an item. Both new menus pause the simulation; the seated campfire panel does not.
