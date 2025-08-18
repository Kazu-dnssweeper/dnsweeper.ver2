import { Command } from 'commander';
import ora from 'ora';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerImportCommand } from './commands/import.js';
import { registerListCommand } from './commands/list.js';
import { registerExportCommand } from './commands/export.js';
import { registerRulesetCommand } from './commands/ruleset.js';
import { registerAnnotateCommand } from './commands/annotate.js';
import { registerEchoCommand } from './commands/echo.js';
import { registerSweepCommand } from './commands/sweep.js';
import { registerJobsCommand } from './commands/jobs.js';

const program = new Command();

program
  .name('dnsweeper')
  .description('DNSweeper CLI')
  .version('0.0.0');

// Attach commands
registerAnalyzeCommand(program);
registerImportCommand(program);
registerListCommand(program);
registerExportCommand(program);
registerRulesetCommand(program);
registerAnnotateCommand(program);
registerEchoCommand(program);
registerSweepCommand(program);
registerJobsCommand(program);

async function main() {
  const spinner = ora({ text: 'Bootstrapping CLI...', isEnabled: true }).start();
  spinner.stop();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
