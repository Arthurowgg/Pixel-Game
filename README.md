# Wildpine

**A little world. A wild life.** A local-first pixel-art survival game for the browser, built with React, TypeScript, Vite, and a custom Canvas 2D engine.

## Play locally

```sh
npm ci
npm run dev
```

Use **Node.js 22 or newer**. The server binds to `0.0.0.0` and accepts preview hosts. All art, fonts, and game assets are self-hosted; playing needs no accounts, API keys, backend, or third-party runtime services.

```sh
npm run build     # Strict TypeScript checks + a root-path production build
npm run preview   # Serve that build
```

## Trails & Twilight · v0.10 · art batch 8

- **Nights that actually fall.** A smooth daylight curve (dawn 4.8–7.8, dusk 17.4–21.5) drives a darkness mask capped at 0.96 and thinned by cloud, so dusk arrives gradually instead of switching on. A burning pine torch carves a real 90-unit pool of light, campfires light their own ground, and the weather chip now says plain `Warm`, `Cold`, `Rain`, `Fog`, or `Storm`.
- **A field chart instead of a decorative minimap.** **M** opens a nine-sliced generated chart that draws only discovered ground, cell by cell (45 × 35 cells of 40 units): trails, clearings, camp, landmark pins, live “N% charted”, zoom (1.6× desktop, 2.4× narrow phones), and drag or arrow-key browsing. The legend, notes, and “your discoveries are saved” footer stay inside the parchment, and mobile frames no longer clip.
- **A forest of routes.** Five bounded trails, a camp spur, four clearings, eight groves, three waystone landmarks, fallen logs, and a generated camp clearing whose dirt now ends in an organic rim. Placement respects the layout: at least 6 units from trail centres and 39 units between stacked decorations.
- **Gathering has weight.** Pines take six chops, stone four strikes, and berries a 1.8-second hold with a visible progress ring; moving cancels the hold and pays nothing. Rewards are unchanged: 4 pine wood + 1 pine nuts, 3 river stone, 3 wild berries.
- **A HUD you can read at a glance.** One compact vitals card (heart row plus three labelled bars), a single centred quickbar with a held-item strip (`Use` / `Stow`), a minimap that follows discovery, a plain-language day/weather chip, and the same full-versus-compact HUD preference. Context hints now appear only when something is genuinely in reach.
- **Touch parity kept.** Handcraft is a quickbar slot (**C**), so map, satchel, handcraft, settings, and pause all stay one tap away with no keyboard.

**Eight standalone generated images, eight generation calls**, below the ten-call cap: a camp clearing, a fallen log, a waystone, a field-map frame, tiled map paper, two chart icons (pine, boulder), and a forest cursor. The builder only chroma-keys, crops, nearest-resizes, palette-reduces, and copies static art; it also erases the clearing's straight-edged path arm geometrically so no magenta fringe or hard cut survives. All 17 animation sheets, both manifests, the 16-item atlas, and every existing prop are byte-identical after the rebuild.

## Roots & Refuge · v0.9 · art batch 7

- **Earn your Workbench.** There is no free starter station or kit. Gather **6 pine wood + 3 wild fiber**, open **C**, and make one by hand. Equip the kit, aim at clear ground, and explicitly place it. A green/red ghost previews the footprint; the kit is spent once, at contact. Workbenches are smaller, solid, individually saved, and marked on the map. The original liked Workbench icon is unchanged.
- **Two distinct crafting paths.** **C always opens Handcraft**: Workbench, torch, and bandage only. **E at your placed Workbench** opens the full workshop. Pickaxe, campfire, shelter, stew, and tea require that specific station in reach; cooking also needs a burning fire. The new wood/iron menu retains search, categories, exact material counts, batch quantities, and useful feedback.
- **A working satchel, not just a new skin.** Owned-item tiles, optional missing items, live category/quantity counts, search, three sorting modes, selected-item details, recipe uses, explicit hold/use actions, and six drag/drop pockets. Pinning also works by tap or keyboard; each pocket can be cleared without discarding anything. The dedicated frame and linen texture differ from the workshop and other menus. Layouts support narrow phones and short landscape screens.
- **A remade starting clearing.** New generated ground and a matching empty/resting bench. Stand safely by the first fire or interact to walk to the bench in collision-checked cardinal legs, then genuinely sit. Movement, other actions, danger, and critical needs cancel the approach/rest. The live hearth still has one big log action; fuel and time never pause. Reopening the bench with E does not silently spend a log.
- **Visible chopping aftermath.** A generated pine stump remains after the existing fall clip. Chopping releases bounded, short-lived leaves using the existing leaf animation. Atmosphere-off and reduced-motion settings hide the extra leaf motion without changing rewards.
- **Harder, still dodgeable wolves.** New packs have **3 / 4 / 5 health** on Explorer / Survivor / Wild. Quick snaps and heavier pounces have distinct warnings, locked targets, and recovery. A pounce gets a longer 0.8-second tell and a landing marker; pack spacing, one attacker at a time, fire/torch protection, and interruptible attacks remain.
- **Progress and controls preserved.** Existing saves gain empty Workbench fields without receiving a station or losing supplies. All 16 items remain manually holdable. No diagonal movement, no automatic tool selection, F remains unbound, and only The Forest is playable. Field notes now guide gathering fiber, making and placing a Workbench before the shelter.

