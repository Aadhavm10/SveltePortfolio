/// <reference types="vite/client" />
export interface Project {
  src: string;
  title: string;
  description: string;
  projectUrl: string;
}

export interface ContactLink {
  id: 'github' | 'linkedin' | 'email';
  label: string;
  href: string;
  handle: string;
}

export const projects: Project[] = [
  {
    src: "/projectpics/HackMatch.png",
    title: "HackMatch",
    description: "AI-powered hackathon brainstorming platform using the RAPID framework to guide teams from idea chaos to a clear MVP in 30 minutes using Cloudflare Workers AI.",
    projectUrl: "https://main.hackmatch.pages.dev"
  },
  {
    src: "/projectpics/ScribbleAi.png",
    title: "ScribbleAi",
    description: "AI-powered notes application with intelligent summarization, task extraction, and text rephrasing capabilities for enhanced productivity.",
    projectUrl: "https://scribbly-ai.vercel.app/"
  },
  {
    src: "/projectpics/flowstate.png",
    title: "FlowState",
    description: "Immersive 3D music inspired powered by Every Noise at Once, creating dynamic audiovisual experiences that respond to music in real-time.",
    projectUrl: "https://flowstate-music.vercel.app/"
  },
  {
    src: "/projectpics/Foodie.png",
    title: "Foodie",
    description: "Group dining solution that finds restaurants accommodating everyone's dietary restrictions, preferences, and budget constraints.",
    projectUrl: "https://foodiemaps.vercel.app/landing"
  },
  {
    src: "/projectpics/gpu-optimizer.png",
    title: "GPU Optimizer",
    description: "Real-time GPU monitoring and optimization toolkit with CUDA performance enhancements achieving up to 12x speedup improvements.",
    projectUrl: "https://github.com/Aadhavm10/GPU_Optimzer"
  },
  {
    src: "/projectpics/FantasyPremierLeague.png",
    title: "PremScout",
    description: "Fantasy Premier League Points Predictor using machine learning algorithms to analyze player performance and predict fantasy points.",
    projectUrl: "https://prem-scout.vercel.app/"
  }
];

