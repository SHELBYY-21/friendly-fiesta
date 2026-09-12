import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(root, 'src/lib/bankBrands.ts'), 'utf8');
const required = ['KBANK', 'SCB', 'KTB', 'BBL', 'BAY', 'TTB', 'GSB', 'BAAC', 'CIMB', 'UOB', 'LH', 'KKP', 'UNKNOWN'];
for (const code of required) {
  if (!source.includes(`${code}:`)) throw new Error(`Missing bank registry entry: ${code}`);
}
const assetMatches = [...source.matchAll(/localAsset: MARK\('([^']+)'\)/g)].map((match) => match[1]);
if (assetMatches.length < required.length) throw new Error('Each catalog bank needs a presentation mark');
for (const slug of assetMatches) {
  await access(resolve(root, 'public/banks', `${slug}.svg`));
  await access(resolve(root, 'assets/banks', `${slug}.svg`));
}
if (source.includes("officialSource: '")) throw new Error('Do not claim official trademark provenance for presentation marks');
console.log(`Bank registry valid; ${assetMatches.length} presentation marks on disk.`);
