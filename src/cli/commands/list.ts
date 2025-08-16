import { Command } from 'commander';

export function registerListCommand(program: Command) {
  program
    .command('list')
    .option('--min-risk <level>', 'low|medium|high', 'low')
    .description('List records by minimum risk (stub)')
    .action(async (opts: Record<string, unknown>) => {
      console.log('[list] start (stub)', { opts });
    });
}
