import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isIpAllowedForBranch,
  isValidCidr,
  isValidIp,
  normalizeIpRule,
  resolveClientIp,
} from '../src/lib/ipValidation';

test('validates exact IP addresses and rejects partial or wildcard values', () => {
  assert.equal(isValidIp('156.200.10.20'), true);
  assert.equal(isValidIp('2001:db8::1'), true);

  assert.equal(isValidIp('156.200.10'), false);
  assert.equal(isValidIp('abc'), false);
  assert.equal(isValidIp('192.168.1.*'), false);
});

test('validates CIDR ranges and rejects invalid CIDR values', () => {
  assert.equal(isValidCidr('192.168.1.0/24'), true);
  assert.equal(isValidCidr('10.0.0.0/8'), true);
  assert.equal(isValidCidr('172.16.0.0/12'), true);
  assert.equal(isValidCidr('2001:db8::/32'), true);

  assert.equal(isValidCidr('192.168.1.0'), false);
  assert.equal(isValidCidr('192.168.1.0/33'), false);
  assert.equal(isValidCidr('2001:db8::/129'), false);
  assert.equal(isValidCidr('192.168.1.*'), false);
});

test('normalizes exact IP and CIDR rules', () => {
  assert.deepEqual(normalizeIpRule('exact_ip', ' 156.200.10.20 '), {
    ok: true,
    value: '156.200.10.20',
  });

  assert.deepEqual(normalizeIpRule('cidr', ' 156.200.10.45/24 '), {
    ok: true,
    value: '156.200.10.0/24',
  });

  assert.deepEqual(normalizeIpRule('exact_ip', '192.168.1.*'), {
    ok: false,
    error: 'Wildcards and partial IPs are not supported',
  });

  assert.deepEqual(normalizeIpRule('cidr', '192.168.1'), {
    ok: false,
    error: 'Enter a valid CIDR range, for example 192.168.1.0/24',
  });
});

test('matches exact IP rules only by exact client IP', () => {
  const rules = [
    {
      branchName: 'HQ',
      ruleType: 'exact_ip' as const,
      ipNetwork: '156.200.10.20',
      isActive: 1,
    },
  ];

  assert.deepEqual(isIpAllowedForBranch('156.200.10.20', rules), {
    allowed: true,
    branchName: 'HQ',
    rule: rules[0],
  });
  assert.deepEqual(isIpAllowedForBranch('156.200.10.21', rules), { allowed: false });
});

test('matches IPv4 and IPv6 CIDR rules by network containment', () => {
  const rules = [
    {
      branchName: 'HQ',
      ruleType: 'cidr' as const,
      ipNetwork: '156.200.10.0/24',
      isActive: 1,
    },
    {
      branchName: 'IPv6 Branch',
      ruleType: 'cidr' as const,
      ipNetwork: '2001:db8::/32',
      isActive: 1,
    },
  ];

  assert.equal(isIpAllowedForBranch('156.200.10.20', rules).allowed, true);
  assert.deepEqual(isIpAllowedForBranch('156.200.11.20', rules), { allowed: false });
  assert.equal(isIpAllowedForBranch('2001:db8::1', rules).allowed, true);
  assert.deepEqual(isIpAllowedForBranch('2001:db9::1', rules), { allowed: false });
});

test('ignores inactive and invalid stored rules', () => {
  const rules = [
    {
      branchName: 'HQ',
      ruleType: 'exact_ip' as const,
      ipNetwork: '156.200.10.20',
      isActive: 0,
    },
    {
      branchName: 'HQ',
      ruleType: 'cidr' as const,
      ipNetwork: '192.168.1.*',
      isActive: 1,
    },
  ];

  assert.deepEqual(isIpAllowedForBranch('156.200.10.20', rules), { allowed: false });
  assert.deepEqual(isIpAllowedForBranch('192.168.1.20', rules), { allowed: false });
});

test('resolves client IP without trusting X-Forwarded-For by default', () => {
  const headers = new Headers({
    'x-real-ip': '10.0.0.45',
    'x-forwarded-for': '203.0.113.99',
  });

  assert.equal(resolveClientIp(headers), '10.0.0.45');
  assert.equal(resolveClientIp(headers, { trustForwardedFor: true }), '203.0.113.99');
});
