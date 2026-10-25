// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte(), react()],
  vite: {
    assetsInclude: ['**/*.glb'],
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          // Big, rarely-changing libraries get their own files so they cache across deploys
          // and download in parallel with the app code.
          manualChunks(id) {
            if (id.includes('node_modules/@dimforge/')) return 'physics';
            if (id.includes('node_modules/three/')) return 'three';
            if (id.includes('node_modules/gsap/')) return 'gsap';
            if (/node_modules\/(@react-three|three-stdlib|troika|@monogrid|camera-controls|maath|meshline|stats-gl|suspend-react|its-fine|zustand)/.test(id)) return 'react-three';
          }
        }
      }
    },
    ssr: {
      noExternal: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier']
    }
  },
  build: {
    inlineStylesheets: 'auto'
  }
});
