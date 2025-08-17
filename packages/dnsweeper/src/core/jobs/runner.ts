export type ProgressStats = {
  processed: number;
  total: number;
  qps: number;
  avgLatencyMs: number;
  failRate: number; // 0..1
  etaSec: number;
  elapsedSec: number;
  failed: number;
};

type RunnerOptions = {
  quiet?: boolean;
  intervalMs?: number;
  printer?: (s: ProgressStats) => void;
};

export class JobRunner {
  private total: number;
  private opts: RunnerOptions;
  private startedAt = 0;
  private processed = 0;
  private failed = 0;
  private sumLatency = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(total: number, opts: RunnerOptions = {}) {
    this.total = Math.max(0, total | 0);
    this.opts = opts;
  }

  start() {
    this.startedAt = Date.now();
    if (!this.opts.quiet) {
      const iv = Math.max(200, this.opts.intervalMs ?? 1000);
      this.timer = setInterval(() => this.print(), iv);
    }
  }

  update(latencyMs: number, failed: boolean) {
    this.processed += 1;
    this.sumLatency += Math.max(0, latencyMs | 0);
    if (failed) this.failed += 1;
  }

  private nowStats(): ProgressStats {
    const elapsedMs = Math.max(1, Date.now() - this.startedAt);
    const elapsedSec = elapsedMs / 1000;
    const qps = this.processed / elapsedSec;
    const avgLatencyMs = this.processed > 0 ? this.sumLatency / this.processed : 0;
    const remain = Math.max(0, this.total - this.processed);
    const etaSec = qps > 0 ? remain / qps : 0;
    const failRate = this.processed > 0 ? this.failed / this.processed : 0;
    return { processed: this.processed, total: this.total, qps, avgLatencyMs, failRate, etaSec, elapsedSec, failed: this.failed };
  }

  getStats(): ProgressStats {
    return this.nowStats();
  }

  private print() {
    const s = this.nowStats();
    const line = `[progress] ${s.processed}/${s.total} qps=${s.qps.toFixed(2)} avg_ms=${s.avgLatencyMs.toFixed(0)} fails=${s.failed} eta_s=${s.etaSec.toFixed(0)}`;
    if (this.opts.printer) this.opts.printer(s);
    // eslint-disable-next-line no-console
    else console.error(line);
  }

  done() {
    if (this.timer) clearInterval(this.timer);
    if (!this.opts.quiet) this.print();
  }
}

