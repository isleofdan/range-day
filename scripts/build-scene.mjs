// Builds public/scene.min.js, the firing line's 3D picture: src/scene/*.mjs
// bundled with the three library by esbuild into one minified script that
// sets window.RangeDayScene. Since range-day-seven the file is not stored
// in the repository: every path that serves or tests the app builds it
// first (npm test and npm run screenshots through package.json's pretest
// and prescreenshots, npm run check and npm run dev through this script,
// the Deploy workflow through npm test, the image in the Dockerfile's
// first stage), and test/terrain.test.js proves a build is served.
// The file is written whole and renamed into place, so a server reading it
// while another build runs never sees a half-written file.
//   npm run build:scene
import { build } from 'esbuild';
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(root, 'public', 'scene.min.js');

// The bundle's text (write: false), or the file written into place (write: true).
export async function sceneBundle({ write = false } = {}) {
  const { version } = JSON.parse(readFileSync(join(root, 'node_modules', 'three', 'package.json'), 'utf8'));
  const out = await build({
    entryPoints: [join(root, 'src', 'scene', 'index.mjs')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    legalComments: 'none',
    banner: { js: `/* Range Day's firing-line picture: src/scene/*.mjs with three ${version} (MIT, three.js authors), built by scripts/build-scene.mjs: window.RangeDayScene */` },
    outfile: OUT,
    write: false,
    logLevel: 'silent',
  });
  const text = out.outputFiles[0].text;
  if (!write) return text;
  const tmp = `${OUT}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, OUT);
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  await sceneBundle({ write: true });
  console.log(`built public/scene.min.js (${statSync(OUT).size} bytes, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
