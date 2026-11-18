// The last pass over the picture: heat shimmer (a distortion that grows
// with distance, temperature and magnification, leaning with the wind) and,
// through glass, the scope's look (a soft warm rim, a little softness and
// lower contrast, bleached highlights). The scene is drawn to a texture
// with its depth; this pass draws that texture to the screen.
import * as THREE from 'three';

export function makePost({ renderer, size, look }) {
  const target = new THREE.WebGLRenderTarget(size, size, { depthTexture: new THREE.DepthTexture(size, size, THREE.UnsignedIntType), samples: 0 });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    tex: { value: target.texture }, depth: { value: target.depthTexture },
    time: { value: 0 }, shimmer: { value: 0 }, lean: { value: 0 }, px: { value: 1 / size },
    glass: { value: 0 }, rim: { value: new THREE.Color(look.glass.rimColor) }, rimShare: { value: look.glass.rimShare },
    softness: { value: look.glass.softness }, contrast: { value: look.glass.contrast }, bleach: { value: look.glass.bleach }, wash: { value: look.glass.wash },
    near: { value: 0.3 }, far: { value: 12000 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      precision highp float;
      uniform sampler2D tex; uniform sampler2D depth;
      uniform float time, shimmer, lean, px, glass, rimShare, softness, contrast, bleach, wash, near, far;
      uniform vec3 rim;
      varying vec2 vUv;
      float linDepth(vec2 uv) { float z = texture2D(depth, uv).r * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
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
        vec4 c = texture2D(tex, uv);
        if (glass > 0.0) {
          vec4 s = c;
          float k = softness * 1.3 * px;
          s += texture2D(tex, uv + vec2(k, 0.0)) + texture2D(tex, uv - vec2(k, 0.0)) + texture2D(tex, uv + vec2(0.0, k)) + texture2D(tex, uv - vec2(0.0, k));
          s += texture2D(tex, uv + vec2(k, k)) + texture2D(tex, uv - vec2(k, k)) + texture2D(tex, uv + vec2(k, -k)) + texture2D(tex, uv - vec2(k, -k));
          c = mix(c, s / 9.0, glass);
          c.rgb = mix(c.rgb, (c.rgb - 0.5) * contrast + 0.5 + 0.03, glass);
          float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          c.rgb = mix(c.rgb, mix(c.rgb, vec3(1.0), smoothstep(0.55, 1.0, lum) * bleach), glass);
          // strong colours wash toward the light through the glass (the red paint goes toward pink)
          c.rgb = mix(c.rgb, mix(c.rgb, vec3(lum) * 1.08 + 0.06, wash), glass);
          float r = length(vUv - 0.5) * 2.0;
          float edge = smoothstep(1.0 - rimShare * 1.6, 1.0 - rimShare * 0.1, r);
          c.rgb = mix(c.rgb, rim * 0.9, edge * glass * 0.85);
          c.rgb = mix(c.rgb, vec3(0.0), smoothstep(0.985, 1.0, r) * glass);
        }
        gl_FragColor = c;
      }`,
    depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  return {
    target, uniforms,
    resize(px) { target.setSize(px, px); uniforms.px.value = 1 / px; },
    draw() { renderer.setRenderTarget(null); renderer.render(scene, cam); },
    dispose() { target.dispose(); mat.dispose(); },
  };
}