**Eight standalone generated images, nine generation calls** (one seated-source revision), below the ten-call cap. The newly approved sitting exception is **one complete AI-drawn survivor-and-bench static state**, paired with an empty bench—not assembled limbs, a rig, or a new animation sheet. Existing actor/tool sheets and both animation manifests are preserved. New bite/fallen-wolf poses and genuinely crouching gathering remain deferred.

The earlier release notes below are historical. This version supersedes the free starter table, station access through C, and standing-only camp behavior described there.

## Ember & Instinct · v0.8 · art batch 6

- **A more readable wolf pack.** Wolves spread into separate approach slots, avoid obstacles and each other, and take turns attacking. A 0.55-second wind-up locks the landing point; the following lunge can be dodged. Hits interrupt their intent, push them back without tunnelling through obstacles, and leave brief defeat feedback. Fires and held burning torches still discourage them. Wolves can escape old collision overlaps or a newly placed fire instead of getting stuck.
- **More forgiving axe contact, with manual equipment.** Aimed swings prioritize the clicked wolf, reach a little farther, and can catch two targets in front. Damage still lands at the existing contact frame. Trees require an equipped axe; stone requires an equipped pickaxe. Owning the correct tool is no longer enough, and attacks never silently equip it.
- **New controls:** left-click attacks or uses the held item; holding it repeats tool swings. **E** is general interaction. **Right-click** and **WASD/arrows** move, always on one cardinal axis. **F is unbound.** Touch keeps the four-way pad and separate use/interact/defend buttons. The permanent controls legend has been removed from the gameplay HUD.
- **A dedicated pixel-framed settings window.** Display, Audio, Interface, and Controls tabs; three visual presets; real 2×/3× world scaling; independent master/effects/ambience levels; mute and sound check; atmosphere, motion, damage/storm flashes, vignette, floating numbers, objectives, and HUD options. Preferences apply immediately and remain local. Fullscreen failure is handled, resets require confirmation, and keyboard/focus behavior works on desktop and mobile.
- **A quieter, live campfire.** Stand close and still while safe to clear away the HUD. The dedicated hearth frame shows fuel, estimated burn time, and one large log action. A whole log icon travels from the existing hand position into the fire; one wood is spent at 0.58-second contact, not at button press. Movement, danger, leaving, or changing items can cancel an unplaced log. Holding E never auto-feeds logs. Movement/dismissal restores the HUD; nearby danger or critical needs prevent quiet focus. The world and fuel keep running, and the crafting table remains independently interactable.

**Seven standalone generated images** supply two frame families and five glyphs, below the ten-generation cap. The user chose **existing actor art only**: wind-up/lunge/hurt/fade timing and safe whole-cell playback improve feedback, but **new sitting, biting, fallen-wolf, and crouching poses are not provided**. Those still require complete AI-drawn sheets. All existing actor/tool images and both animation manifests are unchanged.

## Four-direction controls · v0.7.1

Diagonal player movement has been removed at the user's request. Only **up, down, left, and right** remain:

- WASD and arrow keys use the **most recently pressed held direction**. Releasing it restores the previous held direction. Key repeat, modifiers, and overlapping fingers cannot combine movement axes or increase speed.
- The touch pad has four cardinal buttons. Thumb dragging still works, but always chooses one axis; the center rests and dragging outside releases movement. Empty corners do not click through to the world.
- Ground navigation (right-click as of v0.8) completes one straight leg before turning onto the other axis. It does not alternate axes every frame to approximate a diagonal. Obstacles stop the route; this is not automatic pathfinding.
- Older v2 saves with diagonal facing migrate to their existing up/down pose without resetting location, inventory, equipment, or progress. New saves contain only cardinal facing.
- The corrected walking/idle cells and all axe/pickaxe animation PNGs are unchanged. **No image generation or animation rebuilding was needed.**

