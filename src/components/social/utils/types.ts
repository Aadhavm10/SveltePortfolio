export interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
}

export interface GitHubProfile {
  login: string;
  name: string;
  bio: string | null;
  avatar_url: string;
  followers: number;
  following: number;
  public_repos: number;
  html_url: string;
}

export interface GitHubData {
  repos: GitHubRepo[];
  profile: GitHubProfile;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  permalink: string;
  timestamp: string;
  thumbnail_url?: string;
}

export interface InstagramData {
  data: InstagramMedia[];
}

export interface LinkedInHighlight {
  type: 'cert' | 'post' | 'achievement';
  title: string;
  description?: string;
  date: string;
  url?: string;
}

export type PlatformData = GitHubData | InstagramData | LinkedInHighlight[];
