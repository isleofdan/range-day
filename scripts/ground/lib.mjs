// The logic of the ground-surface fetch (scripts/ground/fetch.mjs), kept
// apart from the network so test/ground-fetch.test.js can run it on saved
// answers: which surfaces are wanted, how a library's listing is read, how
// candidates are chosen and named, and what is recorded for each file.
// Runs on GitHub's runner (.github/workflows/ground.yml), never in the app.

// The six surfaces, from what the photographs of the canyon course show
// (docs/LOOK.md, "The canyon course" and "Through glass"). For each: Poly
// Haven's taxonomy categories (the slug paths of its /taxonomy/textures,
// read from github.com/Poly-Haven/Public-API, taxonomy.json), a search
// phrase for its /search ranking, and ambientCG search words.
export const SURFACES = [
  { id: 'floor', words: 'pale tan packed dirt with clods and crumbs', ph: { categories: ['ground-terrain/soil-mud/compacted-soil', 'ground-terrain/soil-mud/bare-dirt-soil', 'ground-terrain/rocky-ground/stony-dirt', 'ground-terrain/soil-mud/cracked-dry-mud-clay'], q: 'dry packed dirt ground' }, acg: ['Ground', 'Dirt'] },
  { id: 'dry-grass', words: 'dry straw grass on a slope', ph: { categories: ['ground-terrain/grass-vegetation/dry-sparse-grass', 'organic/thatch-reed/reed-straw'], q: 'dry grass' }, acg: ['Grass dry', 'Grass'] },
  { id: 'green-grass', words: 'short green grass on a slope', ph: { categories: ['ground-terrain/grass-vegetation/lush-green-grass', 'ground-terrain/grass-vegetation/dry-sparse-grass'], q: 'short green grass' }, acg: ['Grass'] },
  { id: 'scrub-litter', words: 'the litter and bare soil under grey-green sage scrub', ph: { categories: ['ground-terrain/forest-floor/leaf-litter', 'ground-terrain/forest-floor/forest-soil', 'ground-terrain/soil-mud/bare-dirt-soil'], q: 'dry leaf litter soil' }, acg: ['Ground leaves', 'Leaves ground'] },
  { id: 'rock', words: 'pale grey-tan eroded bare rock', ph: { categories: ['stone/rock-cliffs/rough-rock-faces', 'stone/rock-cliffs/stratified-layered-rock', 'ground-terrain/rocky-ground/rocky-landscape'], q: 'pale eroded rock' }, acg: ['Rock'] },
  { id: 'scree', words: 'loose scree or gravel', ph: { categories: ['ground-terrain/rocky-ground/scree', 'ground-terrain/gravel-pebbles/crushed-aggregate', 'ground-terrain/gravel-pebbles/sandy-gravel', 'ground-terrain/rocky-ground/rocky-paths-trails'], q: 'scree gravel' }, acg: ['Gravel', 'Rocks ground'] },
];

// How many candidates each library gives each surface (the brief asks at least three per surface in all).
export const PER_SURFACE = { polyhaven: 4, ambientcg: 2 };
// The maps wanted, in order: colour, the small-relief "normal" picture (OpenGL convention), roughness, and height.
export const MAPS = ['color', 'normal', 'rough', 'height'];
export const SIZE_WANTED = 2048;

export const LIBRARIES = {
  polyhaven: {
    name: 'Poly Haven',
    // the license page first; if the runner is refused there, the library's own API terms, which state the assets' license too
    licensePages: ['https://polyhaven.com/license', 'https://raw.githubusercontent.com/Poly-Haven/Public-API/master/ToS.md'],
    apiTermsPage: 'https://raw.githubusercontent.com/Poly-Haven/Public-API/master/ToS.md',
    api: 'https://api.polyhaven.com',
  },
  ambientcg: {
    name: 'ambientCG',
    licensePages: ['https://docs.ambientcg.com/license/', 'https://ambientcg.com/license', 'https://ambientcg.com/'],
    api: 'https://ambientcg.com/api/v2/full_json',
  },
};

// Plain text of an HTML page (scripts, styles and tags out, entities in, spaces folded).
export function pageText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h\d|li|section|br)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// The sentences of a license page that state CC0, in the page's own words; null if the page never says CC0.
export function cc0Sentences(text) {
  const parts = String(text).split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean);
  const hits = parts.filter((s) => /\bCC0\b|public domain/i.test(s));
  return hits.length && /\bCC0\b/.test(text) ? hits.slice(0, 6).join(' ') : null;
}