The eight-way control descriptions in the historical release notes below are superseded by this update.

## Hearth & Hand · v0.7 · art batch 5

- **A custom opening screen and a separate world-entry scene.** New pixel-art panoramas, a brass pine emblem, trail tips, a stepped progress track, and saved-camp details. A small HTML arrival screen also paints before JavaScript downloads, so a slow bundle no longer leaves a blank page.
- **Real loading progress, not a timer.** The opening loader waits for decoded menu/UI images and fonts. World entry then loads its sheets/props, bakes terrain, and paints the first frame before enabling controls or survival time. A short 0.5-second transition prevents a flash on cached entries. Failed/stalled images have retry controls; successes stay cached, cancellation ignores late callbacks, and failed entry does not overwrite the save.
- **A real crafting table at the starting camp**, just east of the first fire. Walk up and press **E**, or open **C** nearby. It is rendered from a generated prop, blocks movement/building, appears on the map, and is automatically present in old saves. Old positions inside its new footprint are moved to the nearest free edge.
- **The camp workshop replaces the old crafting list.** Search, keyboard category tabs, ready-only filtering, item previews, exact have/need counts, station requirements, quantity controls, and atomic batch crafting up to 99 items. A successful result can be held immediately without being consumed.
- **Crafting stations matter:** pickaxes and shelters require the camp table; stew and tea require a burning fire; bandages, torches, and campfire kits can be made by hand anywhere. All seven recipes keep their previous ingredient costs.
- **Diagonal movement corrections (removed in v0.7.1):** try the actual diagonal before sliding around an obstacle, use short collision substeps, face the direction actually travelled, and stop precisely at nearby click targets. One captured thumb can slide between all eight directions, rest in the pad’s center, or release by dragging away.
- **Face/leg playback corrections:** walk cells **0, 3, 4, 7** keep the original head/torso registered and avoid the coat-lift/boot mismatch. Idle holds its neutral cell rather than replaying the malformed painted blink/bob. Upward diagonals now use back art; downward diagonals use front art, with whole-frame westward mirroring. Foreground pines become more transparent over the survivor. The liked axe/pickaxe sheets and contact timing are unchanged.

**Six standalone generated assets** were integrated: two loading landscapes, a table prop, a workshop frame, and two glyphs. Seven image-tool calls were used (one unsuccessful padding edit), below the ten-call cap. No new actor poses or animation frames were constructed. **True crouching remains pending. Eight-direction movement is no longer part of the current controls.**

## Trail & Camp · v0.6 · art batch 4

- **Three new generated frame families:** stitched moss-green survival status, carved wood/gold dialog windows, and recessed iron/brass inventory slots. The current woodland title-screen frame is retained.
- **Readable vitals:** generated health, hunger, thirst, warmth, and stamina symbols; clearly labelled bars, numbers, and non-flashing low-need indicators. Click the info button or press **H** for a paused condition screen with practical recovery advice.
- **A quieter HUD by default.** The persisted Compact HUD preference hides the minimap, repeated control hints, and older notices without hiding survival gauges, warnings, pockets, or access to the map/journal.
- **More menus:** a searchable fifteen-item fieldcraft book, all seven recipe references, extra pause-menu destinations, a saved-camp resume card, and a compact landscape title layout. Settings and compass glyphs also use generated bitmaps.
- **Eight-way movement and facing (removed in v0.7.1):** keyboard combinations and dedicated one-finger diagonal touch buttons, normalized speed, combined-position collision checks, multi-pointer/keyboard input ownership, and saved diagonal directions. Diagonal facing reuses the existing cardinal art; these are not new eight-direction animation sheets.
- **Movement playback fixes:** gait advances with distance actually travelled, skips the worst legacy leg cells, and stops when blocked/paused. Sprint uses the same intact walk cells at a faster distance-driven cadence. Carried axes/pickaxes are mirrored at the grip so the blade faces outward; complete strike sheets and their contact timing are untouched.
- **Collection cleanup:** plant gathering holds the feet still during the short action and avoids the two overextended reach poses. **A genuine crouching collection cycle is still pending**—the current sheet does not contain one, and no replacement poses were rigged or invented.

**10/10 generations used:** three frames plus seven glyphs, each generated separately. All inventory icons remain generated. Animation PNGs are byte-identical to the previous batch. More generation waits for “continue.”

## The campfire interface · v0.5 · art batch 3

