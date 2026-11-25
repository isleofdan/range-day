// range-day-fifteen step 2: the seven rifles' gun records exactly as lib/guns.js's toRecord makes them from
// data/rifles.json, printed in the shape the Spine tool import_records takes ({ records: [{ type, name, fields }] }),
// so the records written to the Spine are never retyped by hand.
//   npm run gun-records
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('../lib/data');
const guns = require('../lib/guns');

const { raw } = data.load();
const records = Object.entries(raw.rifles).filter(([id]) => !id.startsWith('_'))
  .map(([id, entry]) => guns.toRecord(id, entry))
  .map((r) => ({ type: 'gun', name: r.name, fields: r.fields }));
process.stdout.write(JSON.stringify({ records }) + '\n');
