import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode (Svelte 5). Can be removed in Svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Pure SPA: no server-side logic (no +*.server.ts / +server.ts). The Rust
		// backend embeds this and serves the fallback for every unmatched path, so
		// client-side routing + a hard refresh both work. Output to dist/ to match
		// the family convention (the backend's STATIC_DIR / Dockerfile expect it).
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			// Name the SPA fallback index.html (not 200.html): in pure-SPA mode
			// adapter-static emits ONLY the fallback, and the Rust backend serves
			// index.html for "/" and every unmatched path (rust-axum embed model).
			fallback: 'index.html',
			precompress: false,
			strict: true
		})
	}
};

export default config;