- **A game title screen, not a website header:** a fullscreen forest scene, a large Wildpine title, a vertical menu, and compact chapter selectors. Arrow keys, Home, and End navigate the menu; unavailable Continue is skipped.
- **A tactile game HUD:** ten partial-fill health hearts, segmented survival gauges, a celestial day dial, compact field objectives, and a leather-framed pocket bar. The equipment window is now a centered satchel with icon/quantity slots rather than a web-style side drawer.
- **All 15 inventory icons now use AI-generated artwork.** The final five replacements are bandage, torch, stew, campfire kit, and shelter kit.
- **Five more generated assets** finish this ten-image batch: map, journal, crafting mallet, one reusable HUD frame, and one impact sparkle. The frame is nine-sliced; the effect bitmap is rendered directly, not reconstructed.
- **More world feedback:** contact sparks, campfire smoke and drifting embers, footstep dust/wet steps, ground rain splashes, cold breath and edge frost, warm held-torch lighting, and a subtle damage rim.
- Effects pause with the game and respect atmosphere/reduced-motion settings. No simulation rules, saves, or actor/wolf animation PNGs changed in this batch.

**10/10 generations used.** Further environment/prop and UI-icon work waits for “continue.” Whole-sheet single-prompt image generation is still unavailable; no claim is made that these assets were generated as a combined sheet. See **[ART_ROADMAP.md](ART_ROADMAP.md)** and **[the UI art notes](public/art/ui/README.md)**.

## The forager’s kit · v0.4 · art batch 2

- **Ten new standalone AI-generated assets:** wood, stone, fiber, berries, mushroom, water, pine nuts, berry tea, a forest-floor texture, and a backpack UI icon.
- **15 holdable items / 7 recipes.** Felling a pine now also yields one portion of **pine nuts** (+14 hunger). Brew **berry tea** with two berries and one water beside a burning fire; drinking restores 25 thirst and 24 warmth.
- The new art appears in the backpack, recipes, pockets, and held-item rendering. At the end of that batch the atlas had 10 generated icons and five originals; the campfire-interface batch above completes those replacements.
- A real generated terrain bitmap adds forest-floor texture, and the backpack glyph uses the generated image throughout the interface.
- Earlier v1/v2 saves keep their progress and receive empty new-item slots. Contact-frame consumption and cancellation still apply.

The user approved individual assets after the generator limitation was explained. **Character/wolf animation generation remains on hold:** no new rigged poses or synthetic character frames were created in the forager or campfire-interface batches, and the existing animation PNGs are unchanged. Complete AI-drawn animation sheets remain pending; current player movement is four-directional.

See **[ART_ROADMAP.md](ART_ROADMAP.md)** for provenance and remaining work. Each subsequent batch is capped at ten generations.

## The sunlit forest update · v0.3 · art batch 1

- **63 clips across 17 active animation sheets.** Axe/pickaxe actions now use six complete actor-and-tool **4 × 2 PNG sheets**, with no duplicate tool overlay. The wolf has new eight-frame run and idle sheets built from distinct generated gait poses.
- **Ten new image generations:** four survivor action poses, four wolf poses, an axe, and a pickaxe. Individual generated poses are packed into literal sheets and sliced row by row in the game.
- **A shared inventory atlas** drives both held items and HUD icons. The axe/pickaxe artwork was introduced in this earlier batch; the subsequent forager batch replaces six more icons and adds two new items.
- **Sun rays, canopy shadows, textured ground, drifting leaves, pond rings, and cold mist.** These are procedural effects, not extra image generations. Sun shafts fade with daylight and disappear in bad weather or at night.
- A persisted **Forest atmosphere** switch, reduced-motion support, and a wolf guide preview that plays both rows of its sheet.

The broader generated prop/UI-icon pass is still in progress; see the latest batch above.

### Equipment and the living forest

- **Every inventory item can be held.** Logs, rocks, plants, food, water, medicine, and building kits attach to a separate hand layer during idle, movement, and other non-weapon actions.
- **Distinct axe and pickaxe swings.** Three chops fell a pine; two pickaxe strikes break a boulder. Hits, drops, sounds, and gathering effects happen at the contact frame, not on button press.
- Swaying pines and berry bushes, falling trees, fractured rocks, harvested plants, flame cycles, running wolves, shelter cloth, wood chips, stone dust, leaf bursts, water drops, and construction/recovery effects.
- Six customizable pockets. Select an item in the backpack and pin it to a numbered slot; drag existing quickbar items to rearrange them. Selecting a pocket **does not consume** its contents.
- Empty hands, a held-item indicator, action progress, touch use controls, and backward-compatible save migration.
- Sheet-driven character, wolf, and campfire previews in the menus.

