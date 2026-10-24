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
