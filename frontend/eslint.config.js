import svelte from 'eslint-config/svelte';

import svelteConfig from './svelte.config.js';

// Shared house preset (node base + eslint-plugin-svelte + TS parser wiring).
// Factory: it threads svelte.config.js into the parser for SvelteKit-aware
// rules. See coding-style:svelte / the eslint-config repo.
export default [...svelte(svelteConfig), { ignores: ['dist/', 'build/', '.svelte-kit/'] }];
