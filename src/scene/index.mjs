// The firing line's picture: a 3D scene on the surveyed ground of the real
// range, lit by the real sun for the day's month and time, drawn under the
// existing sight at exactly the existing angular scale. Built into
// public/scene.min.js (scripts/build-scene.mjs) and used by public/line.js
// as window.RangeDayScene. The picture never changes a shot: it is given
// the same course data the engine is given and draws the plates where that
// data puts them.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunPosition, noonElevation, sunVector } from './sun.mjs';
import { loadHeights } from './heights.mjs';
import { buildTerrain, frameOf, YD, FT } from './terrain.mjs';
import { buildPlates, buildBoards, buildShelter, buildBrush } from './things.mjs';
import { makePost } from './post.mjs';

const VERSION = 2;

// Whether this browser can draw the picture at all: WebGL2 and the stream inflater the heights need.
function canDraw() {
  try {
    if (typeof DecompressionStream === 'undefined') return false;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    return Boolean(gl);
  } catch { return false; }
}

const loadImage = (url) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(`${url} did not load`)); im.src = url; });
const hex = (h) => new THREE.Color(h);

async function create(opts) {
  const { canvas, size, dpr = 1, course, terrain, look, physics, weather, month, timeOfDay, quality = 'full', eyeFt } = opts;
  const full = quality === 'full';
  const eyeM = (eyeFt ?? look.eyeHeightFt) * FT;
  const frame = frameOf(course.firing);
  const rec = terrain;
  const photoRec = full ? rec.photo : rec.photoLight;
  const t0 = performance.now();
  const [near, far, photoImage] = await Promise.all([
    loadHeights(`/${rec.heights.file}`, rec.heights),
    loadHeights(`/${rec.heightsFar.file}`, rec.heightsFar),
    loadImage(`/${photoRec.file}`),
  ]);
  const groundM = near.heightAt(course.firing.easting, course.firing.northing);

  // The sun for the day: the place, the middle of the month, the clock hour of the time of day.
  const sun = sunPosition({ lat: course.firing.lat, lon: course.firing.lon, month, day: look.monthDay, hour: look.clockHour[timeOfDay] });
  const sv = sunVector(sun); // east, up, south
  const sunDir = frame.dir(sv.x, -sv.z, sv.y).normalize();

  // The scene is drawn to a texture in linear light and brought to the screen by the last pass (post.mjs), which smooths edges on Full by multisampling that texture.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  const halfFloat = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  renderer.setPixelRatio(dpr);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.light.exposure ?? 0.7;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = full;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // near and far from the data (data/look.json, depth): the posts' stand-off behind the boards and plates is worked out from them
  const camera = new THREE.PerspectiveCamera(5, 1, look.depth.cameraNearM, look.depth.cameraFarM);
  camera.position.set(0, eyeM, 0);
  scene.add(camera);

  // The season's sky and haze colours, from the measured palette and the day's humidity.
  const P = look.palette['cta-piru'];
  const green = look.greenByMonth[String(month)];
  const skyBase = hex(P.green.sky).lerp(hex(P.dry.sky), 1 - green);
  const humid = Math.max(0, Math.min(1, (weather.humidity - 0.2) / 0.7));
  const hazeCol = skyBase.clone().lerp(new THREE.Color(0xe8e4da), 1 - look.air.blueShare + 0.3 * humid);
  const visM = (look.haze.visibilityDryMi + (look.haze.visibilityHumidMi - look.haze.visibilityDryMi) * humid) * 1609.34 * (weather.santaAna ? 1.5 : 1);

  // Light: the sun and the sky's fill. Low sun is redder and weaker, as the last-light photographs show.
  const lowness = Math.max(0, Math.min(1, 1 - sun.elevation / 25));
  const sunCol = new THREE.Color(1, 0.98, 0.93).lerp(hex(P.lastLight.sunlitHills).multiplyScalar(1.4), lowness * 0.8);
  const sunLight = new THREE.DirectionalLight(sunCol, look.light.sunIntensity * Math.max(0.05, Math.sin((Math.max(2, sun.elevation) * Math.PI) / 180) ** 0.35));
  sunLight.position.copy(sunDir.clone().multiplyScalar(600).add(new THREE.Vector3(0, 0, -200)));
  sunLight.target.position.set(0, 0, -200);
  scene.add(sunLight, sunLight.target);
  if (full) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc = sunLight.shadow.camera; sc.left = -240; sc.right = 240; sc.top = 240; sc.bottom = -240; sc.near = 1; sc.far = 1600;
    sunLight.shadow.bias = -0.0008; sunLight.shadow.normalBias = 0.6;
  }
  const hemi = new THREE.HemisphereLight(skyBase.clone().lerp(new THREE.Color(0xffffff), 0.35), hex(P.dry.floor).lerp(hex(P.green.floor), green), look.light.skyIntensity);
  scene.add(hemi);
  const bounce = new THREE.AmbientLight(0xffffff, look.light.groundBounce * 0.5);
  scene.add(bounce);

  // The sky: a physical model (Preetham et al. 1999, "A Practical Analytic Model for Daylight", as three's Sky), hazier on a humid day.
  const sky = new Sky();
  sky.scale.setScalar(45000);
  const su = sky.material.uniforms;
  su.turbidity.value = look.haze.turbidityClear + (look.haze.turbidityHumid - look.haze.turbidityClear) * humid * (weather.santaAna ? 0.4 : 1);
  su.rayleigh.value = look.haze.rayleigh ?? 2.2;
  su.mieCoefficient.value = look.haze.mieClear + (look.haze.mieHumid - look.haze.mieClear) * humid;
  su.mieDirectionalG.value = 0.8;
  su.sunPosition.value.copy(sunDir);
  // the sky model's brightness against the ground's, a figure of the data (the model is in its own units)
  sky.material.uniforms.skyScale = { value: look.light.skyScale ?? 0.4 };
  // the model gives the sky's light (its gradient, its glow around the sun, its haze); its hue is pulled toward the season's measured sky colour, which a physical model lit by a white sun does not reach (the photographs' sky is a deeper blue than the model's)
  sky.material.uniforms.skyTint = { value: skyBase.clone() };
  sky.material.uniforms.skyTintShare = { value: look.light.skyTintShare ?? 0 };
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('uniform float mieDirectionalG;', 'uniform float mieDirectionalG; uniform float skyScale, skyTintShare; uniform vec3 skyTint;')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'vec3 skyCol = texColor * skyScale; float skyLum = dot(skyCol, vec3(0.2126, 0.7152, 0.0722)); vec3 tinted = skyTint * (skyLum / max(dot(skyTint, vec3(0.2126, 0.7152, 0.0722)), 0.001)); gl_FragColor = vec4( mix(skyCol, tinted, skyTintShare), 1.0 );');
  scene.add(sky);

  // The ground.
  const terrainBuilt = buildTerrain({ near, far, photo: photoRec, photoUrl: `/${photoRec.file}`, frame, groundM, look, quality, sun, month, course });
  scene.add(terrainBuilt.mesh);
  if (window.RD_SCENE_DEBUG === 'unlit') terrainBuilt.mesh.material = new THREE.MeshBasicMaterial({ map: terrainBuilt.texture });
  if (window.RD_SCENE_DEBUG === 'normals') terrainBuilt.mesh.material = new THREE.MeshNormalMaterial();
  if (window.RD_SCENE_DEBUG === 'lambert') terrainBuilt.mesh.material = new THREE.MeshLambertMaterial({ color: 0xa08860 });
  const groundAt = terrainBuilt.heightAt;

  // The things on the range.
  const platesBuilt = buildPlates({ plates: course.plates, eyeM, look, physics, groundAt, full });
  scene.add(platesBuilt.group);
  scene.add(buildBoards({ look, groundAt, full }));
  scene.add(buildShelter({ look, full }));
  const brush = buildBrush({ look, physics, photoImage, photo: photoRec, frame, groundAt, month, full, sunDir });
  scene.add(brush.mesh);

  const post = makePost({ renderer, size: Math.round(size * dpr), look, samples: full ? (look.picture?.samplesFull ?? 4) : 0, halfFloat });
  post.uniforms.near.value = camera.near; post.uniforms.far.value = camera.far;
  // the air: things pale toward the sky's colour with distance (the day's visibility) and brighten toward the sun
  post.uniforms.airCol.value.copy(hazeCol);
  post.uniforms.airBright.value = look.air.brightness + (look.air.brightnessHumid - look.air.brightness) * humid;
  post.uniforms.airDist.value = visM;
  post.uniforms.sunGlow.value = look.air.sunGlow; post.uniforms.sunGlowWidth.value = look.air.sunGlowWidth;
  post.uniforms.sunDir.value.copy(sunDir);

  const view = { yawDeg: 0, pitchDeg: 0, fovDeg: 5, glass: false, windMph: 0 };
  const dir = new THREE.Vector3();
  function aim() {
    // The plain drawing's angles are independent: right = atan(sideways / downrange), up = atan(rise / downrange). The camera looks
    // along (tan right, tan up, -1), so the aimed point sits exactly at the view's centre under both pictures.
    const y = (view.yawDeg * Math.PI) / 180, p = (view.pitchDeg * Math.PI) / 180;
    dir.set(Math.tan(y), Math.tan(p), -1);
    camera.lookAt(dir.clone().add(camera.position));
    camera.fov = view.fovDeg; camera.updateProjectionMatrix();
  }
  aim();
  const tempFactor = Math.max(0, Math.min(1, (weather.tempF - look.shimmer.startF) / (look.shimmer.fullF - look.shimmer.startF)));
  let last = 0;
  const bytes = rec.heights.bytes + rec.heightsFar.bytes + photoRec.bytes;
  const built = { ms: Math.round(performance.now() - t0), brush: brush.placed, rows: terrainBuilt.dists.length, halfFloat, samples: post.target.samples };

  const api = {
    version: VERSION, sun, noonElevation: noonElevation({ lat: course.firing.lat, month, day: look.monthDay }), bytes, built, quality, camera, scene,
    setView({ yawDeg, pitchDeg, fovDeg, glass, windMph }) { Object.assign(view, { yawDeg, pitchDeg, fovDeg, glass: Boolean(glass), windMph: windMph || 0 }); aim(); },
    render(now) {
      const dt = Math.min(0.1, now - last); last = now;
      platesBuilt.step(dt);
      brush.uniforms.time.value = now; brush.uniforms.wind.value = Math.abs(view.windMph);
      // shimmer: an angular wobble (minutes of angle at full distance) as a share of the view, so it grows with magnification
      post.uniforms.time.value = now;
      post.uniforms.shimmer.value = (view.fovDeg > 3.5 || window.RD_SCENE_DEBUG === 'noshimmer') ? 0 : ((look.shimmer.amplitudeMoa * tempFactor) / (view.fovDeg * 60)) * 0.5;
      post.uniforms.lean.value = Math.max(-1, Math.min(1, view.windMph / 15));
      post.uniforms.glass.value = view.glass ? 1 : 0;
      post.setCamera(camera);
      renderer.setRenderTarget(post.target);
      renderer.render(scene, camera);
      post.draw();
    },
    strike(ix, upIn, rightIn) { platesBuilt.strike(ix, upIn, rightIn); },
    // Where a world point lands on the canvas, in CSS pixels.
    project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return [((v.x + 1) / 2) * size, ((1 - v.y) / 2) * size]; },
    plateWorld(ix) { const p = course.plates[ix]; return { x: p.lateralYd * YD, y: eyeM + p.riseFt * FT, z: -p.yards * YD }; },
    groundAt, detailTextures: { dirt: terrainBuilt.dirt, grass: terrainBuilt.grass, patch: terrainBuilt.patch },
    // The light's figures, changeable while the picture is up: how the figures in data/look.json were measured against the photographs' colours (scripts/picture-measure.mjs and the tests read the picture; nothing on a screen calls this).
    tune({ exposure, sun: sunK, sky: skyK, bounce: bounceK, airBright, airDist, skyScale } = {}) {
      if (exposure != null) renderer.toneMappingExposure = exposure;
      if (sunK != null) sunLight.intensity = sunK * Math.max(0.05, Math.sin((Math.max(2, sun.elevation) * Math.PI) / 180) ** 0.35);
      if (skyK != null) hemi.intensity = skyK;
      if (bounceK != null) bounce.intensity = bounceK * 0.5;
      if (airBright != null) post.uniforms.airBright.value = airBright;
      if (airDist != null) post.uniforms.airDist.value = airDist;
      if (skyScale != null) sky.material.uniforms.skyScale.value = skyScale;
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'skyTintShare']) if (arguments[0][k] != null) su[k].value = arguments[0][k];
    },
    resize(px, ratio = dpr) { renderer.setPixelRatio(ratio); renderer.setSize(px, px, false); post.resize(Math.round(px * ratio)); api.size = px; },
    size,
    dispose() { renderer.dispose(); post.dispose(); },
  };
  // project() reads api.size after a resize
  api.project = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [((v.x + 1) / 2) * api.size, ((1 - v.y) / 2) * api.size]; };
  return api;
}

window.RangeDayScene = { create, canDraw, sunPosition, noonElevation, version: VERSION };
