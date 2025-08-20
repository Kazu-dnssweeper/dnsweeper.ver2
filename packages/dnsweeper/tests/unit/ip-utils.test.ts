import { describe, it, expect } from 'vitest';
import { isPrivateIPv4, isSpecialIPv4, isPrivateIPv6, mightBePrivateName } from '../../src/core/net/ip.js';

describe('IP utilities', () => {
  describe('isPrivateIPv4', () => {
    it('returns true for private IPv4 ranges', () => {
      expect(isPrivateIPv4('10.0.0.1')).toBe(true);
      expect(isPrivateIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('169.254.1.1')).toBe(true);
    });

    it('returns false for public IPv4 addresses', () => {
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateIPv4('172.32.0.1')).toBe(false);
      expect(isPrivateIPv4('256.0.0.1')).toBe(false);
    });
  });

  describe('isSpecialIPv4', () => {
    it('returns true for special IPv4 ranges', () => {
      expect(isSpecialIPv4('0.0.0.0')).toBe(true);
      expect(isSpecialIPv4('255.255.255.255')).toBe(true);
      expect(isSpecialIPv4('100.64.0.1')).toBe(true);
    });

    it('returns false for normal IPv4 addresses', () => {
      expect(isSpecialIPv4('8.8.8.8')).toBe(false);
      expect(isSpecialIPv4('100.63.0.1')).toBe(false);
    });
  });

  describe('isPrivateIPv6', () => {
    it('returns true for private IPv6 ranges', () => {
      expect(isPrivateIPv6('fc00::1')).toBe(true);
      expect(isPrivateIPv6('FD00::1')).toBe(true);
      expect(isPrivateIPv6('fe80::1234')).toBe(true);
      expect(isPrivateIPv6('::1')).toBe(true);
    });

    it('returns false for public IPv6 addresses', () => {
      expect(isPrivateIPv6('2001:4860:4860::8888')).toBe(false);
      expect(isPrivateIPv6('2001:db8::1')).toBe(false);
    });
  });

  describe('mightBePrivateName', () => {
    it('returns true for private-like hostnames', () => {
      expect(mightBePrivateName('example.local')).toBe(true);
      expect(mightBePrivateName('foo.LAN')).toBe(true);
      expect(mightBePrivateName('bar.intranet')).toBe(true);
    });

    it('returns false for public-looking hostnames', () => {
      expect(mightBePrivateName('example.com')).toBe(false);
      expect(mightBePrivateName('lantern.net')).toBe(false);
      expect(mightBePrivateName('localdomain')).toBe(false);
    });
  });
});