export const contactLinks: ContactLink[] = [
  { id: 'github', label: 'GitHub', href: 'https://github.com/Aadhavm10', handle: '@Aadhavm10' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/aadhav-/', handle: 'in/aadhav-' },
  { id: 'email', label: 'Email', href: 'mailto:aadhavmanimurugan@gmail.com', handle: 'aadhavmanimurugan@gmail.com' }
];

export interface Experience {
  role: string;
  org: string;
  period: string;
  points: string[];
  /** Placeholder copy until the real details are filled in. */
  placeholder?: boolean;
}

// TODO(Aadhav): replace with the real organisations, dates and highlights.
export const experience: Experience[] = [
  {
    role: 'Machine Learning Researcher',
    org: 'Research lab name',
    period: 'Start – End',
    points: ['What the research was about', 'Models, tools and methods used', 'A result you are proud of'],
    placeholder: true
  },
  {
    role: 'Software Engineering Intern',
    org: 'Company name',
    period: 'Start – End',
    points: ['What you built', 'Stack and tools', 'Impact or a number that shows it'],
    placeholder: true
  }
];

export interface Playlist {
  title: string;
  description: string;
  href: string;
}

export const playlists: Playlist[] = [
  { title: 'pretty girls make me nervous', description: 'My everything playlist', href: 'https://music.apple.com/us/playlist/pretty-girls-make-me-nervous/pl.u-GgA5kZ6Co7mDM3q' },
  { title: '3dun', description: 'Tamil and Hindi songs', href: 'https://music.apple.com/us/playlist/3dun/pl.u-oZyl3PYIGbKoVxE' },
  { title: 'gong na', description: 'Hip-hop upbeat playlist', href: 'https://music.apple.com/us/playlist/gong-na/pl.u-NpXmza3s4Y9NzeM' },
  { title: 'playlist laced with agony and despair', description: 'Name says it all', href: 'https://music.apple.com/us/playlist/playlist-laced-with-agony-and-despair/pl.u-8aAVZybtvlYWk3R' }
];

export interface FavoriteLink {
  id: string;
  label: string;
  description: string;
  href: string;
  placeholder?: boolean;
}

// TODO(Aadhav): point these at your own profiles.
export const favoriteLinks: FavoriteLink[] = [
  { id: 'playstation', label: 'PlayStation', description: 'The games I play and the trophies I chase', href: 'https://psnprofiles.com/', placeholder: true },
  { id: 'films', label: 'Films', description: 'Everything I have watched and rated', href: 'https://letterboxd.com/', placeholder: true },
  { id: 'beli', label: 'Beli', description: 'Where I eat and how I rank it', href: 'https://beliapp.com/', placeholder: true }
];

/** Drop the PDF into public/resume.pdf. */
export const resumeUrl = '/resume.pdf';

/** The Life photos, resized for the world. */
export const photos: string[] = Array.from({ length: 36 }, (_, i) => `/world/photos/${String(i + 1).padStart(2, '0')}.jpg`);

export interface Trip {
  /** The country, in plain English: "India", "Japan", "United States", "UK"... */
  country: string;
  /** When you went, e.g. "Summer 2023" or "Every December". */
  when: string;
  /** What you did there, a sentence or two. */
  story: string;
  /** Cities or spots, shown as little tags. */
  spots?: string[];
  /** Sample entry until the real one is filled in (shown with a "Sample" tag). */
  placeholder?: boolean;
}

// TODO(Aadhav): one entry per country. Photos don't go here: see travelPhotos below.
export const trips: Trip[] = [
  {
    country: 'United States',
    when: 'Home now',
    story: 'Studying computer science at UT Dallas. Rewrite this in your own words.',
    spots: ['Dallas'],
    placeholder: true
  },
  {
    country: 'India',
    when: 'Where it all started',
    story: 'Sample entry: where home is and what a trip back looks like.',
    placeholder: true
  }
];

/**
 * Photos for each country, found automatically: every image in src/assets/travels/<country>/ shows
 * up on the globe for that country (in file-name order). A folder for a country that isn't in
 * `trips` still lights it up. The easy way to add them: drop photos (iPhone HEIC is fine) into
 * travel-photos/<Country>/ and run `npm run travel-photos`, which resizes them and strips location data.
 */
const travelPhotoFiles = import.meta.glob('../assets/travels/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export const travelPhotos: Record<string, string[]> = {};
for (const path of Object.keys(travelPhotoFiles).sort()) {
  const folder = path.split('/').slice(-2)[0];
  (travelPhotos[folder] ??= []).push(travelPhotoFiles[path]);
}

export interface RoomHotspot {
  /** Which thing in the room it labels (see stations/Room.tsx for where each one sits). */
  id: 'jerseys' | 'desk' | 'records' | 'scarves' | 'guitar' | 'starwars' | 'flag' | 'tv' | 'skyline';
  title: string;
  note: string;
  href?: string;
}

// Labels inside the room. Rewrite the notes in your own words.
export const roomHotspots: RoomHotspot[] = [
  { id: 'jerseys', title: 'The number 7 wall', note: 'Ribéry, Ronaldo and Di María. All number 7.' },
  { id: 'desk', title: 'Desk', note: 'Where most of my projects get built.', href: '/projects' },
  { id: 'records', title: 'Record player', note: 'Something is always spinning. My playlists live on the PSP.', href: playlists[0].href },
  { id: 'scarves', title: 'Scarves', note: 'Man Utd, and one from the France v España semi-final in Dallas, 2026.' },
  { id: 'guitar', title: 'Guitar', note: 'My acoustic.' },
  { id: 'starwars', title: 'Star Wars wall', note: 'Vader and C-3PO, with my medals underneath.' },
  { id: 'flag', title: 'Welcome to my crib', note: 'The first thing you see when you walk in.' },
  { id: 'tv', title: 'TV', note: 'Games and matches. Trophies are on PSN.', href: favoriteLinks[0].href },
  { id: 'skyline', title: 'New York', note: 'A black and white New York skyline over the mirror.' }
];
