import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerAnalyzeCommand } from '../../src/cli/commands/analyze.js';
import { registerSweepCommand } from '../../src/cli/commands/sweep.js';

describe('CLI numeric option validation', () => {
  it('rejects invalid analyze concurrency', async () => {
    const program = new Command();
    program.exitOverride();
    registerAnalyzeCommand(program);
    await expect(program.parseAsync(['analyze', '--concurrency', '0', 'input.csv'], { from: 'user' }))
      .rejects.toHaveProperty('code', 'commander.invalidArgument');
  });

  it('rejects invalid analyze qps', async () => {
    const program = new Command();
    program.exitOverride();
    registerAnalyzeCommand(program);
    await expect(program.parseAsync(['analyze', '--qps', '-1', 'input.csv'], { from: 'user' }))
      .rejects.toHaveProperty('code', 'commander.invalidArgument');
  });

  it('rejects sweep plan min-confidence > 1', async () => {
    const program = new Command();
    program.exitOverride();
    registerSweepCommand(program);
    await expect(program.parseAsync(['sweep', 'plan', '--min-confidence', '2', 'input.json'], { from: 'user' }))
      .rejects.toHaveProperty('code', 'commander.invalidArgument');
  });

  it('rejects sweep plan negative max-items', async () => {
    const program = new Command();
    program.exitOverride();
    registerSweepCommand(program);
    await expect(program.parseAsync(['sweep', 'plan', '--max-items', '-5', 'input.json'], { from: 'user' }))
      .rejects.toHaveProperty('code', 'commander.invalidArgument');
  });
});
