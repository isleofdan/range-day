// The ground: a fan-shaped mesh from the firing position, finest along the
// first hundreds of yards, standing on the surveyed heights; coloured from
// the aerial photograph re-tinted to the season's measured palette; lit by
// the sun where the surveyed ground lets the sun reach; close-up detail
// made in code near the line. World frame: origin at the firing position's
// ground, x right of the line of fire, y up, z toward the shooter (so the
// plates stand at negative z), metres.
import * as THREE from 'three';
import { sunMask } from './heights.mjs';

const YD = 0.9144, FT = 0.3048;

// Map (UTM metres) <-> world, through the firing position and the bearing of fire.
export function frameOf(firing) {
  const b = (firing.bearingDeg * Math.PI) / 180, sb = Math.sin(b), cb = Math.cos(b);
  return {
    toWorld(e, n) { const de = e - firing.easting, dn = n - firing.northing; return { x: de * cb - dn * sb, z: -(de * sb + dn * cb) }; },
    toMap(x, z) { const f = -z; return { e: firing.easting + f * sb + x * cb, n: firing.northing + f * cb - x * sb }; },
    // a direction given as east/north/up components, in the world frame
    dir(east, north, up) { return new THREE.Vector3(east * cb - north * sb, up, -(east * sb + north * cb)); },
  };
}

const hex = (h) => new THREE.Color(h);

