// Basic IP utilities for private/special-use detection
export function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^([0-9]{1,3})(?:\.([0-9]{1,3})){3}$/);
  if (!m) return false;
  const parts = ip.split('.').map((x) => parseInt(x, 10));
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

export function isSpecialIPv4(ip: string): boolean {
  // RFC 5735/6890 special ranges (subset)
  const parts = ip.split('.').map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 0 || a === 255) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  // fc00::/7 unique local, fe80::/10 link-local, ::1 loopback
  const s = ip.toLowerCase();
  return s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80') || s === '::1';
}

export function mightBePrivateName(domain: string): boolean {
  const d = domain.toLowerCase();
  return d.endsWith('.local') || d.endsWith('.lan') || d.endsWith('.intranet');
}