## The first chapter: The Forest

Start a new adventure, choose a name and difficulty, and survive **three nights**. A day lasts three real minutes; the first challenge takes about nine minutes. After your third sunrise, you can keep exploring.

- A hand-styled main menu, biome selection, adventure setup, survival guide, settings, and journey history.
- A seeded forest with collision, a winding trail, a campsite, and a freshwater spring.
- Gather wood, stone, fiber, berries, mushrooms, and pine nuts. Resources regrow over time.
- Track health, hunger, thirst, warmth, and sprint stamina.
- Craft pickaxes, campfires, shelters, torches, herbal bandages, forest stew, and warming berry tea. Place camp kits on clear ground.
- Survive nightfall, rain, thunderstorms, cold snaps, and roaming wolf packs. Fires and **held, burning torches** discourage wolves.
- A filtered backpack, crafting panel, live minimap, expanded map, discovery journal, pause menu, death/retry screen, and victory/continue screen.
- Explorer, Survivor, and Wild difficulties alter survival pressure and wolf-pack size.
- Procedural forest ambience, footsteps, chopping, mining, and interaction sounds using Web Audio. Sound begins only after a user gesture.
- Responsive layouts, touch controls, focus-trapped dialogs, keyboard shortcuts, and reduced-motion settings.

**Only The Forest is playable.** The Alpine and The Dunes are clearly marked future regions.

## Controls

| Key / input       | Action                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| WASD / arrow keys | Move in four directions; the last pressed direction wins                |
| Right-click       | Walk to a point in two straight legs; obstacles stop the route          |
| Shift + movement  | Sprint                                                                  |
| Left-click        | Attack or use the held item; hold to repeat equipped tool swings        |
| E                 | General interaction: gather, refill, use a Workbench, rest/feed at fire |
| 1–6               | Hold the assigned pocket item without consuming it                      |
| Space             | Defend with the held item; an axe/pickaxe hits harder than empty hands  |
| X                 | Stow the held item                                                      |
| B / I             | Backpack; hold any owned item and assign pockets                        |
| C                 | Handcraft (Workbench, torch, bandage)                                   |
| M                 | Map                                                                     |
| J                 | Field journal                                                           |
| H                 | Your condition and recovery advice                                      |
| Esc               | Pause / close a panel                                                   |

**F is unbound.** Hold E to repeat resource gathering, but not log feeding. Trees and boulders require the matching tool to be **manually equipped**.

Default pockets: **1 axe, 2 pickaxe, 3 berries, 4 water, 5 bandage, 6 torch**. A pocket may stay assigned after its item runs out. A lit torch remains holdable after its inventory item is consumed; it keeps burning while stowed, but only supplies warmth and protection while held.

Right-click the ground to walk toward it along one axis, then the other. Left-click/tap on the world never sets a movement target. Movement is not pathfinding: steer around trunks and the pond. Touch screens have a four-way directional pad with drag-to-steer, a center dead zone, and separate gather, use, and defense buttons.

### A good first day

1. Equip your axe with **1**, then left-click or hold **E** beside a pine to collect wood and pine nuts. Select **2** before mining boulders. Gather plants with **E**. Tools never switch themselves.
2. Keep spare wood for the campfire. Stand close and still to approach the bench and sit. Use the large hearth button (or E once resting) to add a log. Stay until contact; moving early cancels it without spending wood.
3. Make a **Workbench with 6 wood + 3 fiber** in **C / Handcraft**. Hold and place the kit on clear ground near camp. Press **E at that station** to craft equipment and camp kits, including a shelter for **10 wood + 6 fiber**.
4. Select **3**, then left-click to eat berries; select **4**, then left-click to drink. Refill bottles at the spring northeast of camp.
5. Use your **Workbench with a burning fire nearby** to brew **berry tea for 2 berries + 1 water**. Pine nuts make a small trail snack.
6. Stay in the firelight when wolves arrive. Move sideways during a snap/pounce warning, then swing your equipped axe at the recovering wolf. New Survivor wolves take four tool contacts to defeat; old saved wolves retain their original health.

## Saves and privacy

Adventures save every five seconds, on opening a panel, on leaving the page, and through **Save & return to main menu**. Opening a menu or leaving the game tab pauses the simulation **and its animation clock**. Completed runs are added to journey history.

Saves, preferences, and history live only in this browser's `localStorage`. They do not sync between devices, profiles, or origins; the development preview and GitHub Pages have separate storage. Invalid saves are rejected safely. Storage failures appear in the HUD instead of crashing the game.

