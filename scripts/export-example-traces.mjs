import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleSources, loadExampleProgram, simulate } from '../simulator/dist/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'examples', 'traces');
mkdirSync(outDir, { recursive: true });

for (const key of Object.keys(exampleSources)) {
  const result = simulate(loadExampleProgram(key), { blockDim: key === 'branchDivergence' ? 8 : 6, coreCount: 2 });
  const filename = `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.trace.json`;
  writeFileSync(join(outDir, filename), `${JSON.stringify(result.trace, null, 2)}\n`);
}
