// Discovery pass (the first version of this script): asks each of the two
// US government services what it holds at the two ranges and prints it, so
// the fetch that follows is written against the services' own answers
// rather than guesses. Writes nothing. Run by .github/workflows/terrain.yml.
import { RANGES, SERVICES, toUtm, get, getJson } from './lib.mjs';

for (const [name, s] of Object.entries(SERVICES)) {
  const info = await getJson(`${s.url}?f=json`);
  const keep = ['name', 'description', 'serviceDescription', 'pixelSizeX', 'pixelSizeY', 'maxImageHeight', 'maxImageWidth', 'pixelType', 'bandCount', 'spatialReference', 'extent', 'allowedMosaicMethods', 'defaultMosaicMethod', 'sortField', 'sortValue', 'capabilities', 'maxRecordCount', 'copyrightText', 'minScale', 'maxScale', 'hasRasterAttributeTable', 'allowRasterFunction', 'rasterFunctionInfos', 'supportsStatistics'];
  console.log(`\n=== ${name}: ${s.url}`);
  for (const k of keep) if (k in info) console.log(`  ${k}: ${JSON.stringify(info[k]).slice(0, 400)}`);
  console.log('  fields:', (info.fields || []).map((f) => `${f.name}(${f.type})`).join(', ').slice(0, 2000));
}

for (const r of RANGES) {
  const u = toUtm(r.lat, r.lon);
  console.log(`\n=== ${r.id}: lat ${r.lat} lon ${r.lon} -> UTM zone ${u.zone} E ${u.e.toFixed(1)} N ${u.n.toFixed(1)}`);
  const half = 60;
  const bbox = `${u.e - half},${u.n - half},${u.e + half},${u.n + half}`;
  for (const [name, s] of Object.entries(SERVICES)) {
    // What rasters cover this spot, with every field the catalog carries.
    const q = new URLSearchParams({ f: 'json', geometry: JSON.stringify({ xmin: u.e - half, ymin: u.n - half, xmax: u.e + half, ymax: u.n + half, spatialReference: { wkid: s.wkid } }), geometryType: 'esriGeometryEnvelope', inSR: String(s.wkid), spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false' });
    try {
      const cat = await getJson(`${s.url}/query?${q}`);
      console.log(`  ${name} catalog: ${(cat.features || []).length} item(s)`);
      for (const f of (cat.features || []).slice(0, 12)) console.log('   ', JSON.stringify(f.attributes).slice(0, 700));
      if (cat.error) console.log('   error', JSON.stringify(cat.error));
    } catch (e) { console.log(`  ${name} catalog query failed: ${e.message}`); }
    // A small export, to see the file the service really sends.
    const p = new URLSearchParams({ f: 'image', bbox, bboxSR: String(s.wkid), imageSR: String(s.wkid), size: '120,120', ...s.exportParams });
    try {
      const { bytes, headers } = await get(`${s.url}/exportImage?${p}`);
      console.log(`  ${name} exportImage: ${bytes.length} bytes, content-type ${headers.get('content-type')}, first bytes ${[...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
      if (bytes[0] === 0x49 && bytes[1] === 0x49 || bytes[0] === 0x4d && bytes[1] === 0x4d) console.log('   tiff tags:', JSON.stringify(tiffTags(bytes)));
      const j = new URLSearchParams({ ...Object.fromEntries(p), f: 'json' });
      const meta = await getJson(`${s.url}/exportImage?${j}`);
      console.log(`  ${name} exportImage f=json: ${JSON.stringify(meta).slice(0, 600)}`);
    } catch (e) { console.log(`  ${name} exportImage failed: ${e.message}`); }
  }
}

// The tags of a TIFF's first directory, by number: enough to see how it is laid out.
function tiffTags(b) {
  const le = b[0] === 0x49;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
  const magic = u16(2);
  if (magic !== 42) return { magic };
  const ifd = u32(4);
  const n = u16(ifd);
  const tags = {};
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    const tag = u16(o), type = u16(o + 2), count = u32(o + 4);
    const size = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 }[type] || 1;
    const at = count * size <= 4 ? o + 8 : u32(o + 8);
    const vals = [];
    for (let k = 0; k < Math.min(count, 4); k++) vals.push(type === 3 ? u16(at + k * 2) : type === 4 ? u32(at + k * 4) : type === 11 ? dv.getFloat32(at + k * 4, le) : type === 12 ? dv.getFloat64(at + k * 8, le) : b[at + k]);
    tags[tag] = { type, count, vals };
  }
  return tags;
}