The current format is **`wildpine.save.v2`**, including held equipment, facing direction, pocket assignments, and placed workbenches. Valid **v1** expeditions upgrade automatically, keeping progress and receiving a pickaxe. Earlier v2 inventories also upgrade safely with empty nuts/tea/Workbench slots and an empty station list; existing quantities and pocket assignments are preserved. Old diagonal facings also migrate to up/down now that movement is cardinal-only. The legacy copy is removed only after a successful v2 write. Pending actions are not serialized: reloading never replays a hit or spends an item whose use had not reached its contact frame.

## GitHub Pages

Workflow: **[`.github/workflows/pages.yml`](.github/workflows/pages.yml)**.

It installs locked dependencies, runs the unit tests, performs a strict production build, verifies repository-relative asset paths, uploads the Pages artifact, and deploys with GitHub's official Actions. Actions are pinned to release commit SHAs. Deployment uses the automatically supplied `GITHUB_TOKEN` and OIDC; **no custom secrets or personal tokens are needed**.

- Pushes to `main` build and deploy.
- Pushes to the working `arena/e14c7254-pixel-game` branch and pull requests targeting `main` run build checks, but do not deploy.
- Manual runs deploy only when the selected ref is `main`.
- The build sets `VITE_BASE_PATH=/${repository-name}/`, so Canvas sheets, inventory images, CSS art, fonts, and the favicon work below **`/Pixel-Game/`**.
- The intended site URL is **https://arthurowgg.github.io/Pixel-Game/**, after a successful deployment.

### First publication

The repository already has **Pages → Source → GitHub Actions** selected. Its existing `github-pages` environment permits **`main` only**. This safeguard is preserved; the connection used during development could not edit that deployment policy. **Merge this work into `main` to trigger the first deployment**, then check the **Test and deploy Wildpine** workflow in Actions. A configured workflow is not a claim that the site has already been published.

To test the exact Pages path locally:

```sh
npm run build:pages
npm run preview:pages -- --port 4173
```

Open `http://localhost:4173/Pixel-Game/`. With that preview running:

```sh
BASE_URL=http://localhost:4173/Pixel-Game/ npm run test:browser
```

A normal `npm run build` keeps the base at `/` for other static hosts. `dist/` is a generated output and is not checked into Git.

## Project structure

```text
.github/workflows/pages.yml   Test/build/deploy pipeline
src/
  App.tsx                    Menu / adventure routing and preferences
  components/                Title screen, dialogs, heart HUD, equipment, lifecycle
  game/
    simulation.ts            Survival simulation, equipment, timed impacts, quiet camp state
    wolves.ts                Staggered pack intent, steering, separation, runtime defeat feedback
    renderer.ts              Canvas world renderer and minimap
    animation.ts             Row-major slicing, frame playback, hand transforms
    atmosphere.ts            Sun shafts, canopy shadows, particles, textures
    feedback.ts              Contact sparks, smoke, trails, splashes, light
    hud.ts                   Safe heart-fill and day-dial presentation helpers
    vitals.ts                Meter states and recovery advice
    movement.ts              Cardinal input priority, substep collision, thumb input, safe gait
    loading.ts               Shared decoded-image cache, real progress, timeout/retry
    crafting.ts              Station identity/reach, hand recipes, safe batch limits
    camp.ts                  Solid bench and collision-checked cardinal seat routes
    inventory.ts             Owned/missing item search, categories and sorting
    item-atlas.json          Shared held-item / HUD atlas rectangles
    generated-assets.json    Generated icons, frames, textures, scenes, and props
    animation-manifest.json  Generated clip/anchor/frame metadata
    assets.ts                Base-aware public asset URLs
    data.ts                  Items, recipes, world constants, and balance
    types.ts                 Shared state and UI contracts
    storage.ts               Validated saves, v1 migration, settings, records
    audio.ts                 Procedural Web Audio ambience and effects
    *.test.ts                Gameplay, save, equipment, and sheet tests
  styles.css                 Base responsive visual system
  animations.css             Equipment UI and sheet-driven menu previews
  game-ui.css                Campfire interface baseline
  trail-ui.css               Distinct frames, readable vitals, compact HUD and new menus
  loading.css                Opening / world-entry loading scenes
  workshop.css               Framed, responsive camp workshop
  embers.css                 Dedicated pixel settings and live hearth interfaces
  roots.css                  Dynamic satchel and handcraft/workbench layouts
public/art/
  keyframes/                 Normalized image-generated key poses and props
  animations/                Seventeen active sheets + documented manifest
  item-sprites.png           Shared sixteen-item inventory / held atlas
  generated/forager-batch/    Normalized standalone AI item / UI / texture art
  generated/camp-ui/          Final item icons, HUD frame, navigation, sparkle
  generated/trail-ui/         Three frame families and seven status/menu glyphs
  generated/hearth-workshop/  Two loading scenes, table, frame, and two emblems
  generated/embers-instinct/  Settings/hearth frames and five interface glyphs
  generated/roots-reclaimed/  Workbench, two bench states, stump, ground, frames, linen
  loading/                   Full-screen generated arrival panoramas
  objects/                   Generated world props
  ui/                        Generated interface bitmaps
  textures/                  Generated terrain bitmaps
scripts/
  prepare_art.py             Original sprite keying, icons, static atlas
  build_animation_sheets.py  Original generated-keyframe rigging / packing
  build_polish_sheets.py     Earlier composite action / wolf sheets
  build_inventory_assets.py  Forager art and fifteen-item atlas
  build_camp_ui_assets.py     Camp-interface art stage
  build_trail_ui_assets.py    Trail frame / status icon stage
  build_hearth_assets.py     Loading / workshop stage
  build_embers_assets.py     Settings / hearth stage
  build_roots_assets.py      Latest standalone camp / satchel stage (run last)
  browser-test.mjs           Thirty-two gameplay / UI end-to-end scenarios
  workshop-browser-test.mjs  Thirteen loading / workshop / touch regression scenarios
  embers-browser-test.mjs    Sixteen settings / input / combat / campfire scenarios
  roots-browser-test.mjs     Eleven progression / satchel / sitting / touch scenarios
  browser-helpers.mjs        Shared headless Chromium launcher
  check-pages-build.mjs      Production subpath/asset validation
```