// Poly Haven: rank the assets of a surface's categories by the library's own search order, then by downloads.
// listing: { slug: asset } from /assets?type=textures&category=…; search: /search's answer (results: [{slug, score}]).
export function pickPolyHaven(listings, search, n) {
  const all = new Map();
  for (const listing of listings) for (const [slug, a] of Object.entries(listing || {})) if (a && a.type === 1) all.set(slug, a);
  const rank = new Map((search && Array.isArray(search.results) ? search.results : []).map((r, i) => [r.slug, i]));
  const ranked = [...all.entries()].sort(([sa, a], [sb, b]) => (rank.get(sa) ?? 1e6) - (rank.get(sb) ?? 1e6) || (b.download_count || 0) - (a.download_count || 0));
  // the search's best within the categories, then one drone capture (aerial: a far larger ground size, for the hillsides) if any is not already in
  const picked = ranked.slice(0, n);
  const aerial = ranked.find(([s, a]) => a.attributes && a.attributes.aerial && !picked.some(([p]) => p === s));
  if (aerial) picked.push(aerial);
  return picked.map(([slug, a]) => ({ library: 'polyhaven', id: slug, name: a.name || slug, page: `https://polyhaven.com/a/${slug}`, category: a.category || null, tags: a.tags || [], aerial: Boolean(a.attributes && a.attributes.aerial), groundMm: Array.isArray(a.dimensions) ? a.dimensions : null, searchRank: rank.has(slug) ? rank.get(slug) : null, downloads: a.download_count || 0 }));
}

// Poly Haven's file tree (/files/{id}): { <map>: { <res>: { <format>: {url, md5, size} } } }. The map keys are not
// listed in the API's description; these patterns cover the names its files carry (Diffuse/diff, nor_gl, Rough, Displacement).
const PH_MAP = { color: /^(diffuse|diff|col(or|our)?|albedo)$/i, normal: /^nor_gl$/i, rough: /^rough(ness)?$/i, height: /^(displacement|disp|height)$/i };
export function polyHavenFiles(tree, want = SIZE_WANTED) {
  const out = {};
  for (const map of MAPS) {
    const key = Object.keys(tree || {}).find((k) => PH_MAP[map].test(k));
    if (!key) continue;
    const res = Object.keys(tree[key] || {}).filter((r) => /^\d+k$/i.test(r)).sort((a, b) => Math.abs(parseInt(a, 10) * 1024 - want) - Math.abs(parseInt(b, 10) * 1024 - want) || parseInt(a, 10) - parseInt(b, 10));
    for (const r of res) {
      const f = tree[key][r];
      const fmt = ['jpg', 'png'].find((x) => f[x] && f[x].url);
      if (fmt) { out[map] = { url: f[fmt].url, md5: f[fmt].md5 || null, size: f[fmt].size || null, resolution: r, format: fmt, key }; break; }
    }
  }
  return out;
}

// ambientCG: its listing's shape is read generically, because this session could not read the library's own
// description: every object carrying an asset id, and in it any download address naming the 2K JPG zip.
export function ambientAssets(json) {
  const found = new Map();
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(visit); return; }
    const id = typeof o.assetId === 'string' ? o.assetId : null;
    if (id && !found.has(id)) {
      const urls = [];
      const grab = (x) => { if (typeof x === 'string') { if (/^https?:\/\//.test(x)) urls.push(x); } else if (x && typeof x === 'object') Object.values(x).forEach(grab); };
      grab(o);
      const zip = urls.find((u) => /2K-JPG/i.test(u) && /zip/i.test(u)) || urls.find((u) => /1K-JPG/i.test(u) && /zip/i.test(u)) || null;
      found.set(id, { id, name: o.displayName || o.title || id, tags: Array.isArray(o.tags) ? o.tags.map((t) => (typeof t === 'string' ? t : t && t.name)).filter(Boolean) : [], zip: zip || `https://ambientcg.com/get?file=${encodeURIComponent(id)}_2K-JPG.zip`, zipGuessed: !zip, dimensionX: o.dimensionX ?? null, dimensionY: o.dimensionY ?? null });
    }
    Object.values(o).forEach(visit);
  };
  visit(json);
  return [...found.values()];
}

// The maps inside an ambientCG zip, by the suffixes its files carry (…_Color.jpg, …_NormalGL.jpg, …_Roughness.jpg, …_Displacement.jpg).
const ACG_MAP = { color: /_(Color|Diffuse|Albedo)\.(jpe?g|png)$/i, normal: /_NormalGL\.(jpe?g|png)$/i, rough: /_Roughness\.(jpe?g|png)$/i, height: /_(Displacement|Height)\.(jpe?g|png)$/i };
export function ambientMaps(names) {
  const out = {};
  for (const map of MAPS) { const f = names.find((x) => ACG_MAP[map].test(x)); if (f) out[map] = f; }
  return out;
}

// A candidate's folder name on the scratch branch: library, surface, id, all lower case, safe.
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const candidateDir = (c, surface) => `${slug(surface)}--${slug(c.library)}--${slug(c.id)}`;
