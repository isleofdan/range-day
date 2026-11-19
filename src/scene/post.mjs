// The last pass over the picture. The scene is drawn to a texture in linear
// light (half-float where the browser has it) with its depth; this pass
// draws that texture to the screen: the air (things pale toward the sky's
// colour with their true distance and brighten toward the sun), heat
// shimmer (a distortion that grows with distance, temperature and
// magnification, leaning with the wind), through glass the scope's look (a
// round picture, a soft warm rim, a little softness only toward the edge, a
// touch of colour fringe at the edge, modest bleaching), then the camera's
// exposure and tone curve and the screen's colour space.
import * as THREE from 'three';

export function makePost({ renderer, size, look, samples = 0, halfFloat = true }) {
  const type = halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const target = new THREE.WebGLRenderTarget(size, size, { type, depthTexture: new THREE.DepthTexture(size, size, THREE.UnsignedIntType), samples, depthBuffer: true, stencilBuffer: false });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    tex: { value: target.texture }, depth: { value: target.depthTexture },
    time: { value: 0 }, shimmer: { value: 0 }, lean: { value: 0 }, px: { value: 1 / size },
    glass: { value: 0 }, rim: { value: new THREE.Color(look.glass.rimColor) }, rimShare: { value: look.glass.rimShare },
    softness: { value: look.glass.softness }, contrast: { value: look.glass.contrast }, bleach: { value: look.glass.bleach }, wash: { value: look.glass.wash }, fringe: { value: look.glass.fringe ?? 0 },
    near: { value: 0.3 }, far: { value: 12000 },
    // the air: its colour (linear light), its brightness, the distance at which it hides the ground, and the sun's direction in the view
    airCol: { value: new THREE.Color(0.5, 0.6, 0.7) }, airBright: { value: 0.4 }, airDist: { value: 30000 }, sunGlow: { value: 0.9 }, sunGlowWidth: { value: 6 },
    camRight: { value: new THREE.Vector3(1, 0, 0) }, camUp: { value: new THREE.Vector3(0, 1, 0) }, camFwd: { value: new THREE.Vector3(0, 0, -1) }, tanHalf: { value: 0.05 }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tex; uniform sampler2D depth;
      uniform float time, shimmer, lean, px, glass, rimShare, softness, contrast, bleach, wash, fringe, near, far, airBright, airDist, sunGlow, sunGlowWidth, tanHalf;
      uniform vec3 rim, airCol, camRight, camUp, camFwd, sunDir;
      varying vec2 vUv;
      float linDepth(vec2 uv) { float z = texture2D(depth, uv).r * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
      vec3 pick(vec2 uv) { return texture2D(tex, uv).rgb; }
      void main() {
        vec2 uv = vUv;
        if (shimmer > 0.0) {
          float d = clamp(linDepth(uv) / 900.0, 0.0, 1.5);
          float a = shimmer * d;
          float w1 = sin(uv.y * 140.0 + time * 5.0 + uv.x * 30.0 + lean * uv.y * 20.0);
          float w2 = sin(uv.y * 90.0 - time * 3.7 + uv.x * 70.0 + lean * uv.y * 35.0);
          uv.y += (w1 * 0.55 + w2 * 0.45) * a;
          uv.x += (w2 * 0.3 + w1 * 0.2) * a * (0.4 + 0.6 * lean);
        }
        float r = length(vUv - 0.5) * 2.0;
        vec3 c;
        if (glass > 0.0) {
          // a little softness only toward the edge of the glass, and a touch of colour fringe there
          float edgeK = smoothstep(0.35, 1.0, r);
          float k = softness * 1.4 * px * edgeK;
          vec2 toC = (uv - 0.5) * fringe * edgeK * px * 4.0;
          vec3 s = vec3(pick(uv + toC).r, pick(uv).g, pick(uv - toC).b);
          s += pick(uv + vec2(k, 0.0)) + pick(uv - vec2(k, 0.0)) + pick(uv + vec2(0.0, k)) + pick(uv - vec2(0.0, k));
          c = s / 5.0;
        } else {
          c = pick(uv);
        }
        // the air, by the true distance of what is seen (the sky, at the far plane, is left as the sky model drew it)
        float dist = linDepth(uv);
        if (dist < far * 0.9) {
          vec2 ndc = vUv * 2.0 - 1.0;
          vec3 view = normalize(camFwd + camRight * ndc.x * tanHalf + camUp * ndc.y * tanHalf);
          float toward = max(dot(view, sunDir), 0.0);
          vec3 air = airCol * airBright * (1.0 + sunGlow * pow(toward, sunGlowWidth));
          float t = 1.0 - exp(-dist * 3.912 / airDist);
          c = mix(c, air, t);
        }
        if (glass > 0.0) {
          // the glass: contrast and colour kept in the middle; strong light bleaches modestly; the warm rim; black beyond the circle
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, (c - lum) * contrast + lum, glass);
          c = mix(c, mix(c, vec3(lum) * 1.05 + 0.02, wash * smoothstep(0.3, 1.5, lum)), glass);
          c = mix(c, c + vec3(1.0) * bleach * smoothstep(0.8, 2.5, lum), glass);
          float edge = smoothstep(1.0 - rimShare * 1.6, 1.0 - rimShare * 0.1, r);
          c = mix(c, rim * 0.35, edge * glass * 0.85);
          c = mix(c, vec3(0.0), smoothstep(0.985, 1.0, r) * glass);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const v = new THREE.Vector3();
  return {
    target, uniforms,
    resize(px) { target.setSize(px, px); uniforms.px.value = 1 / px; },
    // the camera's frame, for the air's view toward the sun
    setCamera(camera) {
      camera.updateMatrixWorld();
      const m = camera.matrixWorld;
      uniforms.camRight.value.set(m.elements[0], m.elements[1], m.elements[2]).normalize();
      uniforms.camUp.value.set(m.elements[4], m.elements[5], m.elements[6]).normalize();
      uniforms.camFwd.value.set(-m.elements[8], -m.elements[9], -m.elements[10]).normalize();
      uniforms.tanHalf.value = Math.tan((camera.fov * Math.PI) / 360);
      uniforms.near.value = camera.near; uniforms.far.value = camera.far;
    },
    draw() { renderer.setRenderTarget(null); renderer.render(scene, cam); },
    dispose() { target.dispose(); mat.dispose(); },
  };
}
