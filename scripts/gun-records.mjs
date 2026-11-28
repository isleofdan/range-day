// range-day-fifteen step 2: the rifles' gun records exactly as lib/guns.js's toRecord makes them from
// data/rifles.json, printed in the shape the Spine tool import_records takes ({ records: [{ type, name, fields }] }),
// so the records written to the Spine are never retyped by hand.
//   npm run gun-records                 every rifle in data/rifles.json
//   npm run gun-records -- <id> <id>    only these (range-day-nineteen: the four new expansion rifles' records are written
//                                       alone, so the seven records already in the Spine, with their other sections, are not
//                                       sent again); an id not in the file stops it with the valid ids
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('../lib/data');
const guns = require('../lib/guns');

const { raw } = data.load();
const all = Object.keys(raw.rifles).filter((id) => !id.startsWith('_'));
const only = process.argv.slice(2);
for (const id of only) if (!all.includes(id)) { process.stderr.write(`gun-records: '${id}' is not in data/rifles.json: ${all.join(', ')}\n`); process.exit(1); }
const records = (only.length ? all.filter((id) => only.includes(id)) : all)
  .map((id) => guns.toRecord(id, raw.rifles[id]))
  .map((r) => ({ type: 'gun', name: r.name, fields: r.fields }));
process.stdout.write(JSON.stringify({ records }) + '\n');
