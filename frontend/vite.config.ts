import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Browser-only app: all audio runs client-side, there is no backend to proxy.
export default defineConfig({
	plugins: [sveltekit()]
});
