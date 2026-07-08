import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` controls the public path assets are served from.
//  - Local dev / Vercel: '/' (default)
//  - GitHub Pages project site (https://<user>.github.io/gitarologia-songchecker/):
//    set VITE_BASE=/gitarologia-songchecker/  (the deploy workflow does this)
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()]
});
