import type { AppConfig } from './schema.js';
import { loadConfig } from './schema.js';

export class ConfigService {
  private cfg: AppConfig | null = null;

  async load(cwd = process.cwd()): Promise<AppConfig | null> {
    if (!this.cfg) {
      this.cfg = await loadConfig(cwd);
    }
    return this.cfg;
  }

  get(): AppConfig | null {
    return this.cfg;
  }
}