## Art and reproducibility

Five original AI-generated images established the style: the forest campsite background, pine, survivor, wolf, and campfire. Eight additional generations supplied empty-handed front/side/back/work poses, a wolf stride, an alternate flame, a boulder, and a berry bush, using the existing art as references. The first polish batch added ten more: four survivor action poses, four wolf gait poses, an axe, and a pickaxe. The forager batch adds ten standalone item, UI, and terrain images. The campfire-interface batch adds ten more: the remaining five item icons, three navigation glyphs, a UI frame, and an impact sprite. Trail & Camp adds three functional frame designs and seven status/menu glyphs. Hearth & Hand adds six standalone loading/workshop images. Ember & Instinct adds seven standalone settings/hearth images. Roots & Refuge adds eight standalone prop, camp-state, ground, frame, and linen images using nine calls; the existing Workbench glyph is reused as the sixteenth item icon. Trails & Twilight adds eight more: a camp clearing, fallen log, waystone, field-map frame, map paper, two chart icons, and a cursor.

Generated sources are keyed, palette-normalized, and resized with **nearest-neighbor** sampling. The **historical** animation builders combined key poses with pixel-rigged limbs, frame-specific hand anchors, foliage warping, and hand-coded effects. They remain for provenance only and must not run under the current no-new-rigging agreement. Complete axe/pickaxe poses are precomposited into individual 4 × 2 action sheets. Gameplay uses actual source rectangles from the packed sheets—not just bobbing static sprites. Left-facing poses mirror right-facing ones; all clips advance on simulation time, and reduced motion removes ambient cycling while preserving clear action poses.

See **[`public/art/animations/README.md`](public/art/animations/README.md)** for sheet dimensions and metadata. Processed keyframes and sheets are checked in, so CI and players need neither Python nor an image-generation service. All inventory icons, eighteen UI glyphs, eight active frame families, the Workbench, bench states, pine stump, camp clearing, fallen log, waystone, two loading scenes, impact sprite, forest-floor tile, satchel linen, field-chart frame and paper, chart pines and boulders, and the forest cursor now use generated art. Other UI glyphs, some world props/shelter details, atmospheric effects, and future-biome thumbnails still include hand-coded or procedural artwork; they are not presented as newly generated assets. Fonts are bundled through Fontsource; their original SIL Open Font License notices are included in [`public/licenses/`](public/licenses/).

To rebuild the current standalone assets from the supplied normalized inputs without touching animations:

```sh
python -m venv .venv
.venv/bin/python -m pip install Pillow
.venv/bin/python scripts/build_twilight_assets.py --normalized-only
npm run format
```

On Windows, use `.venv\Scripts\python` instead. The Trails & Twilight builder only prepares static assets; it never constructs animation frames. Omitting `--normalized-only` also processes local raw generation outputs when present in `.art-originals/trails-twilight/`. Rebuilding only from the supplied keyframes has been checked to reproduce the PNGs byte-for-byte.

