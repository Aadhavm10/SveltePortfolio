import { apiCache } from './cache';
import type { GitHubData, InstagramData, LinkedInHighlight, GitHubContributions } from './types';

const GITHUB_USERNAME = import.meta.env.PUBLIC_GITHUB_USERNAME || 'Aadhavm10';
const GITHUB_TOKEN = import.meta.env.PUBLIC_GITHUB_TOKEN;
const INSTAGRAM_TOKEN = import.meta.env.PUBLIC_INSTAGRAM_ACCESS_TOKEN;
const LINKEDIN_USERNAME = import.meta.env.PUBLIC_LINKEDIN_USERNAME || 'aadhav-';

// GitHub API
export async function fetchGitHubData(): Promise<GitHubData> {
  const cacheKey = 'github-data';

  // Check cache first
  const cached = apiCache.get<GitHubData>(cacheKey);
  if (cached) return cached;

  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const [reposRes, profileRes] = await Promise.all([
      fetch(
        `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=6`,
        { headers }
      ),
      fetch(
        `https://api.github.com/users/${GITHUB_USERNAME}`,
        { headers }
      )
    ]);

    if (!reposRes.ok || !profileRes.ok) {
      throw new Error('GitHub API request failed');
    }

    const [repos, profile] = await Promise.all([
      reposRes.json(),
      profileRes.json()
    ]);

    const data: GitHubData = { repos, profile };

    // Cache the result
    apiCache.set(cacheKey, data);

    return data;
  } catch (error) {
    console.error('GitHub API Error:', error);
    throw new Error('Failed to fetch GitHub data');
  }
}

// Instagram API
export async function fetchInstagramData(): Promise<InstagramData> {
  const cacheKey = 'instagram-data';

  const cached = apiCache.get<InstagramData>(cacheKey);
  if (cached) return cached;

  if (!INSTAGRAM_TOKEN) {
    throw new Error('Instagram access token not configured');
  }

  try {
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,timestamp,thumbnail_url&limit=9&access_token=${INSTAGRAM_TOKEN}`
    );

    if (!response.ok) {
      throw new Error('Instagram API request failed');
    }

    const data: InstagramData = await response.json();

    apiCache.set(cacheKey, data);

    return data;
  } catch (error) {
    console.error('Instagram API Error:', error);
    throw new Error('Failed to fetch Instagram data');
  }
}

// LinkedIn - Manual highlights
export function getLinkedInHighlights(): LinkedInHighlight[] {
  // These are manually curated - update as needed
  return [
    {
      type: 'cert',
      title: 'Neo4j Certified Professional',
      description: 'Graph Database Certification',
      date: 'May 2025',
      url: 'https://www.linkedin.com/in/' + LINKEDIN_USERNAME
    },
    {
      type: 'achievement',
      title: 'Computer Science Student',
      description: 'University of Texas at Dallas',
      date: 'Current',
      url: 'https://www.linkedin.com/in/' + LINKEDIN_USERNAME
    },
    {
      type: 'post',
      title: 'Building Modern Web Applications',
      description: 'Exploring Astro, Svelte, and Three.js',
      date: 'Dec 2025',
      url: 'https://www.linkedin.com/in/' + LINKEDIN_USERNAME
    }
  ];
}

// GitHub Contributions API
export async function fetchGitHubContributions(): Promise<GitHubContributions> {
  const cacheKey = 'github-contributions';

  // Check cache first
  const cached = apiCache.get<GitHubContributions>(cacheKey);
  if (cached) return cached;

  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables: { username: GITHUB_USERNAME }
      })
    });

    if (!response.ok) {
      throw new Error('GitHub GraphQL request failed');
    }

    const result = await response.json();
    const data = result.data.user.contributionsCollection.contributionCalendar;

    // Cache the result
    apiCache.set(cacheKey, data);

    return data;
  } catch (error) {
    console.error('GitHub Contributions Error:', error);
    throw new Error('Failed to fetch GitHub contributions');
  }
}
