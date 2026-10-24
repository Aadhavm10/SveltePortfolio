import { contactLinks, projects, type ContactLink, type Project } from '../../data/portfolio';

export type ZoneKind = 'project' | 'about' | 'life' | 'classic' | 'contact';

export interface Zone {
  id: string;
  kind: ZoneKind;
  label: string;
  /** Pad centre on the ground (contact zones sit at their goal instead). */
  x: number;
  z: number;
  radius: number;
  color: string;
  project?: Project;
  contact?: ContactLink;
}

export const PALETTE = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8b94', '#b8a9ff'];

// World layout (metres). The camera looks from +z, so "north" is -z.
export const SPAWN = { x: 0, z: 2 };
export const BOUNDS = { minX: -44, maxX: 68, minZ: -50, maxZ: 22 };

export const PROJECT_ROW = { startX: 18, spacing: 8.5, z: -9 };
export const PITCH = { minX: -18, maxX: 18, goalLineZ: -44, frontZ: -21 };
export const GOAL_XS = [-11, 0, 11];
export const ABOUT_AREA = { x: -20, z: -9 };
export const LIFE_AREA = { x: -34, z: -9 };
export const CLASSIC_GATE = { x: 0, z: 15 };

export const projectZones: Zone[] = projects.map((project, i) => ({
  id: `project-${i}`,
  kind: 'project',
  label: project.title,
  x: PROJECT_ROW.startX + i * PROJECT_ROW.spacing,
  z: PROJECT_ROW.z + 4.6,
  radius: 2,
  color: PALETTE[i % PALETTE.length],
  project
}));

export const aboutZone: Zone = {
  id: 'about',
  kind: 'about',
  label: 'About me',
  x: ABOUT_AREA.x,
  z: ABOUT_AREA.z + 4.8,
  radius: 2.2,
  color: '#4ecdc4'
};

export const lifeZone: Zone = {
  id: 'life',
  kind: 'life',
  label: 'Life in photos',
  x: LIFE_AREA.x,
  z: LIFE_AREA.z + 4.8,
  radius: 2.2,
  color: '#a8e6cf'
};

export const classicZone: Zone = {
  id: 'classic',
  kind: 'classic',
  label: 'Classic site',
  x: CLASSIC_GATE.x,
  z: CLASSIC_GATE.z,
  radius: 2.4,
  color: '#ffffff'
};

const GOAL_COLORS = ['#4ecdc4', '#ffe66d', '#ff8b94'];

export const contactZones: Zone[] = contactLinks.map((contact, i) => ({
  id: `contact-${contact.id}`,
  kind: 'contact',
  label: contact.label,
  x: GOAL_XS[i],
  z: PITCH.goalLineZ,
  radius: 0,
  color: GOAL_COLORS[i],
  contact
}));

/** Zones the player can walk onto and open with E. */
export const walkZones: Zone[] = [...projectZones, aboutZone, lifeZone, classicZone];

export const lifePhotos = [
  '/world/life-1.jpg',
  '/world/life-2.jpg',
  '/world/life-3.jpg',
  '/world/life-4.jpg',
  '/world/life-5.jpg',
  '/world/life-6.jpg'
];
