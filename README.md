# Portfolio

The home page is a small 3D park at golden hour. You start on a soccer field and walk to:

- **Project fair**: a stall for each project, with its screenshot on a chalkboard and a link to the site
- **Arcade**: the giant laptop plays Snake and Brick breaker
- **Monitor**: my experience
- **Travels**: a globe where the countries I've been to glow; hover or click one (or use the arrows) to fly an arc there from Dallas and see its photos and story
- **Photo booth**: a camera that takes a polaroid of you in the park to download
- **My room**: a cutaway diorama of my real room (the number 7 jerseys, scarves, record player, desk and all) sitting out in the park on a little plinth; walk up to look in, or step onto it to spin it around and click things
- **PSP**: playlists, favorites and (soon) a little game
- **Shooting challenge** and **3-point shootout**: 60-second mini-games with best scores

Streams, a waterfall, a zen garden, a campsite and a lot of little details fill the gaps, and there's plenty to knock over: the AADHAV letters, a bowling lane, a domino run, crates that splinter if you hit them hard enough, a can pyramid, cones, bins, barrels and beach balls. Everything tidies itself back up once you've moved on. Signs float over every spot, a signpost at the start points the way, and **M** opens a map you can click to hop anywhere.

GitHub, LinkedIn, email and résumé links stay pinned on screen, and the regular site lives at `/classic`.

## Adding content

Everything lives in `src/data/portfolio.ts`:

- `projects`: one stall each
- `experience`: one monitor page each
- `trips`: the countries on the globe, each with a `country`, `when`, a short `story` and optional `spots` (cities shown as tags)
- `roomHotspots`: the labels you can click inside the room (the room itself is modelled in `src/components/world/stations/Room.tsx`)
- `favoriteLinks`, `playlists`: the PSP menus
- Drop a résumé at `public/resume.pdf`

### Travel photos

1. Put the photos in a folder named after the country: `travel-photos/Japan/`, `travel-photos/United Kingdom/` and so on. HEIC straight off an iPhone is fine. This folder is git-ignored, so the originals stay on your machine
2. Run `npm run travel-photos`. It turns them upright, shrinks them to 1600px WebP and strips the metadata (including GPS), then writes them to `src/assets/travels/<country>/`. Commit those
3. The country lights up on the globe straight away. Add a `trips` entry with the same country name to give it a story

Everyday names work (`USA`, `UK`, `England`, `UAE`, `Korea`, ...), and tiny countries like Singapore show up as a dot.

## Loading and performance

- The page shows a plain HTML loading screen instantly while the 3D code downloads
- Big libraries (three.js, physics) are split into their own cached files
- Phones, low-memory devices and software renderers start on a lighter setting (less grass, smaller shadows, lower resolution), and the frame rate is watched: if it drops, the resolution and then the scene step down automatically
- Static props are merged into a few meshes at load to keep draw calls down
- Photos only load when you open them, and the room's insides are only drawn when you're close

## Tech Stack

- **Astro** - Static site generator
- **Svelte** - UI framework
- **React Three Fiber + Rapier** - 3D world and physics
- **Three.js** - 3D graphics
- **GSAP** - Animations
- **Vercel** - Hosting
