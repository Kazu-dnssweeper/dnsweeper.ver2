import fs from 'node:fs';

export async function writeJson(
  records: unknown[],
  file: string,
  pretty = false
) {
  const space = pretty ? 2 : 0;
  const json = JSON.stringify(records, null, space);
  await fs.promises.writeFile(file, json, 'utf8');
}

