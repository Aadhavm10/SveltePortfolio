# Portfolio

The home page is a small 3D park at golden hour. You start on a soccer field and walk to:

- **Project fair**: a stall for each project, with its screenshot on a chalkboard and a link to the site
- **Arcade**: the giant laptop plays Snake and Brick breaker
- **Monitor**: my experience
- **Travels**: a globe with pins where I've been; each opens photos and a story
- **Photo booth**: a camera that takes a polaroid of you in the park to download
- **My room**: a cottage you can step into; inside is a cutaway diorama of my real room (the number 7 jerseys, scarves, record player, desk and all) that you can spin around
- **PSP**: playlists, favorites and (soon) a little game
- **Shooting challenge** and **3-point shootout**: 60-second mini-games with best scores

Streams, a waterfall, a zen garden, a campsite and a lot of little details fill the gaps. Signs float over every spot, a signpost at the start points the way, and **M** opens a map you can click to hop anywhere.

GitHub, LinkedIn, email and résumé links stay pinned on screen, and the regular site lives at `/classic`.

## Adding content

Everything lives in `src/data/portfolio.ts`:

- `projects`: one stall each
- `experience`: one monitor page each
- `places`: globe pins. Give each a name, country, `lat`/`lng` (right-click the spot in Google Maps to copy them), when, a short story, and photo paths. Put the photos in `public/world/places/`
- `roomHotspots`: the labels you can click inside the room (the room itself is modelled in `src/components/world/stations/Room.tsx`)
- `favoriteLinks`, `playlists`: the PSP menus
- Drop a résumé at `public/resume.pdf`

## Loading and performance

- The page shows a plain HTML loading screen instantly while the 3D code downloads
- Big libraries (three.js, physics) are split into their own cached files
- Phones, low-memory devices and software renderers start on a lighter setting (less grass, smaller shadows, lower resolution), and the frame rate is watched: if it drops, the resolution and then the scene step down automatically
- Static props are merged into a few meshes at load to keep draw calls down
- Photos only load when you open them, and the room is only drawn while you're inside it

## Tech Stack

- **Astro** - Static site generator
- **Svelte** - UI framework
- **React Three Fiber + Rapier** - 3D world and physics
- **Three.js** - 3D graphics
- **GSAP** - Animations
- **Vercel** - Hosting
