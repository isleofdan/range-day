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

const VERSION = 1;

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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: full, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.light.exposure ?? 0.7;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = full;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(5, 1, 0.5, 20000);
  camera.position.set(0, eyeM, 0);
  scene.add(camera);

  // The season's sky and haze colours, from the measured palette and the day's humidity.
  const P = look.palette['cta-piru'];
  const green = look.greenByMonth[String(month)];
  const skyBase = hex(P.green.sky).lerp(hex(P.dry.sky), 1 - green);
  const humid = Math.max(0, Math.min(1, (weather.humidity - 0.2) / 0.7));
  const hazeCol = skyBase.clone().lerp(new THREE.Color(0xe8e4da), 0.35 + 0.45 * humid);
  const visM = (look.haze.visibilityDryMi + (look.haze.visibilityHumidMi - look.haze.visibilityDryMi) * humid) * 1609.34 * (weather.santaAna ? 1.5 : 1);
  scene.fog = new THREE.Fog(hazeCol, visM * 0.04, visM);

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
  scene.add(new THREE.AmbientLight(0xffffff, look.light.groundBounce * 0.5));

  // The sky: a physical model (Preetham et al. 1999, "A Practical Analytic Model for Daylight", as three's Sky), hazier on a humid day.
  const sky = new Sky();
  sky.scale.setScalar(45000);
  const su = sky.material.uniforms;
  su.turbidity.value = look.haze.turbidityClear + (look.haze.turbidityHumid - look.haze.turbidityClear) * humid * (weather.santaAna ? 0.4 : 1);
  su.rayleigh.value = look.haze.rayleigh ?? 2.2;
  su.mieCoefficient.value = 0.004 + 0.006 * humid;
  su.mieDirectionalG.value = 0.8;
  su.sunPosition.value.copy(sunDir);
  // the sky model's brightness against the ground's, a figure of the data (the model is in its own units)
  sky.material.uniforms.skyScale = { value: look.light.skyScale ?? 0.4 };
  sky.material.fragmentShader = sky.material.fragmentShader.replace('uniform float mieDirectionalG;', 'uniform float mieDirectionalG; uniform float skyScale;').replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * skyScale, 1.0 );');
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
  const brush = buildBrush({ look, physics, photoImage, photo: photoRec, frame, groundAt, month, full });
  scene.add(brush.mesh);

  const post = makePost({ renderer, size: Math.round(size * dpr), look });
  post.uniforms.near.value = camera.near; post.uniforms.far.value = camera.far;

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
  const built = { ms: Math.round(performance.now() - t0), brush: brush.placed, rows: terrainBuilt.dists.length };

  const api = {
    version: VERSION, sun, noonElevation: noonElevation({ lat: course.firing.lat, month, day: look.monthDay }), bytes, built, quality, camera, scene,
    setView({ yawDeg, pitchDeg, fovDeg, glass, windMph }) { Object.assign(view, { yawDeg, pitchDeg, fovDeg, glass: Boolean(glass), windMph: windMph || 0 }); aim(); },
    render(now) {
      const dt = Math.min(0.1, now - last); last = now;
      platesBuilt.step(dt);
      brush.uniforms.time.value = now; brush.uniforms.wind.value = Math.abs(view.windMph);
      // shimmer: an angular wobble (minutes of angle at full distance) as a share of the view, so it grows with magnification
      post.uniforms.time.value = now;
      post.uniforms.shimmer.value = view.fovDeg > 3.5 ? 0 : ((look.shimmer.amplitudeMoa * tempFactor) / (view.fovDeg * 60)) * 0.5;
      post.uniforms.lean.value = Math.max(-1, Math.min(1, view.windMph / 15));
      post.uniforms.glass.value = view.glass ? 1 : 0;
      renderer.setRenderTarget(post.target);
      renderer.render(scene, camera);
      post.draw();
    },
    strike(ix, upIn, rightIn) { platesBuilt.strike(ix, upIn, rightIn); },
    // Where a world point lands on the canvas, in CSS pixels.
    project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return [((v.x + 1) / 2) * size, ((1 - v.y) / 2) * size]; },
    plateWorld(ix) { const p = course.plates[ix]; return { x: p.lateralYd * YD, y: eyeM + p.riseFt * FT, z: -p.yards * YD }; },
    groundAt,
    resize(px, ratio = dpr) { renderer.setPixelRatio(ratio); renderer.setSize(px, px, false); post.resize(Math.round(px * ratio)); api.size = px; },
    size,
    dispose() { renderer.dispose(); post.dispose(); },
  };
  // project() reads api.size after a resize
  api.project = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [((v.x + 1) / 2) * api.size, ((1 - v.y) / 2) * api.size]; };
  return api;
}

window.RangeDayScene = { create, canDraw, sunPosition, noonElevation, version: VERSION };
