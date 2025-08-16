export function registerEchoCommand(program) {
    program
        .command('echo')
        .argument('[text...]', 'text to echo back')
        .option('-n, --no-newline', 'do not output the trailing newline')
        .description('Echo arguments back (debug helper)')
        .action((parts = [], opts) => {
        const out = (parts || []).join(' ');
        const suffix = opts?.newline === false ? '' : '\n';
        // Use stdout.write to control newline behavior precisely
        process.stdout.write(out + suffix);
    });
}
//# sourceMappingURL=echo.js.map