For a full **static-only** rebuild, run `build_inventory_assets.py --normalized-only`, `build_camp_ui_assets.py --normalized-only`, `build_trail_ui_assets.py --normalized-only`, `build_hearth_assets.py --normalized-only`, `build_embers_assets.py --normalized-only`, `build_roots_assets.py --normalized-only`, and **`build_twilight_assets.py --normalized-only` last**. Older stages overwrite the registry. Historical animation builders remain for provenance, but must not be run under the current no-new-rigged-frames agreement. No animation builder was run for the forager, campfire-interface, Trail & Camp, Hearth & Hand, Ember & Instinct, Roots & Refuge, or Trails & Twilight batches. Raw generations, local GIF previews, screenshots, dependencies, and build outputs are intentionally excluded from Git.

## Checks

```sh
npm test               # 294 unit tests
npm run build          # Strict TypeScript + Vite production build
npm run build:pages    # Build /Pixel-Game/ and verify asset paths
npm run test:browser   # 72 browser scenarios; start the dev server first
npm audit
```

The unit suite covers deterministic worlds, survival balance, the complete three-night loop, contact-frame rewards, cancellation/range checks, equipment, pockets, crafting, construction, wolf defense, migration, malformed saves, PNG/clip bounds, row-major slicing, tool-sheet selection, atlas provenance, settings migration, weather-aware lighting, pine-nut rewards, tea crafting/consumption, old-v2 new-item migration, heart/dial calculations, effect lifetimes, immutable generated-source pixels, cardinal speed/collision/facing, chronological input priority, straight-leg click paths, old diagonal-save migration, blocked movement, clean gait selection, input ownership, outward tool carrying, and planted collection.

The browser suite checks desktop and mobile layouts, dialogs, navigation, real gathering/crafting/consumption, every holdable item, pocket pinning, actual axe/pickaxe frame changes, paused animations, two-row wolf previews, actual sun-shaft pixels and the atmosphere toggle, generated terrain/UI images, new food and tea, migration, weather, victory/retry, menu keyboard navigation, centered equipment UI, effects preferences, contact sparks, and portrait/landscape touch use, four-button touch controls, cardinal thumb dragging, click-to-move turns, migrated saved facing, fieldcraft search/recipes, condition details, the generated field chart with zoom, pan, legend, and mobile framing, six-chop pine and four-strike stone timing, a 1.8-second berry hold with a live progress ring, the night torch pool, and compact/full HUD preferences. It reports uncaught browser errors and failed asset requests, and writes screenshots to `.cache/screenshots/`. The same suite can run against the production Pages path.

The runner uses the Chromium dependency on Linux, or an existing Chrome installation through `CHROME_EXECUTABLE=/path/to/chrome`. It extracts the bundled NSS libraries when needed in small sandboxes.

The loading/workshop regressions additionally exercise delayed bundles and images, honest completion counts, corrupt/stalled requests, retry/cache reuse, cancellation, no simulation during entry, station reach, atomic batch costs, old-save table overlap, mobile workshop use, real thumb dragging, and decoded head-pixel consistency across the retained walking cells.

Ember & Instinct regressions exercise staggered pack attacks, dodging, separation, collision/overlap recovery, manual-tool requirements, forgiving aimed contact, runtime-only defeat feedback, one-log contact/cancellation, non-pausing camp focus, E reopening/dismissal, dangerous/critical camp states, preference migration, actual renderer flags and viewport coordinates, real Web Audio gains, settings keyboard/touch navigation, reset/fullscreen failures, and HUD/input restoration. Actor image hashes are checked separately against the previous release; no animation builder is run.

Roots & Refuge adds real gather→craft→place→interact progression, explicit station identity checks, additive save migration, occupancy/cap-safe placement, dynamic stock/search/sorting, real HTML drag/drop and keyboard/touch pinning, whole seated-state replacement, cardinal approach cancellation, leaf visibility/expiry, stronger wolf health, and locked pounce damage/dodging. Narrow-phone coverage includes **320 × 568**, alongside 390 × 844 and 844 × 390 landscape.

Trails & Twilight adds deterministic coverage for the daylight curve and darkness cap, torch and campfire light radii, 40-unit cell discovery and charted percentages, chart viewport clamping/zoom/pan and landmark pins, six-chop pine and four-strike stone health, timed berry holds with movement cancellation, trail-aware placement spacing, and pure render smoke checks with a stubbed canvas. Every animation sheet, manifest, and previously generated prop is re-verified against its pre-batch hash.
