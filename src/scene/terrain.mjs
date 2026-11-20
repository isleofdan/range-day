// The ground: a fan-shaped mesh from the firing position, finest along the
// first hundreds of yards, standing on the surveyed heights; coloured from
// the aerial photograph re-tinted to the season's measured palette; lit
// pixel by pixel from the survey's own slopes (a normal map built from the
// 1 m heights inside the square and the 10 m heights beyond), shaded where
// the sun's ray does not clear the ground, darkened in creases; sorted
// per pixel into packed dirt, grass, scrub, bare rock and loose scree by
// the slope's steepness and the photograph's colour; and given each
// class's surface from a photographed material scan (range-day-eight:
// dirt, dry and green grass, the litter under scrub, rock and scree, CC0
// scans listed in data/terrain.json, surfaces), fixed to the ground, so a
// hillside through a strong glass shows clods, stones and blades instead
// of a stretched photograph. World frame: origin at the firing position's ground, x right
// of the line of fire, y up, z toward the shooter (so the plates stand at
// negative z), metres.
import * as THREE from 'three';
import { sunMask, normalMap } from './heights.mjs';
import { materialSlots } from './surfaces.mjs';

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
  const M = look.mesh, G = look.ground;
  const full = quality === 'full';
  const cols = full ? M.columnsFull : M.columnsLight, rows = full ? M.rowsFull : M.rowsLight;
  const half = (M.halfAngleDeg * Math.PI) / 180;
  const farHalf = (far.width * far.spacingM) / 2;
  const maxDist = farHalf * 0.98;
  // Rows: spacing grows with distance (1 m at the line, a few metres at the far plates, then coarser out to the far square's edge). The rows always reach the far square's edge: the count in the data is the fineness, not a limit (on Light the old limit stopped the ground short of the 1,000-yard plate).
  const dists = [0];
  while (dists[dists.length - 1] < maxDist) {
    const d = dists[dists.length - 1];
    const fine = dists.length < rows ? 1 : 2;
    const s = Math.max(M.nearSpacingM, (d < 1150 ? d / (full ? 150 : 75) : d / (full ? 60 : 30)) * fine);
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
    // the normal from the grid's own slopes, a spacing either side (the shader lights from the survey's finer normal map; this one is the mesh's)
    const sp = inside ? near.spacingM : far.spacingM;
    const dzdx = (heightAt(m.e + sp, m.n) - heightAt(m.e - sp, m.n)) / (2 * sp), dzdy = (heightAt(m.e, m.n + sp) - heightAt(m.e, m.n - sp)) / (2 * sp);
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

  // The survey's slopes as a picture: a normal and a hollowness per cell (every 1 m inside the square on Full, 2 m on Light; 10 m beyond).
  const nmNear = normalMap(near, full ? 1 : 2, full ? 4 : 2, G.hollowM), nmFar = normalMap(far, 1, 2, G.hollowM * 4);
  const rgbaTex = (mk) => { const t = new THREE.DataTexture(mk.data, mk.width, mk.height, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = full ? 4 : 1; t.flipY = true; t.needsUpdate = true; return t; };
  const normNear = rgbaTex(nmNear), normFar = rgbaTex(nmFar);

  // How far the sun's ray clears the ground (near every 3 m on Full, 4 m on Light; far every 20 m).
  const maskNear = sunMask(near, sun, full ? 3 : 4, G.clearanceM), maskFar = sunMask(far, sun, 2, G.clearanceM * 4);
  if (typeof window !== 'undefined' && window.RD_SCENE_DEBUG === 'nomask') { maskNear.data.fill(255); maskFar.data.fill(255); }
  const maskTex = (mk) => { const t = new THREE.DataTexture(mk.data, mk.width, mk.height, THREE.RedFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.LinearFilter; t.flipY = true; t.needsUpdate = true; return t; };
  const litNear = maskTex(maskNear), litFar = maskTex(maskFar);

  // The season's palette (the canyon course's, standing for both; the rifle line's own figures where it has them).
  const P = look.palette['cta-piru'];
  const green = look.greenByMonth[String(month)];
  const pal = (g, d) => hex(g).lerp(hex(d), 1 - green);
  const slope = pal(P.green.sunlitSlope, P.dry.sunlitSlope), scrub = pal(P.green.scrub, P.dry.scrub), floor = pal(P.green.floor, P.dry.floor);
  const rock = hex(P.green.rockSun), scree = hex(P.green.rockSun).lerp(hex(P.dry.floor), 0.45), weeds = pal(P.green.weeds, P.dry.sunlitSlope);

  // The photographed materials, one layer per surface (surfaces.mjs). Until they arrive (or for one that fails) a layer is
  // neutral: mid grey with its own mean equal to it, flat, at mid height, so that class is drawn with its plain palette colour.
  const mats = materialSlots(full, look);
  const sunMap = new THREE.Vector2(Math.sin((sun.azimuth * Math.PI) / 180), Math.cos((sun.azimuth * Math.PI) / 180));
  const b = (course.firing.bearingDeg * Math.PI) / 180;
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
  const shaderRef = { uniforms: null };
  mat.onBeforeCompile = (shader) => {
    shaderRef.uniforms = shader.uniforms;
    Object.assign(shader.uniforms, {
      litNear: { value: litNear }, litFar: { value: litFar }, normNear: { value: normNear }, normFar: { value: normFar },
      nearOrigin: { value: new THREE.Vector2(near.originE - frame.toMap(0, 0).e, near.originN - frame.toMap(0, 0).n) }, nearSide: { value: near.width * near.spacingM },
      farOrigin: { value: new THREE.Vector2(far.originE - frame.toMap(0, 0).e, far.originN - frame.toMap(0, 0).n) }, farSide: { value: far.width * far.spacingM },
      photoOrigin: { value: new THREE.Vector2(photo.originE, photo.originN) }, photoSide: { value: photoSide },
      slopeCol: { value: slope }, scrubCol: { value: scrub }, floorCol: { value: floor }, rockCol: { value: rock }, screeCol: { value: scree }, weedCol: { value: weeds },
      matCol: mats.color, matRel: mats.relief, matMean: mats.mean, matSize: mats.sizeM, photoPx: { value: photo.width }, photoLodMin: { value: Math.log2(G.photoFinestPx) }, sunMapDir: { value: sunMap },
      reliefShadowM: { value: G.reliefShadowM * Math.min(3, 1 / Math.max(0.2, Math.tan((sun.elevation * Math.PI) / 180))) }, reliefShadowDark: { value: full ? G.reliefShadowDark : 0 }, reliefShadowDepth: { value: G.reliefShadowDepth },
      hexTiles: { value: G.hexTiles }, hexSharpness: { value: G.hexSharpness }, heightBlend: { value: G.heightBlend }, varyM: { value: G.varyM }, plainGrid: { value: typeof window !== 'undefined' && window.RD_SCENE_DEBUG === 'plaingrid' ? 1 : 0 }, matShift: { value: new THREE.Vector2(0, 0) }, matShiftBig: { value: new THREE.Vector2(0, 0) }, matCount: { value: full ? 2 : 1 }, matPx: mats.px, fineFade: { value: full ? new THREE.Vector2(32, 8) : new THREE.Vector2(G.lightFineFade[0], G.lightFineFade[1]) },
      sunCutA: { value: new THREE.Vector3(G.sunCut.floor, G.sunCut['dry-grass'], G.sunCut['green-grass']) }, sunCutB: { value: new THREE.Vector3(G.sunCut['scrub-litter'], G.sunCut.rock, G.sunCut.scree) }, macroScale: { value: G.macroScale }, macroShare: { value: full ? G.macroShare : G.macroShareLight },
      matAlbedo: { value: G.materialAlbedo }, bumpFloor: { value: G.bump.floor }, bumpGrass: { value: G.bump.grass }, bumpRock: { value: G.bump.rock },
      steepTan: { value: Math.tan((G.steepDeg * Math.PI) / 180) }, hollowM: { value: G.hollowM }, hollowDark: { value: G.hollowDarkening }, clearanceM: { value: G.clearanceM },
      sheenRock: { value: G.sheenRock }, greenness: { value: green }, debugMode: { value: typeof window !== 'undefined' && window.RD_SCENE_DEBUG === 'classes' ? 1 : window.RD_SCENE_DEBUG === 'photo' ? 2 : window.RD_SCENE_DEBUG === 'weights' ? 3 : window.RD_SCENE_DEBUG === 'nodetail' ? 4 : window.RD_SCENE_DEBUG === 'nonormal' ? 5 : 0 },
      trackLanes: { value: new THREE.Vector2(G.tracks.lanesM[0], G.tracks.lanesM[1]) }, trackGauge: { value: G.tracks.gaugeM }, trackDark: { value: G.tracks.darkening }, trackReachM: { value: G.tracks.reachYd * YD },
      mapOf: { value: new THREE.Vector4(frame.toMap(0, 0).e, frame.toMap(0, 0).n, Math.sin(b), Math.cos(b)) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float farness; varying float vFar; varying vec3 vWorld; varying vec2 vMap; varying vec2 vGround; uniform vec4 mapOf;')
      // vMap: the survey's map metres (easting, northing), for the survey's own pictures; vGround: east and north metres from the
      // firing position, for everything finer than a metre. The map's northing is about 3.8 million metres, and a 32-bit float
      // holds it only to a quarter of a metre, so a pattern laid by vMap is cut into quarter-metre steps north to south and
      // smeared into streaks (range-day-eight, the "flat tan with smeared streaks" on the floor); vGround stays small and exact.
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFar = farness; vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; float f = -vWorld.z; vGround = vec2(f * mapOf.z + vWorld.x * mapOf.w, f * mapOf.w - vWorld.x * mapOf.z); vMap = mapOf.xy + vGround;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFar; varying vec3 vWorld; varying vec2 vMap; varying vec2 vGround;
        uniform sampler2D litNear, litFar, normNear, normFar;
        uniform highp sampler2DArray matCol, matRel;
        uniform vec3 matMean[6]; uniform float matSize[6]; uniform vec2 matShift, matShiftBig; uniform float matCount, macroScale, macroShare, matPx; uniform vec2 fineFade; uniform vec3 sunCutA, sunCutB;
        uniform vec2 nearOrigin, farOrigin, photoOrigin, trackLanes; uniform float nearSide, farSide, photoSide;
        uniform vec3 slopeCol, scrubCol, floorCol, rockCol, screeCol, weedCol;
        uniform vec2 sunMapDir; uniform float reliefShadowM, reliefShadowDark, reliefShadowDepth, hexTiles, hexSharpness, heightBlend, varyM, plainGrid, matAlbedo, photoPx, photoLodMin, debugMode, bumpFloor, bumpGrass, bumpRock, steepTan, hollowM, hollowDark, clearanceM, sheenRock, greenness, trackGauge, trackDark, trackReachM;
        uniform vec4 mapOf;
        vec3 gNormalW; float gAo; float gSheen; float gSunLit; float gRelShade;
        // the survey's squares, placed from the firing position (nearOrigin and farOrigin carry the squares' corners less the firing position's map metres, worked out in double precision)
        vec2 nearUv() { return vec2((vGround.x - nearOrigin.x) / nearSide, 1.0 - (nearOrigin.y - vGround.y) / nearSide); }
        vec2 farUv() { return vec2((vGround.x - farOrigin.x) / farSide, 1.0 - (farOrigin.y - vGround.y) / farSide); }
        bool inNear() { vec2 un = nearUv(); return un.x > 0.002 && un.x < 0.998 && un.y > 0.002 && un.y < 0.998; }
        // how far the sun's ray clears the ground here, in metres (negative in shade), from the survey
        float clearance() {
          float c = inNear() ? texture2D(litNear, nearUv()).r : texture2D(litFar, clamp(farUv(), 0.0, 1.0)).r;
          return (c * 2.0 - 1.0) * (inNear() ? clearanceM : clearanceM * 4.0);
        }
        // the survey's normal (east, up, north) and hollowness here
        vec4 surveyNormal() {
          vec4 t = inNear() ? texture2D(normNear, nearUv()) : texture2D(normFar, clamp(farUv(), 0.0, 1.0));
          return vec4(t.x * 2.0 - 1.0, t.y, t.z * 2.0 - 1.0, (t.w * 2.0 - 1.0) * (inNear() ? hollowM : hollowM * 4.0));
        }
        vec3 eastNorthUpToWorld(vec3 v) { return vec3(v.x * mapOf.w - v.z * mapOf.z, v.y, -(v.x * mapOf.z + v.z * mapOf.w)); }
        // a smooth value noise over the ground (no picture: four hashes), for the slow variation and for the materials' shifts
        float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }
        // One material at a place, laid without a visible repeat (hexagonal stochastic tiling, after Mikkelsen, "Practical
        // Real-Time Hex-Tiling", JCGT 2022): the ground is covered by a grid of small triangles (hexTiles copies of the
        // picture across); each corner shifts the picture by its own random amount, and every point blends the copies of its
        // triangle's two nearest corners, the blend sharpened toward the nearest, so no two neighbouring copies line up. The
        // screen-space steps are worked out once outside any branch and turned into one level of detail per copy.
        // plainGrid lays the plain repeating picture instead (for the repeat measure).
        // the picture's level of detail from the ground's step per screen pixel, worked out once per copy (cheaper than handing the gradients to every read, and free of the seams the shifts would leave if the card worked it out itself)
        float matLod(vec2 gx, vec2 gy) { vec2 a = gx * matPx, b = gy * matPx; return 0.5 * log2(max(max(dot(a, a), dot(b, b)), 1e-8)); }
        vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
        void hexGrid(vec2 uv, out vec3 w, out vec2 o1, out vec2 o2, out vec2 o3, float layer) {
          vec2 st = uv * 3.4641016 / hexTiles;
          vec2 sk = vec2(st.x, -0.57735027 * st.x + 1.15470054 * st.y);
          vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
          float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
          w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
          o1 = hash22(base + vec2(s, s) + layer * 13.1); o2 = hash22(base + vec2(s, 1.0 - s) + layer * 13.1); o3 = hash22(base + vec2(1.0 - s, s) + layer * 13.1);
        }
        // a copy's colour only, from the two nearest corners, blended by nearness alone: two picture reads (the larger copy, and the second kind of ground where two meet)
        vec3 macroColour(int L, vec2 uv, vec2 gx, vec2 gy) {
          float layer = float(L); float lod = matLod(gx, gy);
          if (plainGrid > 0.5) return textureLod(matCol, vec3(uv, layer), lod).rgb;
          vec3 w; vec2 o1, o2, o3; hexGrid(uv, w, o1, o2, o3, layer);
          vec2 oa, ob; float wa, wb;
          if (w.x <= w.y && w.x <= w.z) { oa = o2; ob = o3; wa = w.y; wb = w.z; } else if (w.y <= w.z) { oa = o1; ob = o3; wa = w.x; wb = w.z; } else { oa = o1; ob = o2; wa = w.x; wb = w.y; }
          float ka = pow(wa, hexSharpness), kb = pow(wb, hexSharpness);
          return mix(textureLod(matCol, vec3(uv + oa, layer), lod).rgb, textureLod(matCol, vec3(uv + ob, layer), lod).rgb, kb / max(ka + kb, 1e-5));
        }
        // the two nearest corners only (the third, the farthest, carries least once sharpened): two taps of each picture, not three
        void material(int L, vec2 uv, vec2 gx, vec2 gy, out vec4 col, out vec4 rel, out vec2 oTop) {
          float layer = float(L); float lod = matLod(gx, gy);
          if (plainGrid > 0.5) { col = textureLod(matCol, vec3(uv, layer), lod); rel = textureLod(matRel, vec3(uv, layer), lod); oTop = vec2(0.0); return; }
          vec3 w; vec2 o1, o2, o3; hexGrid(uv, w, o1, o2, o3, layer);
          vec2 oa, ob; float wa, wb;
          if (w.x <= w.y && w.x <= w.z) { oa = o2; ob = o3; wa = w.y; wb = w.z; } else if (w.y <= w.z) { oa = o1; ob = o3; wa = w.x; wb = w.z; } else { oa = o1; ob = o2; wa = w.x; wb = w.y; }
          vec4 ra = textureLod(matRel, vec3(uv + oa, layer), lod), rb = textureLod(matRel, vec3(uv + ob, layer), lod);
          float ka = pow(wa, hexSharpness), kb = pow(wb, hexSharpness); // by nearness alone: leaning to the higher picture brightened grass, whose blade tips are both the highest and the brightest
          float t = kb / max(ka + kb, 1e-5);
          col = mix(textureLod(matCol, vec3(uv + oa, layer), lod), textureLod(matCol, vec3(uv + ob, layer), lod), t);
          rel = mix(ra, rb, t);
          oTop = t < 0.5 ? oa : ob;
        }`)
      .replace('#include <map_fragment>', `
        // the photograph, never magnified past its own pixels (0.6 m): through a strong glass a screen pixel covers a few centimetres, and the photograph's compression would show as blocks; its coarser copies are used instead, and the survey's relief and the materials carry the fine structure
        vec2 ddx = dFdx(vMapUv * photoPx), ddy = dFdy(vMapUv * photoPx);
        float lod = 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy)));
        vec4 texel = textureLod(map, vMapUv, max(lod, photoLodMin));
        vec3 c = texel.rgb;
        vec3 cc = textureLod(map, vMapUv, max(lod, photoLodMin + 1.0)).rgb;
        float L = dot(cc, vec3(0.299, 0.587, 0.114));
        float sat = max(cc.r, max(cc.g, cc.b)) - min(cc.r, min(cc.g, cc.b));
        float chroma = sat / max(L, 0.02);
        float Lc = dot(c, vec3(0.299, 0.587, 0.114));
        float farW = clamp(vFar, 0.0, 1.0);
        // the survey's slope here
        vec4 sn = surveyNormal();
        vec3 mapN = normalize(sn.xyz);
        float slopeT = length(mapN.xz) / max(mapN.y, 0.05);
        float steep = smoothstep(steepTan * 0.8, steepTan * 1.25, slopeT);
        // a slow variation over the ground, for where the rock is bare and where the grass is thin
        float vary = vnoise(vGround / varyM);
        // what the ground is: scrub where the photograph is dark, floor where it is bright, flat and grey, rock where steep or pale and grey, scree on the lower steep faces
        float scrubW = mix(smoothstep(0.11, 0.045, L), smoothstep(0.62, 0.3, vary) * (1.0 - steep), farW);
        float level = 1.0 - smoothstep(0.06, 0.18, slopeT);
        float floorW = mix(smoothstep(0.20, 0.33, L) * (1.0 - smoothstep(0.5, 0.9, chroma)) * level, 0.0, farW);
        // pale, grey ground in the photograph is bare rock or scree only where it is also steep-ish; on the flat it is pale dry grass
        float paleW = mix(smoothstep(0.62, 0.85, L) * (1.0 - smoothstep(0.08, 0.2, chroma)) * smoothstep(0.3, 0.7, slopeT), 0.0, farW);
        float rockW = max(steep, paleW * 0.6) * (1.0 - scrubW);
        float screeW = rockW * smoothstep(0.35, 0.65, vary) * (1.0 - sn.w * 0.1);
        rockW -= screeW;
        float grassW = max(0.0, 1.0 - scrubW - floorW - rockW - screeW);
        // The photographed materials, one per class (layers: 0 floor, 1 dry grass, 2 green grass, 3 litter under scrub, 4 rock,
        // 5 scree; grass is the season's mix of the dry and the green). Each class's weight is pushed by its material's own
        // height, so where two classes meet the higher picture wins (dirt between tufts, stones standing out of grit) instead
        // of a soft smear between them.
        float w[6]; w[0] = floorW; w[1] = grassW * (1.0 - greenness); w[2] = grassW * greenness; w[3] = scrubW; w[4] = rockW; w[5] = screeW;
        // only the strongest two kinds of ground here take their photographs (one on Light); the rest keep their palette colour
        int i1 = 0, i2 = 0; float b1 = -1.0, b2 = -1.0;
        for (int i = 0; i < 6; i++) { if (w[i] > b1) { b2 = b1; i2 = i1; b1 = w[i]; i1 = i; } else if (w[i] > b2) { b2 = w[i]; i2 = i; } }
        vec2 gmx = dFdx(vGround), gmy = dFdy(vGround);
        float px = max(length(gmx), length(gmy));
        vec3 rt1 = vec3(1.0), rt2 = vec3(1.0); vec2 dn1 = vec2(0.0), dn2 = vec2(0.0); float h1 = 0.5, h2 = 0.5; vec2 oTop1 = vec2(0.0); float s1 = matSize[0];
        // a pixel covering more than an eighth of a copy sees only the picture's average, which is the palette's colour: no photograph there (faded in from a thirty-second)
        bool on = !(debugMode > 3.5 && debugMode < 4.5);
        for (int j = 0; j < 2; j++) {
          int i = j == 0 ? i1 : i2; float wi = j == 0 ? b1 : b2;
          if (!on || wi < (j == 0 ? 0.02 : 0.25) || (j == 1 && matCount < 1.5)) continue;
          float size = matSize[i], big = size * macroScale;
          float keep = 1.0 - smoothstep(size / fineFade.x, size / fineFade.y, px);
          // the same photograph laid again at macroScale times its size (the top kind of ground only): the clumps and patches a few metres across that one scan of a few metres does not hold, and detail farther out where the fine copy has faded
          float keepM = j == 0 ? macroShare * (1.0 - smoothstep(big / 32.0, big / 8.0, px)) : 0.0;
          if (keep <= 0.0 && keepM <= 0.0) continue;
          vec4 mc = vec4(matMean[i], 1.0), mr = vec4(0.5, 0.5, 0.5, 1.0); vec2 ot = vec2(0.0);
          vec2 uv = (vGround + matShift) / size;
          // the dominant kind of ground: colour and relief (on Light colour only); the second only where the two meet, and its colour only (two reads), its brightness standing in for its height
          if (keep > 0.0) { if (j == 0 && matCount > 1.5) material(i, uv, gmx / size, gmy / size, mc, mr, ot); else { mc = vec4(macroColour(i, uv, gmx / size, gmy / size), 1.0); mr = vec4(0.5, 0.5, clamp(dot(mc.rgb / max(matMean[i], vec3(0.004)), vec3(0.299, 0.587, 0.114)) * 0.5, 0.0, 1.0), 1.0); } }
          // the material's own pattern, its average taken out: brighter and darker, warmer and cooler than its mean, never its mean itself, which is the palette's
          vec3 r = mix(vec3(1.0), mc.rgb / max(matMean[i], vec3(0.004)), matAlbedo * keep);
          vec2 d = (mr.rg * 2.0 - 1.0) * keep;
          if (keepM > 0.0) {
            r *= mix(vec3(1.0), macroColour(i, (vGround + matShiftBig) / big + 0.37, gmx / big, gmy / big) / max(matMean[i], vec3(0.004)), matAlbedo * keepM);
          }
          if (j == 0) { rt1 = r; dn1 = d; h1 = mix(0.5, mr.b, keep); oTop1 = ot; s1 = size; } else { rt2 = r; dn2 = d; h2 = mix(0.5, mr.b, keep); }
        }
        // where the two meet, each one's weight is pushed by its own height, so the higher picture wins (dirt between tufts, stones out of grit) instead of a soft smear
        float a1 = b1 + h1 * heightBlend, a2 = max(b2, 0.0) + h2 * heightBlend;
        float m = max(a1, a2) - heightBlend;
        float e1 = max(a1 - m, 0.0), e2 = b2 < 0.02 ? 0.0 : max(a2 - m, 0.0);
        float share2 = e2 / max(e1 + e2, 1e-5);
        // (the push moves the pattern and the relief only: the palette's colours keep the classes' own weights, so the measured colours are not pulled toward whichever class has the taller scan)
        float wsum = w[0] + w[1] + w[2] + w[3] + w[4] + w[5];
        if (wsum <= 0.0) wsum = 1.0;
        vec3 ratio = mix(rt1, rt2, share2);
        vec2 dn = mix(dn1, dn2, share2);
        float hTop = mix(h1, h2, share2);
        float bumpK = 0.0; int top = i1; float topW = 1.0 - share2;
        for (int i = 0; i < 6; i++) bumpK += (w[i] / wsum) * (i == 0 ? bumpFloor : (i == 4 || i == 5 ? bumpRock : bumpGrass));
        float fW = w[0] / wsum, gW = (w[1] + w[2]) / wsum, sW = w[3] / wsum, rW = w[4] / wsum, scW = w[5] / wsum;
        vec3 base = slopeCol * gW + scrubCol * sW + floorCol * fW + rockCol * rW + screeCol * scW;
        // the photograph's own pattern: its brightness against its class's typical brightness; and half its hue
        float refL = mix(mix(0.24, 0.085, scrubW), 0.42, floorW + paleW * 0.5);
        float rel = mix(clamp(Lc / refL, 0.65, 1.3), 1.0, farW);
        vec3 photoHue = c / max(Lc, 0.02) * dot(base, vec3(0.299, 0.587, 0.114));
        vec3 ground = mix(base, photoHue, 0.45 * (1.0 - farW)) * rel;
        ground = mix(ground, ground * (0.85 + 0.3 * vary), farW);
        // tire tracks on the floor: two ruts a tire's gauge apart on each lane, wandering a little, fading by the first boards; each rut's edge broken by the dirt's own relief
        float tracks = 0.0;
        if (fW > 0.2 && -vWorld.z < trackReachM) {
          float wob = sin(-vWorld.z * 0.07) * 0.3;
          float rough = (i1 == 0 ? h1 - 0.5 : 0.0) * 0.25;
          for (int k = 0; k < 2; k++) {
            float lane = k == 0 ? trackLanes.x : trackLanes.y;
            for (int s = 0; s < 2; s++) {
              float lx = (s == 0 ? lane : -lane) + wob;
              float a = abs(abs(vWorld.x - lx) - trackGauge * 0.5) + rough;
              tracks = max(tracks, 1.0 - smoothstep(0.1, 0.28, a));
            }
          }
          tracks *= fW * (1.0 - smoothstep(trackReachM * 0.6, trackReachM, -vWorld.z));
        }
        ground *= 1.0 - tracks * trackDark;
        diffuseColor.rgb *= ground * clamp(ratio, 0.35, 2.2);
        if (debugMode > 0.5 && debugMode < 3.5) diffuseColor.rgb = debugMode < 1.5 ? base : (debugMode < 2.5 ? c : vec3(sW + gW * 0.0, gW, fW + rW + scW));
        // the relief's own small shadows: where the material's surface a little toward the sun stands higher than here, the sun is cut (the dominant material only)
        // seen from afar, rough ground returns less sun than a flat surface: dense grass and brush shade themselves. Where the scans' own small shadows are too small to draw, each kind of ground's average share of the sun cut stands in for them (sunCut, data/look.json)
        float cutAvg = dot(vec3(w[0], w[1], w[2]), sunCutA) / wsum + dot(vec3(w[3], w[4], w[5]), sunCutB) / wsum;
        float resolved = reliefShadowDark > 0.0 && on ? 1.0 - smoothstep(reliefShadowM * 0.5, reliefShadowM * 2.0, px) : 0.0;
        gRelShade = cutAvg * (1.0 - resolved);
        if (reliefShadowDark > 0.0 && topW > 0.5 && on && resolved > 0.0) {
          // one tap: the dominant picture's height a little toward the sun, from the same corner's shift
          vec2 uvT = (vGround + matShift) / s1 + oTop1 + sunMapDir * (reliefShadowM / s1);
          float hs = textureLod(matRel, vec3(uvT, float(top)), matLod(gmx / s1, gmy / s1)).b;
          // fade with distance: once a screen pixel covers more of the ground than the shadow's length, it is gone
          gRelShade += smoothstep(0.0, reliefShadowDepth, hs - h1) * reliefShadowDark * resolved;
        }
        // the normal: the survey's, tilted by the material's small relief (more on rock and scree, little on grass)
        vec3 enuN = normalize(mapN + vec3(dn.x, 0.0, dn.y) * bumpK);
        gNormalW = debugMode > 4.5 ? vec3(0.0, 1.0, 0.0) : eastNorthUpToWorld(enuN);
        // creases and gullies are darker: the ground around them blocks the sky
        gAo = 1.0 - hollowDark * clamp(sn.w / hollowM, 0.0, 1.0);
        gSheen = sheenRock * (rW + 0.5 * scW);
        gSunLit = smoothstep(-0.4, 0.5, clearance());`)
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gNormalW, 0.0)).xyz);')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= gAo;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= mix(0.0, 1.0, gSunLit) * (1.0 - gRelShade);')
        .replace('RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );', 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); reflectedLight.directSpecular += directLight.color * gSheen * pow(max(dot(reflect(-directLight.direction, geometryNormal), geometryViewDir), 0.0), 20.0);'));
  };
  mat.customProgramCacheKey = () => 'range-day-terrain-8';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = full;
  mesh.frustumCulled = false;
  return { mesh, heightAt: (x, z) => { const m = frame.toMap(x, z); return heightAt(m.e, m.n); }, texture: tex, dists, materials: mats,
    // for the measures only (scripts/picture-measure.mjs, test/scene.test.js): lay the materials in a plain grid, without the cells' shifts
    setPlainGrid(on) { if (shaderRef.uniforms) shaderRef.uniforms.plainGrid.value = on ? 1 : 0; },
    // and slide one copy of the materials along the ground by east and north metres (the fine copy, or with big the larger one), the camera, the other copy and everything else unmoved
    setMaterialShift(east, north, big) { if (shaderRef.uniforms) (big ? shaderRef.uniforms.matShiftBig : shaderRef.uniforms.matShift).value.set(east, north); } };
}

export { YD, FT };
