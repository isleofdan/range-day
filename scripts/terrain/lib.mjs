// Shared by the terrain scripts: the two ranges' map positions, the two
// services, a lat/lon to UTM conversion and small fetch helpers. Runs on
// GitHub's runner (.github/workflows/terrain.yml), never in the app.

// Each range's public map position (Google Places, read 19 Nov 2026 by the chat that wrote the brief).
export const RANGES = [
  { id: 'cta-piru', name: 'canyon course', lat: 34.4395947, lon: -118.7355103 },
  { id: 'angeles-sylmar', name: 'rifle line', lat: 34.3072886, lon: -118.3632613 },
];

// US government public-domain survey data. wkid 26911 is NAD83 / UTM zone 11N, metres.
export const SERVICES = {
  heights: {
    url: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
    wkid: 26911,
    exportParams: { format: 'tiff', pixelType: 'F32', interpolation: 'RSP_BilinearInterpolation', noDataInterpretation: 'esriNoDataMatchAny' },
  },
  photo: {
    url: 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer',
    wkid: 26911,
    exportParams: { format: 'jpg', compressionQuality: '80', interpolation: 'RSP_BilinearInterpolation' },
  },
};

// Lat/lon (WGS84, the same as NAD83 to within a metre here) to UTM, by the
// standard series (Snyder, "Map Projections: A Working Manual", 1987, eq. 8-9
// to 8-15), good to a few millimetres.
export function toUtm(lat, lon, zone = Math.floor((lon + 180) / 6) + 1) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const φ = (lat * Math.PI) / 180, λ0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180, λ = (lon * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2), T = Math.tan(φ) ** 2, C = ep2 * Math.cos(φ) ** 2, A = (λ - λ0) * Math.cos(φ);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * φ - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * φ) + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * φ) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * φ));
  const e = 500000 + k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120);
  const n = k0 * (M + N * Math.tan(φ) * (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  return { e, n, zone };
}

export async function get(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${Buffer.from(bytes).toString('utf8').slice(0, 300)}`);
      const expected = Number(res.headers.get('content-length'));
      if (expected && bytes.length !== expected) throw new Error(`short answer: ${bytes.length} of ${expected} bytes`);
      if ((res.headers.get('content-type') || '').includes('json') && url.includes('f=image')) throw new Error(`the service answered JSON instead of an image: ${Buffer.from(bytes).toString('utf8').slice(0, 300)}`);
      return { bytes, headers: res.headers };
    } catch (e) { last = e; console.log(`  retry ${i + 1}: ${e.message}`); await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
  throw last;
}

export async function getJson(url) {
  const { bytes } = await get(url);
  const text = Buffer.from(bytes).toString('utf8');
  try { return JSON.parse(text); } catch { throw new Error(`not JSON from ${url.slice(0, 120)}: ${text.slice(0, 200)}`); }
}
