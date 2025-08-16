import { Command } from 'commander';

export function registerAnnotateCommand(program: Command) {
  program
    .command('annotate')
    .description('Annotate records (stub)')
    .action(async () => {
      // eslint-disable-next-line no-console
      console.log('annotate: not implemented yet');
    });
}

