export function registerListCommand(program) {
    program
        .command('list')
        .option('--min-risk <level>', 'low|medium|high', 'low')
        .description('List records by minimum risk (stub)')
        .action(async (opts) => {
        console.log('[list] start (stub)', { opts });
    });
}
//# sourceMappingURL=list.js.map