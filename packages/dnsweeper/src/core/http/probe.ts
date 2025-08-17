import { fetch as undiciFetch } from 'undici';
import { ProbeOptions, ProbeResult, RedirectHop, TlsInfo } from './types.js';
import tls from 'node:tls';

function classifyError(e: unknown): ProbeResult['errorType'] {
  const msg = e instanceof Error ? (e as Error).message : String(e);
  if (e instanceof Error && (e.name === 'AbortError' || /aborted|abort/i.test(msg))) return 'timeout';
  if (/ENOTFOUND|dns/i.test(msg)) return 'dns';
  if (/TLS|CERT|ssl/i.test(msg)) return 'tls';
  if (/ECONN|EHOST|ENET|socket/i.test(msg)) return 'net';
  return 'unknown';
}

async function getTlsInfo(hostname: string): Promise<TlsInfo | undefined> {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect({ host: hostname, servername: hostname, port: 443, rejectUnauthorized: false }, () => {
        const alpn = socket.alpnProtocol || undefined;
        const cert = socket.getPeerCertificate();
        const issuer = cert && typeof cert === 'object' ? (cert.issuer && cert.issuer.O) || cert.issuer?.CN : undefined;
        const info: TlsInfo = { alpn, issuer, sni: hostname };
        socket.end();
        resolve(info);
      });
      socket.setTimeout(1500, () => {
        socket.destroy();
        resolve(undefined);
      });
      socket.on('error', () => resolve(undefined));
    } catch {
      resolve(undefined);
    }
  });
}

export async function probeUrl(url: string, opts: ProbeOptions = {}): Promise<ProbeResult> {
  const timeoutMs = Math.max(1, opts.timeoutMs ?? 5000);
  const maxRedirects = Math.max(0, opts.maxRedirects ?? 5);
  const userAgent = opts.userAgent;
  const started = Date.now();
  const history: RedirectHop[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    let redirects = 0;
    // TLS info (best-effort)
    let tlsInfo: TlsInfo | undefined;
    try {
      const u = new URL(current);
      if (u.protocol === 'https:') tlsInfo = await getTlsInfo(u.hostname);
    } catch {}

    // Try HEAD first; fallback to GET on non-2xx or error
    const attempt = async (method: 'HEAD' | 'GET'): Promise<Response> => {
      return (await (undiciFetch as unknown as typeof fetch)(current, {
        method,
        redirect: 'manual',
        headers: userAgent ? { 'user-agent': userAgent } : undefined,
        signal: controller.signal,
      })) as unknown as Response;
    };

    let res: Response | null = null;
    try {
      res = await attempt(opts.method || 'HEAD');
    } catch {
      // retry with GET once
      res = await attempt('GET');
    }

    while (res && res.status >= 300 && res.status < 400 && redirects < maxRedirects) {
      const loc = (res as any).headers?.get?.('location');
      history.push({ url: current, status: (res as any).status });
      if (!loc) break;
      const next = new URL(loc, current).toString();
      current = next;
      redirects += 1;
      res = (await (undiciFetch as unknown as typeof fetch)(current, {
        method: 'GET',
        redirect: 'manual',
        headers: userAgent ? { 'user-agent': userAgent } : undefined,
        signal: controller.signal,
      })) as unknown as Response;
    }

    const elapsedMs = Date.now() - started;
    const status = res ? (res as any).status : undefined;
    const ok = !!status && status < 400;
    const result: ProbeResult = {
      ok,
      status,
      redirects,
      finalUrl: current,
      elapsedMs,
      history,
      tls: tlsInfo,
      errorType: ok ? undefined : status ? (status >= 500 ? 'http5xx' : 'http4xx') : undefined,
    };
    clearTimeout(timer);
    return result;
  } catch (e) {
    const elapsedMs = Date.now() - started;
    clearTimeout(timer);
    return { ok: false, elapsedMs, errorType: classifyError(e) };
  }
}

