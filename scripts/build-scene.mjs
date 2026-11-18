// Builds public/scene.min.js, the firing line's 3D picture: src/scene/*.mjs
// bundled with the three library by esbuild into one minified script that
// sets window.RangeDayScene. The output is committed (the image does not
// run this); test/scene.test.js builds it again in memory and fails if the
// committed file differs, so it cannot drift from the source or from
// package-lock.json.
//   npm run build:scene
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(root, 'public', 'scene.min.js');

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
    write,
    logLevel: 'silent',
  });
  return write ? null : out.outputFiles[0].text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await sceneBundle({ write: true });
  console.log(`built ${OUT} (${readFileSync(OUT).length} bytes)`);
}
