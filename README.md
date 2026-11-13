# Mauryan World

A procedural three.js recreation of a Mauryan-era Indian city: a palisaded river capital, a pillared palace hall, a stupa hill with an Ashoka pillar, and a walled market town. All textures, models and materials are generated in code. There are no external assets.

## Layout
- `src/textures.js`: procedural canvas textures (brick, timber, thatch, tiles, stone, marble, cloth, leaves, inscriptions, chakra banners, water normals)
- `src/materials.js`: material library (world-space UVs for instanced architecture)
- `src/assets.js`: procedural models (people, elephants, oxen, carts, trees, pillars, stupa, watchtowers, gatehouse, houses, stalls, boats)
- `src/env.js`: terrain height field and ground shader, water, sky and clouds, post-processing
- `src/world.js`: world layout and instancing (city, palace hall, stupa hill, market town)
- `src/shots.js`: camera and lighting presets matching each reference image
- `refs/`: reference images
- `renders/`: approval stills and comparisons

## Run
```
npm install
node server.js            # serves on http://localhost:8123
node render.js 1,2,3,4 1448 1086   # headless stills -> renders/shotN.png (needs playwright)
```
Open `http://localhost:8123/index.html`, then call `renderShot(n)` in the console to view shot n.
