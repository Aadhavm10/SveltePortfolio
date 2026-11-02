// @ts-check
import { defineConfig, envField } from 'astro/config';
import svelte from '@astrojs/svelte';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // Pages stay prerendered (static). Only /admin and /api/* opt into
  // on-demand rendering with `export const prerender = false`.
  output: 'static',
  adapter: vercel(),
  integrations: [svelte(), react()],
  env: {
    schema: {
      // Password for the private /admin photo uploader.
      ADMIN_PASSWORD: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Added automatically when a Vercel Blob store is connected to the project.
      BLOB_READ_WRITE_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
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
