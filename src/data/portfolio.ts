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

export interface Place {
  id: string;
  /** City or spot, e.g. "Dallas". */
  name: string;
  country: string;
  lat: number;
  lng: number;
  /** When you were there, e.g. "Summer 2023" or "2022 – now". */
  when: string;
  /** What you did there, a sentence or two. */
  story: string;
  /** Image paths under /public, e.g. /world/places/tokyo-1.jpg. */
  photos: string[];
  /** Sample entry until the real one is filled in (shown with a "Sample" tag). */
  placeholder?: boolean;
}

// TODO(Aadhav): one entry per place you've been. Find lat/lng by right-clicking the spot in Google Maps.
// The sample entries borrow Life photos just to show how the gallery looks.
export const places: Place[] = [
  {
    id: 'dallas',
    name: 'Dallas',
    country: 'United States',
    lat: 32.9858,
    lng: -96.7501,
    when: 'Now',
    story: 'Studying computer science at UT Dallas. Replace this with what life there is like.',
    photos: [photos[0], photos[1], photos[2]],
    placeholder: true
  },
  {
    id: 'chennai',
    name: 'Chennai',
    country: 'India',
    lat: 13.0827,
    lng: 80.2707,
    when: 'When you were there',
    story: 'Sample entry: swap in your hometown or a trip home, and what you did.',
    photos: [photos[3], photos[4]],
    placeholder: true
  },
  {
    id: 'new-york',
    name: 'New York',
    country: 'United States',
    lat: 40.7128,
    lng: -74.006,
    when: 'When you were there',
    story: 'Sample entry: a trip, an internship, a hackathon. What happened there?',
    photos: [photos[5], photos[6], photos[7]],
    placeholder: true
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5072,
    lng: -0.1276,
    when: 'When you were there',
    story: 'Sample entry: maybe a matchday? Add the story and your photos.',
    photos: [photos[8], photos[9]],
    placeholder: true
  }
];

/**
 * A 360 photo of your room (equirectangular, 2:1, e.g. 4096 x 2048), saved under /public.
 * Leave null to show the drawn placeholder room.
 */
export const roomPanorama: string | null = null;

export interface RoomHotspot {
  /** Where it sits in the panorama: across (0 to 1, left to right) and up (-90 to 90 degrees). */
  u: number;
  pitch: number;
  title: string;
  note: string;
  href?: string;
}

// TODO(Aadhav): once the panorama is in, move these onto the real things in your room.
export const roomHotspots: RoomHotspot[] = [
  { u: 0.25, pitch: 12, title: 'Film wall', note: 'Posters of films I love. My full list is on Letterboxd.', href: favoriteLinks[1].href },
  { u: 0.5, pitch: 6, title: 'Window', note: 'Placeholder room. Swap in a 360 photo of the real one.' },
  { u: 0.68, pitch: -8, title: 'Record player', note: 'What is on repeat right now.', href: playlists[0].href },
  { u: 0.8, pitch: 14, title: 'Game shelf', note: 'The games I have played through. Trophies on PSN.', href: favoriteLinks[0].href },
  { u: 0.02, pitch: 18, title: 'Jersey', note: 'Your club and your number go here.' }
];
