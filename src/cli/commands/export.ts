import { Command } from 'commander';

export function registerExportCommand(program: Command) {
  program
    .command('export')
    .description('Export results (stub)')
    .action(async () => {
      // eslint-disable-next-line no-console
      console.log('export: not implemented yet');
    });
}

