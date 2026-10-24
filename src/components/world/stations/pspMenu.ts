import { favoriteLinks, playlists } from '../../../data/portfolio';

export interface PspItem {
  title: string;
  subtitle: string;
  href?: string;
  placeholder?: boolean;
}

export interface PspColumn {
  id: 'music' | 'favorites' | 'game';
  label: string;
  items: PspItem[];
}

/** PlayStation-style cross menu: categories left/right, items up/down. */
export const PSP_MENU: PspColumn[] = [
  {
    id: 'music',
    label: 'Music',
    items: playlists.map((p) => ({ title: p.title, subtitle: p.description, href: p.href }))
  },
  {
    id: 'favorites',
    label: 'Favorites',
    items: favoriteLinks.map((f) => ({ title: f.label, subtitle: f.description, href: f.href, placeholder: f.placeholder }))
  },
  {
    id: 'game',
    label: 'Game',
    items: [{ title: 'Coming soon', subtitle: 'A little handheld game is on the way', placeholder: true }]
  }
];
