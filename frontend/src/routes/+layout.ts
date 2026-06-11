// Pure SPA: render entirely on the client. There is no server runtime in prod
// (the Rust binary just serves static files), so SSR and prerender are both off
// — every route is delivered via the adapter-static fallback (200.html) and
// hydrated client-side.
export const ssr = false;
export const prerender = false;
