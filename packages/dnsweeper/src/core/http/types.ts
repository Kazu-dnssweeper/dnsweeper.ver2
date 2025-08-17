export type ProbeOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  method?: 'HEAD' | 'GET';
  userAgent?: string;
};

export type RedirectHop = { url: string; status?: number };

export type TlsInfo = {
  alpn?: string;
  issuer?: string;
  sni?: string;
};

export type ProbeResult = {
  ok: boolean;
  status?: number;
  redirects?: number;
  finalUrl?: string;
  elapsedMs: number;
  history?: RedirectHop[];
  tls?: TlsInfo;
  errorType?: 'timeout' | 'dns' | 'tls' | 'net' | 'http4xx' | 'http5xx' | 'unknown';
};

