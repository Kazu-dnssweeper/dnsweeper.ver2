import { Command } from 'commander';

export function registerRulesetCommand(program: Command) {
  program
    .command('ruleset')
    .description('Manage rulesets (stub)')
    .action(async () => {
      // eslint-disable-next-line no-console
      console.log('ruleset: not implemented yet');
    });
}

