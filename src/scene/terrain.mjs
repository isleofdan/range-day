// The ground: a fan-shaped mesh from the firing position, finest along the
// first hundreds of yards, standing on the surveyed heights; coloured from
// the aerial photograph re-tinted to the season's measured palette; lit
// pixel by pixel from the survey's own slopes (a normal map built from the
// 1 m heights inside the square and the 10 m heights beyond), shaded where
// the sun's ray does not clear the ground, darkened in creases; sorted
// per pixel into packed dirt, grass, scrub, bare rock and loose scree by
// the slope's steepness and the photograph's colour; and given surface
// detail at three scales, fixed to the ground, so a hillside through a
// strong glass shows clumps, stones and rills instead of a stretched
// photograph. World frame: origin at the firing position's ground, x right
// of the line of fire, y up, z toward the shooter (so the plates stand at
// negative z), metres.
import * as THREE from 'three';
import { sunMask, normalMap } from './heights.mjs';

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

  const { dirt, grass, patch } = detailTextures(full ? 512 : 256);
  const sunMap = new THREE.Vector2(Math.sin((sun.azimuth * Math.PI) / 180), Math.cos((sun.azimuth * Math.PI) / 180));
  const b = (course.firing.bearingDeg * Math.PI) / 180;
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      litNear: { value: litNear }, litFar: { value: litFar }, normNear: { value: normNear }, normFar: { value: normFar },
      nearOrigin: { value: new THREE.Vector2(near.originE, near.originN) }, nearSide: { value: near.width * near.spacingM },
      farOrigin: { value: new THREE.Vector2(far.originE, far.originN) }, farSide: { value: far.width * far.spacingM },
      photoOrigin: { value: new THREE.Vector2(photo.originE, photo.originN) }, photoSide: { value: photoSide },
      slopeCol: { value: slope }, scrubCol: { value: scrub }, floorCol: { value: floor }, rockCol: { value: rock }, screeCol: { value: scree }, weedCol: { value: weeds },
      dirtMap: { value: dirt }, grassMap: { value: grass }, patchMap: { value: patch }, photoPx: { value: photo.width }, photoLodMin: { value: Math.log2(G.photoFinestPx) }, detailPx: { value: full ? 512 : 256 }, detailFadeLod: { value: Math.log2(G.detailFadeTexels) }, sunMapDir: { value: sunMap }, clumpShadowM: { value: G.clumpShadowM * Math.min(3, 1 / Math.max(0.2, Math.tan((sun.elevation * Math.PI) / 180))) }, clumpShadowDark: { value: G.clumpShadowDark },
      tiles: { value: new THREE.Vector3(G.detailTilesM[0], G.detailTilesM[1], G.detailTilesM[2]) }, octaves: { value: full ? 3 : 2 },
      detailAlbedo: { value: G.detailAlbedo }, bumpFloor: { value: G.bump.floor }, bumpGrass: { value: G.bump.grass }, bumpRock: { value: G.bump.rock },
      steepTan: { value: Math.tan((G.steepDeg * Math.PI) / 180) }, hollowM: { value: G.hollowM }, hollowDark: { value: G.hollowDarkening }, clearanceM: { value: G.clearanceM },
      sheenRock: { value: G.sheenRock }, greenness: { value: green }, debugMode: { value: typeof window !== 'undefined' && window.RD_SCENE_DEBUG === 'classes' ? 1 : window.RD_SCENE_DEBUG === 'photo' ? 2 : window.RD_SCENE_DEBUG === 'weights' ? 3 : window.RD_SCENE_DEBUG === 'nodetail' ? 4 : window.RD_SCENE_DEBUG === 'nonormal' ? 5 : /^oct[012]$/.test(window.RD_SCENE_DEBUG || '') ? 6 + Number(window.RD_SCENE_DEBUG[3]) : 0 },
      trackLanes: { value: new THREE.Vector2(G.tracks.lanesM[0], G.tracks.lanesM[1]) }, trackGauge: { value: G.tracks.gaugeM }, trackDark: { value: G.tracks.darkening }, trackReachM: { value: G.tracks.reachYd * YD },
      mapOf: { value: new THREE.Vector4(frame.toMap(0, 0).e, frame.toMap(0, 0).n, Math.sin(b), Math.cos(b)) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float farness; varying float vFar; varying vec3 vWorld; varying vec2 vMap; uniform vec4 mapOf;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFar = farness; vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; float f = -vWorld.z; vMap = vec2(mapOf.x + f * mapOf.z + vWorld.x * mapOf.w, mapOf.y + f * mapOf.w - vWorld.x * mapOf.z);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFar; varying vec3 vWorld; varying vec2 vMap;
        uniform sampler2D litNear, litFar, normNear, normFar, dirtMap, grassMap, patchMap;
        uniform vec2 nearOrigin, farOrigin, photoOrigin, trackLanes; uniform float nearSide, farSide, photoSide;
        uniform vec3 slopeCol, scrubCol, floorCol, rockCol, screeCol, weedCol, tiles;
        uniform vec2 sunMapDir; uniform float clumpShadowM, clumpShadowDark, detailPx, detailFadeLod, photoPx, photoLodMin, debugMode, octaves, detailAlbedo, bumpFloor, bumpGrass, bumpRock, steepTan, hollowM, hollowDark, clearanceM, sheenRock, greenness, trackGauge, trackDark, trackReachM;
        uniform vec4 mapOf;
        vec3 gNormalW; float gAo; float gSheen; float gSunLit;
        vec2 nearUv() { return vec2((vMap.x - nearOrigin.x) / nearSide, 1.0 - (nearOrigin.y - vMap.y) / nearSide); }
        vec2 farUv() { return vec2((vMap.x - farOrigin.x) / farSide, 1.0 - (farOrigin.y - vMap.y) / farSide); }
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
        vec3 eastNorthUpToWorld(vec3 v) { return vec3(v.x * mapOf.w - v.z * mapOf.z, v.y, -(v.x * mapOf.z + v.z * mapOf.w)); }`)
      .replace('#include <map_fragment>', `
        // the photograph, never magnified past its own pixels (0.6 m): through a strong glass a screen pixel covers a few centimetres, and the photograph's compression would show as blocks; its coarser copies are used instead, and the survey's relief and the detail carry the fine structure
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
        // a slow variation over the ground, for where the rock is bare and where the grass is thin (the big tile of the dirt picture)
        float vary = texture2D(patchMap, vMap / (tiles.x * 5.0)).z;
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
        vec3 base = slopeCol * grassW + scrubCol * scrubW + floorCol * floorW + rockCol * rockW + screeCol * screeW;
        // the photograph's own pattern: its brightness against its class's typical brightness; and half its hue
        float refL = mix(mix(0.24, 0.085, scrubW), 0.42, floorW + paleW * 0.5);
        float rel = mix(clamp(Lc / refL, 0.65, 1.3), 1.0, farW);
        vec3 photoHue = c / max(Lc, 0.02) * dot(base, vec3(0.299, 0.587, 0.114));
        vec3 ground = mix(base, photoHue, 0.45 * (1.0 - farW)) * rel;
        ground = mix(ground, ground * (0.85 + 0.3 * vary), farW);
        // surface detail at three scales, fixed to the ground: dirt (clods, stones, rills) under the floor, rock and scree; strands and clumps under grass and scrub
        float dirtiness = clamp(floorW + rockW + screeW, 0.0, 1.0);
        float clumpShade = 0.0;
        vec2 dn = vec2(0.0); float albedo = 0.0; float stone = 0.0;
        float wts[3]; wts[0] = 1.0; wts[1] = 0.8; wts[2] = 0.6;
        float dbgOct = 0.0;
        for (int i = 0; i < 3; i++) {
          if (float(i) >= octaves || (debugMode > 3.5 && debugMode < 5.5)) break;
          if (debugMode > 5.5 && float(i) != debugMode - 6.0) continue;
          float tile = i == 0 ? tiles.x : (i == 1 ? tiles.y : tiles.z);
          vec2 tuv = vMap / tile;
          // a scale whose texels are far smaller than a screen pixel carries nothing but aliasing: it fades out as it shrinks past detailFadePx texels a pixel
          vec2 tdx = dFdx(tuv * detailPx), tdy = dFdy(tuv * detailPx);
          float tlod = 0.5 * log2(max(dot(tdx, tdx), dot(tdy, tdy)));
          float keep = 1.0 - smoothstep(detailFadeLod - 1.0, detailFadeLod + 1.0, tlod);
          if (keep <= 0.0) continue;
          vec4 d, g;
          if (i == 0) {
            // the coarse scale: patches of clumps, bare spots and stones, the clumps darker on grass and scrub (bushes too small to stand), each throwing a short hard shadow away from the sun
            vec4 pt = texture2D(patchMap, tuv);
            d = pt; g = pt;
            g.z -= pt.w * 0.3 * (1.0 - dirtiness);
            float sh = texture2D(patchMap, tuv + sunMapDir * (clumpShadowM / tile)).w;
            clumpShade = max(clumpShade, max(0.0, sh - pt.w) * keep);
          } else {
            // the middle scale: clods and stones under dirt, small clumps under grass; the fine scale: grains under dirt, strands under grass
            d = texture2D(dirtMap, tuv);
            g = i == 1 ? texture2D(patchMap, tuv) : texture2D(grassMap, tuv);
            if (i == 1) { float sh = texture2D(patchMap, tuv + sunMapDir * (clumpShadowM * 0.15 / tile)).w; clumpShade = max(clumpShade, max(0.0, sh - g.w) * keep * 0.7); }
            // the finer pictures are sampled twice, the second turned and shifted, blended by the slow variation, so no repeat shows at a distance
            vec2 ruv = vec2(tuv.x * 0.78 - tuv.y * 0.63, tuv.x * 0.63 + tuv.y * 0.78) + 0.37;
            float bw = smoothstep(0.3, 0.7, vary);
            d = mix(d, texture2D(dirtMap, ruv), bw);
            g = mix(g, i == 1 ? texture2D(patchMap, ruv) : texture2D(grassMap, ruv), bw);
          }
          vec4 t = mix(g, d, dirtiness);
          dn += (t.xy * 2.0 - 1.0) * wts[i] * keep;
          albedo += (t.z * 2.0 - 1.0) * detailAlbedo * wts[i] * keep;
          stone = max(stone, t.w * dirtiness * keep);
        }
        // stones are paler and greyer than the dirt around them
        ground = mix(ground, mix(ground, rockCol * 0.9, 0.5), stone * (0.35 + 0.4 * rockW + 0.4 * screeW));
        // tire tracks on the floor: two ruts a tire's gauge apart on each lane, wandering a little, fading by the first boards
        float tracks = 0.0;
        if (floorW > 0.2 && -vWorld.z < trackReachM) {
          float wob = sin(-vWorld.z * 0.07) * 0.3;
          for (int k = 0; k < 2; k++) {
            float lane = k == 0 ? trackLanes.x : trackLanes.y;
            for (int s = 0; s < 2; s++) {
              float lx = (s == 0 ? lane : -lane) + wob;
              float a = abs(abs(vWorld.x - lx) - trackGauge * 0.5);
              tracks = max(tracks, 1.0 - smoothstep(0.1, 0.28, a));
            }
          }
          tracks *= floorW * (1.0 - smoothstep(trackReachM * 0.6, trackReachM, -vWorld.z));
        }
        ground *= 1.0 - tracks * trackDark;
        ground *= 1.0 - clumpShade * clumpShadowDark * (1.0 - dirtiness * 0.5);
        diffuseColor.rgb *= ground * clamp(1.0 + albedo, 0.55, 1.45);
        if (debugMode > 5.5) diffuseColor.rgb = vec3(0.5 + albedo * 2.0);
        if (debugMode > 0.5 && debugMode < 3.5) diffuseColor.rgb = debugMode < 1.5 ? base : (debugMode < 2.5 ? c : vec3(scrubW, grassW, floorW + rockW + screeW));
        // the normal: the survey's, tilted by the detail's small relief (more on rock and scree, little on grass)
        float bumpK = bumpFloor * floorW + bumpGrass * (grassW + scrubW) + bumpRock * (rockW + screeW * 0.8);
        vec3 enuN = normalize(mapN + vec3(dn.x, 0.0, dn.y) * bumpK);
        gNormalW = debugMode > 4.5 ? vec3(0.0, 1.0, 0.0) : eastNorthUpToWorld(enuN);
        // creases and gullies are darker: the ground around them blocks the sky
        gAo = 1.0 - hollowDark * clamp(sn.w / hollowM, 0.0, 1.0);
        gSheen = sheenRock * (rockW + 0.5 * screeW + 0.3 * stone);
        gSunLit = smoothstep(-0.4, 0.5, clearance());`)
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gNormalW, 0.0)).xyz);')
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= gAo;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= mix(0.0, 1.0, gSunLit);')
        .replace('RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );', 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); reflectedLight.directSpecular += directLight.color * gSheen * pow(max(dot(reflect(-directLight.direction, geometryNormal), geometryViewDir), 0.0), 20.0);'));
  };
  mat.customProgramCacheKey = () => 'range-day-terrain-6';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = full;
  mesh.frustumCulled = false;
  return { mesh, heightAt: (x, z) => { const m = frame.toMap(x, z); return heightAt(m.e, m.n); }, texture: tex, dists, dirt, grass, patch };
}

// Surface detail, made in code as two tileable pictures sampled at several
// scales over the ground: `dirt` (clods, crumbs, stones and shallow rills)
// and `grass` (strands and clumps). Each pixel holds the surface's small
// slope (R, G: a normal's east and north parts, 128 flat), its brightness
// against the ground's own (B, 128 even) and a mask (A: stones in the dirt,
// clump tops in the grass). A seeded generator, so the ground is the same
// each visit.
function detailTextures(size = 512) {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const field = () => new Float32Array(size * size);
  const wrap = (v) => ((v % size) + size) % size;
  // a soft bump (a clod, a stone, a clump) of radius r and height h at x, y, with a shape exponent
  const bump = (H, A, x0, y0, r, h, pow, a) => {
    const x = Math.round(x0), y = Math.round(y0), ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.hypot(dx, dy) / r; if (d >= 1) continue;
      const k = wrap(y + dy) * size + wrap(x + dx);
      const v = Math.pow(1 - d * d, pow) * h;
      H[k] += v; if (A && a) A[k] = Math.max(A[k], a * (1 - d));
    }
  };
  const stroke = (H, B, x, y, len, ang, w, h, bright) => {
    const n = Math.ceil(len);
    for (let i = 0; i <= n; i++) { const px = x + Math.cos(ang) * i, py = y + Math.sin(ang) * i; for (let o = -w; o <= w; o++) { const k = wrap(Math.round(py + o * Math.sin(ang + 1.5708))) * size + wrap(Math.round(px + o * Math.cos(ang + 1.5708))); H[k] += h; if (B) B[k] += bright; } }
  };
  // brightness from a height field, scaled between its 2nd and 98th percentiles (a few tall overlaps must not flatten the rest)
  const norm = (H, lo = -0.5, span = 1) => { const smp = Array.from({ length: 4096 }, (_, i) => H[Math.floor((i / 4096) * H.length)]).sort((a, b) => a - b); const p2 = smp[82], p98 = smp[4013]; return (v) => Math.max(lo, Math.min(lo + span, ((v - p2) / Math.max(1e-6, p98 - p2)) * span + lo)); };
  const pack = (H, B, A, scale) => {
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const dzdx = (H[y * size + wrap(x + 1)] - H[y * size + wrap(x - 1)]) * scale, dzdy = (H[wrap(y - 1) * size + x] - H[wrap(y + 1) * size + x]) * scale;
      const l = Math.hypot(dzdx, 1, dzdy);
      out[k * 4] = Math.round((-dzdx / l * 0.5 + 0.5) * 255); out[k * 4 + 1] = Math.round((-dzdy / l * 0.5 + 0.5) * 255);
      out[k * 4 + 2] = Math.round(Math.max(0, Math.min(255, 128 + B[k] * 128)));
      out[k * 4 + 3] = Math.round(Math.max(0, Math.min(1, A[k])) * 255);
    }
    const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    return t;
  };
  // dirt: clods and crumbs of many sizes, a few hundred stones, shallow rills
  const dH = field(), dB = field(), dA = field();
  for (let i = 0; i < 3000; i++) { const r = 1.5 + rnd() * rnd() * 14, x = rnd() * size, y = rnd() * size; bump(dH, null, x, y, r, 0.4 + rnd() * 0.6, 1.2, 0); }
  for (let i = 0; i < 420; i++) { const r = 1.5 + rnd() * rnd() * 7, x = rnd() * size, y = rnd() * size; bump(dH, dA, x, y, r, 1.2 + rnd() * 1.2, 0.7, 0.6 + rnd() * 0.4); }
  for (let i = 0; i < 24; i++) { const x = rnd() * size, y = rnd() * size, a = rnd() * 6.3; let px = x, py = y, ang = a; for (let s = 0; s < 14; s++) { stroke(dH, null, px, py, 10, ang, 2, -0.35, 0); px += Math.cos(ang) * 10; py += Math.sin(ang) * 10; ang += (rnd() - 0.5) * 0.8; } }
  // brightness: lit clods paler on top, hollows darker, stones pale
  { const n = norm(dH, -0.3, 0.6); for (let i = 0; i < dH.length; i++) dB[i] = n(dH[i]) + dA[i] * 0.3; }
  // grass: thousands of short strands and a hundred clumps
  const gH = field(), gB = field(), gA = field();
  for (let i = 0; i < 160; i++) { const r = 6 + rnd() * 18, x = rnd() * size, y = rnd() * size; bump(gH, gA, x, y, r, 0.8 + rnd() * 0.8, 1.0, 0.5 + rnd() * 0.5); }
  for (let i = 0; i < 1400; i++) {
    // a blade: a curved stroke a few hundredths of the tile long, a blade's width, paler or darker than the ground
    const len = 30 + rnd() * 150, bright = (rnd() - 0.45) * 0.5, w = rnd() < 0.3 ? 1 : 0;
    let x = rnd() * size, y = rnd() * size, a = rnd() * 6.3; const turn = (rnd() - 0.5) * 0.08;
    for (let s = 0; s < len; s += 6) { stroke(gH, gB, x, y, 6, a, w, 0.25 + rnd() * 0.2, bright); x += Math.cos(a) * 6; y += Math.sin(a) * 6; a += turn; }
  }
  for (let i = 0; i < 1200; i++) { const r = 1 + rnd() * rnd() * 5, x = rnd() * size, y = rnd() * size; bump(gH, null, x, y, r, 0.3 + rnd() * 0.5, 1.0, 0); }
  { const n = norm(gH, -0.15, 0.3); for (let i = 0; i < gB.length; i++) gB[i] = Math.max(-0.5, Math.min(0.5, gB[i] * 0.5 + n(gH[i]) + (gA[i] - 0.3) * 0.2)); }
  // patches, for the coarse scale: clumps of grass and low bushes as soft dark blotches, bare spots paler, scattered stones; no strands (a line at this scale reads as cloth)
  const pH = field(), pB = field(), pA = field();
  for (let i = 0; i < 220; i++) { const r = 8 + rnd() * rnd() * 36, x = rnd() * size, y = rnd() * size, a = 0.4 + rnd() * 0.6, h = 0.3 + rnd() * 0.5; for (let k = 0; k < 3; k++) bump(pH, pA, x + (rnd() - 0.5) * r * 1.2, y + (rnd() - 0.5) * r * 1.2, r * (0.5 + rnd() * 0.6), h, 2.0, a); }
  for (let i = 0; i < 160; i++) { const r = 12 + rnd() * 30, x = rnd() * size, y = rnd() * size; bump(pH, null, x, y, r, -0.2 - rnd() * 0.3, 2.0, 0); }
  for (let i = 0; i < 300; i++) { const r = 3 + rnd() * rnd() * 5, x = rnd() * size, y = rnd() * size; bump(pH, null, x, y, r, 0.5 + rnd() * 0.5, 1.2, 0); }
  { const n = norm(pH, -0.2, 0.4); for (let i = 0; i < pH.length; i++) pB[i] = n(pH[i]) - pA[i] * 0.4; }
  return { dirt: pack(dH, dB, dA, 1.0), grass: pack(gH, gB, gA, 0.6), patch: pack(pH, pB, pA, 0.3) };
}

export { YD, FT };
