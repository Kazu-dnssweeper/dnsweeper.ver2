import { Command } from 'commander';

type EchoOptions = {
  newline: boolean; // commander maps --no-newline to newline=false
};

export function registerEchoCommand(program: Command) {
  program
    .command('echo')
    .argument('[text...]', 'text to echo back')
    .option('-n, --no-newline', 'do not output the trailing newline')
    .description('Echo arguments back (debug helper)')
    .action((parts: string[] = [], opts: EchoOptions) => {
      const out = (parts || []).join(' ');
      const suffix = opts?.newline === false ? '' : '\n';
      // Use stdout.write to control newline behavior precisely
      process.stdout.write(out + suffix);
    });
}