export function buildTerrain({ near, far, photo, photoUrl, frame, groundM, look, quality, sun, month, course }) {
  const M = look.mesh, T = look.things;
  const full = quality === 'full';
  const cols = full ? M.columnsFull : M.columnsLight, rows = full ? M.rowsFull : M.rowsLight;
  const half = (M.halfAngleDeg * Math.PI) / 180;
  const farHalf = (far.width * far.spacingM) / 2;
  const maxDist = farHalf * 0.98;
  // Rows: spacing grows with distance (1 m at the line, a few metres at the far plates, then coarser out to the far square's edge).
  const dists = [0];
  while (dists.length < rows && dists[dists.length - 1] < maxDist) {
    const d = dists[dists.length - 1];
    const s = Math.max(M.nearSpacingM, d < 1150 ? d / (full ? 150 : 75) : d / (full ? 60 : 30));
    dists.push(Math.min(maxDist, d + s));
  }
  const R = dists.length;
  // Columns: angle across the fan, finest near the line of fire.
  const angles = Array.from({ length: cols }, (_, j) => { const u = (j / (cols - 1)) * 2 - 1; return half * (0.75 * u * Math.abs(u) + 0.25 * u); });
  const heightAt = (e, n) => (near.inside(e, n) ? near.heightAt(e, n) : far.heightAt(e, n)) - groundM;
  const n = R * cols;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), farness = new Float32Array(n);
  const photoSide = photo.width * photo.spacingM;
  for (let i = 0; i < R; i++) for (let j = 0; j < cols; j++) {
    const d = dists[i], a = angles[j];
    const x = d * Math.sin(a), z = -d * Math.cos(a);
    const m = frame.toMap(x, z);
    const inside = near.inside(m.e, m.n);
    const y = heightAt(m.e, m.n);
    const k = i * cols + j;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    // the normal from the grid's own slopes, a spacing either side
    const sp = inside ? near.spacingM : far.spacingM;
    const dzdx = (heightAt(m.e + sp, m.n) - heightAt(m.e - sp, m.n)) / (2 * sp), dzdy = (heightAt(m.e, m.n + sp) - heightAt(m.e, m.n - sp)) / (2 * sp);
    // slopes along east and north; turn into the world frame (right, up, toward the shooter)
    const nm = frame.dir(-dzdx, -dzdy, 1).normalize();
    nor[k * 3] = nm.x; nor[k * 3 + 1] = nm.y; nor[k * 3 + 2] = nm.z;
    uv[k * 2] = (m.e - photo.originE) / photoSide; uv[k * 2 + 1] = 1 - (photo.originN - m.n) / photoSide;
    farness[k] = inside ? 0 : 1;
  }
  const idx = new Uint32Array((R - 1) * (cols - 1) * 6);
  let p = 0;
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, dd = c + 1;
    idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = b; idx[p++] = dd; idx[p++] = c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('farness', new THREE.BufferAttribute(farness, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));

  // The photograph as the ground's colour.
  const tex = new THREE.TextureLoader().load(photoUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = full ? 8 : 2;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  // Where the sun reaches, from the surveyed ground (near at 4 m, far at 20 m).
  const maskNear = sunMask(near, sun, 4), maskFar = sunMask(far, sun, 2);
  if (typeof window !== 'undefined' && window.RD_SCENE_DEBUG === 'nomask') { maskNear.data.fill(255); maskFar.data.fill(255); }
  const maskTex = (mk) => { const t = new THREE.DataTexture(mk.data, mk.width, mk.height, THREE.RedFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.LinearFilter; t.flipY = true; t.needsUpdate = true; return t; };
  const litNear = maskTex(maskNear), litFar = maskTex(maskFar);

  // The season's palette (the canyon course's, standing for both; the rifle line's own figures where it has them).
  const P = look.palette['cta-piru'];
  const green = look.greenByMonth[String(month)];
  const pal = (g, d) => hex(g).lerp(hex(d), 1 - green);
  const slope = pal(P.green.sunlitSlope, P.dry.sunlitSlope), scrub = pal(P.green.scrub, P.dry.scrub), floor = pal(P.green.floor, P.dry.floor);
  const rock = hex(P.green.rockSun);

  const detail = detailTexture();
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      litNear: { value: litNear }, litFar: { value: litFar },
      nearOrigin: { value: new THREE.Vector2(near.originE, near.originN) }, nearSide: { value: near.width * near.spacingM },
      farOrigin: { value: new THREE.Vector2(far.originE, far.originN) }, farSide: { value: far.width * far.spacingM },
      photoOrigin: { value: new THREE.Vector2(photo.originE, photo.originN) }, photoSide: { value: photoSide },
      slopeCol: { value: slope }, scrubCol: { value: scrub }, floorCol: { value: floor }, rockCol: { value: rock },
      detailMap: { value: detail }, detailTile: { value: M.detailTileM }, detailFade: { value: M.detailFadeYards * YD }, useDetail: { value: full ? 1 : 0 },
      mapOf: { value: new THREE.Vector4(frame.toMap(0, 0).e, frame.toMap(0, 0).n, Math.sin((course.firing.bearingDeg * Math.PI) / 180), Math.cos((course.firing.bearingDeg * Math.PI) / 180)) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float farness; varying float vFar; varying vec3 vWorld; varying vec2 vMap; uniform vec4 mapOf;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFar = farness; vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; float f = -vWorld.z; vMap = vec2(mapOf.x + f * mapOf.z + vWorld.x * mapOf.w, mapOf.y + f * mapOf.w - vWorld.x * mapOf.z);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFar; varying vec3 vWorld; varying vec2 vMap;
        uniform sampler2D litNear, litFar, detailMap; uniform vec2 nearOrigin, farOrigin, photoOrigin; uniform float nearSide, farSide, photoSide, detailTile, detailFade, useDetail;
        uniform vec3 slopeCol, scrubCol, floorCol, rockCol;
        float sunLit() {
          vec2 un = vec2((vMap.x - nearOrigin.x) / nearSide, 1.0 - (nearOrigin.y - vMap.y) / nearSide);
          vec2 uf = vec2((vMap.x - farOrigin.x) / farSide, 1.0 - (farOrigin.y - vMap.y) / farSide);
          bool inNear = un.x > 0.002 && un.x < 0.998 && un.y > 0.002 && un.y < 0.998;
          return inNear ? texture2D(litNear, un).r : texture2D(litFar, clamp(uf, 0.0, 1.0)).r;
        }`)
      .replace('#include <map_fragment>', `
        vec4 texel = texture2D(map, vMapUv);
        vec3 c = texel.rgb;
        float L = dot(c, vec3(0.299, 0.587, 0.114));
        float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
        float scrubW = smoothstep(0.11, 0.045, L);
        float chroma = sat / max(L, 0.02);
        float floorW = smoothstep(0.20, 0.33, L) * (1.0 - smoothstep(0.5, 0.9, chroma));
        float rockW = smoothstep(0.45, 0.70, L) * (1.0 - smoothstep(0.2, 0.4, chroma));
        vec3 base = mix(slopeCol, scrubCol, scrubW);
        base = mix(base, floorCol, floorW);
        base = mix(base, rockCol, rockW);
        // the pattern: the pixel's brightness against its class's own typical brightness in the photograph
        float refL = mix(mix(0.24, 0.085, scrubW), 0.42, floorW);
        float rel = clamp(L / refL, 0.45, 1.6);
        // the palette carries the season's colour; the photograph carries the ground's own pattern and half its own hue
        vec3 photoHue = c / max(L, 0.02) * dot(base, vec3(0.299, 0.587, 0.114));
        vec3 nearCol = mix(base, photoHue, 0.45) * rel;
        // beyond the photograph's square: the palette by the ground's own light, with the far grid's coarse shading
        vec3 farCol = mix(slopeCol, scrubCol, 0.35) * 0.95;
        vec3 ground = mix(nearCol, farCol, clamp(vFar, 0.0, 1.0));
        if (useDetail > 0.5) {
          float dist = length(vWorld.xz);
          float fade = 1.0 - smoothstep(detailFade * 0.3, detailFade, dist);
          vec3 det = texture2D(detailMap, vMap / detailTile).rgb;
          ground *= mix(vec3(1.0), det * 1.9, fade * 0.55);
        }
        diffuseColor.rgb *= ground;`)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= mix(0.12, 1.0, sunLit());'));
  };
  mat.customProgramCacheKey = () => 'range-day-terrain';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = full;
  mesh.frustumCulled = false;
  return { mesh, heightAt: (x, z) => { const m = frame.toMap(x, z); return heightAt(m.e, m.n); }, texture: tex, dists };
}

// Close-up surface detail, made in code: clods, crumbs and dry stems as a
// tileable noise picture (mean brightness about 0.53), repeated every few
// metres near the line and faded out by a few hundred yards.
function detailTexture(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#878787'; g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // crumbs and clods: soft discs, darker rims (drawn twice wrapped so the tile joins)
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * rnd() * 9, v = 0.3 + rnd() * 0.6;
    const shade = Math.round(90 + v * 110);
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const gr = g.createRadialGradient(x + ox - r * 0.3, y + oy - r * 0.3, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgb(${shade + 30},${shade + 30},${shade + 28})`); gr.addColorStop(0.8, `rgb(${shade},${shade},${shade - 4})`); gr.addColorStop(1, `rgba(${shade - 50},${shade - 50},${shade - 50},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill();
    }
  }
  // dry stems: thin pale strokes
  g.lineWidth = 1;
  for (let i = 0; i < 700; i++) {
    const x = rnd() * size, y = rnd() * size, len = 4 + rnd() * 14, a = rnd() * 6.3, v = Math.round(150 + rnd() * 70);
    g.strokeStyle = `rgba(${v},${v - 8},${v - 30},0.55)`;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

export { YD, FT };
