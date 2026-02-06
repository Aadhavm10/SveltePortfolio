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
          manualChunks: {
            'three': ['three'],
            'gsap': ['gsap'],
            'react-three': ['@react-three/fiber', '@react-three/drei', '@react-three/rapier']
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
