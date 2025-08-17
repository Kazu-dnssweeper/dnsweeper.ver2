import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
export const ConfigSchema = z.object({
    // Reserved for future use (M1: read-only placeholder)
    defaultTtl: z.number().int().positive().optional(),
});
const candidates = ['dnsweeper.config.json'];
export async function loadConfig(cwd = process.cwd()) {
    for (const f of candidates) {
        const p = path.join(cwd, f);
        try {
            const raw = await fs.promises.readFile(p, 'utf8');
            const json = JSON.parse(raw);
            return ConfigSchema.parse(json);
        }
        catch {
            // ignore and continue
        }
    }
    return null;
}
//# sourceMappingURL=schema.js.map