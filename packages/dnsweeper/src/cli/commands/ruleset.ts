import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';

async function ensureDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function listFiles(dir: string) {
  try {
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    return items.filter((i) => i.isFile()).map((i) => i.name);
  } catch {
    return [] as string[];
  }
}

export function registerRulesetCommand(program: Command) {
  const cmd = program.command('ruleset').description('Manage rulesets');

  cmd
    .command('list')
    .option('--dir <path>', 'ruleset directory', '.tmp/rulesets')
    .description('List available rulesets')
    .action(async (opts: { dir: string }) => {
      const dir = opts.dir || '.tmp/rulesets';
      const files = await listFiles(dir);
      if (!files.length) {
        // eslint-disable-next-line no-console
        console.log('(no rulesets)');
        return;
      }
      // eslint-disable-next-line no-console
      console.log(files.join('\n'));
    });

  cmd
    .command('add')
    .argument('<name>', 'ruleset name')
    .argument('<file>', 'source JSON file')
    .option('--dir <path>', 'ruleset directory', '.tmp/rulesets')
    .description('Add a ruleset file by name')
    .action(async (name: string, file: string, opts: { dir: string }) => {
      const dir = opts.dir || '.tmp/rulesets';
      await ensureDir(dir);
      const dst = path.join(dir, `${name}.json`);
      const buf = await fs.promises.readFile(file);
      // Basic validation: ensure JSON parses
      JSON.parse(buf.toString('utf8'));
      await fs.promises.writeFile(dst, buf);
      // eslint-disable-next-line no-console
      console.log(`added: ${dst}`);
    });

  cmd
    .command('version')
    .option('--dir <path>', 'ruleset directory', '.tmp/rulesets')
    .description('Show ruleset set version (count + latest mtime)')
    .action(async (opts: { dir: string }) => {
      const dir = opts.dir || '.tmp/rulesets';
      const files = await listFiles(dir);
      let latest = 0;
      for (const f of files) {
        const s = await fs.promises.stat(path.join(dir, f));
        latest = Math.max(latest, s.mtimeMs);
      }
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          { count: files.length, latest: latest ? new Date(latest).toISOString() : null },
          null,
          0
        )
      );
    });

  cmd
    .command('validate')
    .argument('<file>', 'ruleset JSON file to validate')
    .description('Validate a ruleset JSON file against schema')
    .action(async (file: string) => {
      try {
        const raw = await fs.promises.readFile(file, 'utf8');
        const { RulesetSchema } = await import('../../core/rules/engine.js');
        const json = JSON.parse(raw);
        (RulesetSchema as any).parse(json);
        // eslint-disable-next-line no-console
        console.log('OK');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(msg);
        process.exit(1);
      }
    });

  // Weights/disable via config overlay
  cmd
    .command('weights')
    .description('Adjust rule weights/disable via dnsweeper.config.json')
    .option('--set <pairs...>', 'Set weights like R-003=10 R-005=20')
    .option('--off <rules...>', 'Disable rules by ID (e.g., R-007 R-010)')
    .option('--on <rules...>', 'Enable rules by ID (remove from disabled)')
    .action(async (opts: { set?: string[]; off?: string[]; on?: string[] }) => {
      const cfgPath = path.join(process.cwd(), 'dnsweeper.config.json');
      let cfg: any = {};
      try { cfg = JSON.parse(await fs.promises.readFile(cfgPath, 'utf8')); } catch {}
      cfg.risk = cfg.risk || {};
      cfg.risk.rules = cfg.risk.rules || {};
      cfg.risk.rules.weights = cfg.risk.rules.weights || {};
      cfg.risk.rules.disabled = cfg.risk.rules.disabled || [];
      if (Array.isArray(opts.set)) {
        // load known RULES for validation
        let KNOWN: Set<string> = new Set();
        try {
          const mod = await import('../../core/risk/rules.js');
          const RULES: Record<string, unknown> = (mod as any).RULES || {};
          KNOWN = new Set(Object.keys(RULES));
        } catch {}
        for (const p of opts.set) {
          const [k, v] = String(p).split('=');
          const num = Number(v);
          if (!/^R-\d{3}$/.test(k) || !isFinite(num) || Math.abs(num) > 100) {
            // eslint-disable-next-line no-console
            console.error(`invalid weight pair: ${p}`);
            process.exit(1);
          }
          if (KNOWN.size && !KNOWN.has(k)) {
            // eslint-disable-next-line no-console
            console.error(`unknown rule id: ${k}`);
            process.exit(1);
          }
          cfg.risk.rules.weights[k] = num;
        }
      }
      const set = new Set<string>(cfg.risk.rules.disabled);
      if (Array.isArray(opts.off)) for (const r of opts.off) set.add(String(r));
      if (Array.isArray(opts.on)) for (const r of opts.on) set.delete(String(r));
      cfg.risk.rules.disabled = Array.from(set.values());
      await fs.promises.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
      // eslint-disable-next-line no-console
      console.log(`updated: ${cfgPath}`);
    });
}
