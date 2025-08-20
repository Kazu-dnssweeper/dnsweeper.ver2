import { describe, it, expect, beforeEach, vi } from 'vitest';
import { probeUrl } from '../../src/core/http/probe.js';

const hoisted = vi.hoisted(() => {
  return {
    fetchMock: vi.fn(),
    tlsConnectMock: vi.fn(),
  };
});
const fetchMock = hoisted.fetchMock;
const tlsConnectMock = hoisted.tlsConnectMock;

vi.mock('../../src/core/http/fetch.js', () => ({ fetchWrapper: (hoisted as any).fetchMock }));
vi.mock('node:tls', () => ({
  default: { connect: (hoisted as any).tlsConnectMock },
  connect: (hoisted as any).tlsConnectMock,
}));

function makeRes(status: number, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] },
  } as any;
}

function mockTls() {
  tlsConnectMock.mockImplementation((_opts: any, cb: any) => {
    const socket: any = {
      alpnProtocol: 'h2',
      getPeerCertificate: () => ({ issuer: { O: 'TestCA' } }),
      setTimeout: (_ms: number, _fn: any) => {},
      on: (_ev: string, _fn: any) => {},
      end: () => {},
    };
    setTimeout(() => cb(), 0);
    return socket;
  });
}

describe('probeUrl', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    tlsConnectMock.mockReset();
  });

  it('returns ok for 200', async () => {
    mockTls();
    fetchMock.mockResolvedValueOnce(makeRes(200));
    const r = await probeUrl('https://example.com');
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.tls).toBeDefined();
  });

  it('follows redirects', async () => {
    mockTls();
    fetchMock
      .mockResolvedValueOnce(makeRes(302, { location: 'https://b.test' }))
      .mockResolvedValueOnce(makeRes(200));
    const r = await probeUrl('https://a.test');
    expect(r.redirects).toBe(1);
    expect(r.finalUrl.replace(/\/$/, '')).toBe('https://b.test');
  });

  it('falls back to GET when HEAD fails', async () => {
    mockTls();
    fetchMock
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeRes(200));
    const r = await probeUrl('https://example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(true);
  });

  it('classifies network errors', async () => {
    mockTls();
    fetchMock
      .mockRejectedValueOnce(new Error('ENOTFOUND host'))
      .mockRejectedValueOnce(new Error('ENOTFOUND host'));
    const r = await probeUrl('https://missing.test');
    expect(r.ok).toBe(false);
    expect(r.errorType).toBe('dns');
  });

  it('classifies http 5xx responses', async () => {
    mockTls();
    fetchMock.mockResolvedValueOnce(makeRes(503));
    const r = await probeUrl('https://example.com');
    expect(r.ok).toBe(false);
    expect(r.errorType).toBe('http5xx');
  });
});
