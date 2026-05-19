import { isIP } from 'node:net';

export type IpRuleType = 'exact_ip' | 'cidr';

export type BranchIpRule = {
  branchName: string;
  ruleType?: IpRuleType | null;
  ipNetwork: string | null;
  isActive?: number | boolean | null;
};

type ParsedIp = {
  version: 4 | 6;
  bits: 32 | 128;
  value: bigint;
};

type ParsedCidr = ParsedIp & {
  prefix: number;
};

type NormalizeResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const EXACT_IP_ERROR = 'Enter a valid IP address';
const CIDR_ERROR = 'Enter a valid CIDR range, for example 192.168.1.0/24';
const PARTIAL_ERROR = 'Wildcards and partial IPs are not supported';
const ZERO = BigInt(0);
const EIGHT = BigInt(8);
const SIXTEEN = BigInt(16);
const IPV4_OCTET_MASK = BigInt(0xff);
const IPV6_GROUP_MASK = BigInt(0xffff);

function containsUnsupportedPattern(value: string) {
  return value.includes('*') || value.includes('..');
}

function parseIpv4(value: string): ParsedIp | null {
  if (isIP(value) !== 4) {
    return null;
  }

  const octets = value.split('.').map(Number);
  const asNumber = octets.reduce((acc, octet) => (acc << EIGHT) + BigInt(octet), ZERO);

  return {
    version: 4,
    bits: 32,
    value: asNumber,
  };
}

function expandEmbeddedIpv4(value: string) {
  if (!value.includes('.')) {
    return value;
  }

  const lastColon = value.lastIndexOf(':');
  if (lastColon === -1) {
    return value;
  }

  const ipv4Part = value.slice(lastColon + 1);
  const ipv4 = parseIpv4(ipv4Part);
  if (!ipv4) {
    return value;
  }

  const firstGroup = Number((ipv4.value >> SIXTEEN) & IPV6_GROUP_MASK).toString(16);
  const secondGroup = Number(ipv4.value & IPV6_GROUP_MASK).toString(16);
  return `${value.slice(0, lastColon)}:${firstGroup}:${secondGroup}`;
}

function parseIpv6(value: string): ParsedIp | null {
  if (isIP(value) !== 6) {
    return null;
  }

  const expandedIpv4 = expandEmbeddedIpv4(value.toLowerCase());
  const parts = expandedIpv4.split('::');

  if (parts.length > 2) {
    return null;
  }

  const left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(':').filter(Boolean) : [];
  const missingGroups = 8 - left.length - right.length;

  if (missingGroups < 0 || (parts.length === 1 && missingGroups !== 0)) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: parts.length === 2 ? missingGroups : 0 }, () => '0'),
    ...right,
  ];

  if (groups.length !== 8) {
    return null;
  }

  let asNumber = ZERO;
  for (const group of groups) {
    const parsed = Number.parseInt(group, 16);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0xffff) {
      return null;
    }
    asNumber = (asNumber << SIXTEEN) + BigInt(parsed);
  }

  return {
    version: 6,
    bits: 128,
    value: asNumber,
  };
}

function parseIp(value: string): ParsedIp | null {
  const trimmed = value.trim();
  return parseIpv4(trimmed) ?? parseIpv6(trimmed);
}

function parseCidr(value: string): ParsedCidr | null {
  const trimmed = value.trim();
  const separatorIndex = trimmed.lastIndexOf('/');

  if (separatorIndex === -1) {
    return null;
  }

  const address = trimmed.slice(0, separatorIndex);
  const prefixText = trimmed.slice(separatorIndex + 1);
  if (!prefixText || !/^\d+$/.test(prefixText)) {
    return null;
  }

  const parsedIp = parseIp(address);
  if (!parsedIp) {
    return null;
  }

  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > parsedIp.bits) {
    return null;
  }

  return {
    ...parsedIp,
    prefix,
  };
}

function ipv4FromBigInt(value: bigint) {
  return [BigInt(24), SIXTEEN, EIGHT, ZERO]
    .map((shift) => Number((value >> shift) & IPV4_OCTET_MASK))
    .join('.');
}

function ipv6FromBigInt(value: bigint) {
  const groups: string[] = [];
  for (let shift = BigInt(112); shift >= ZERO; shift -= SIXTEEN) {
    groups.push(Number((value >> shift) & IPV6_GROUP_MASK).toString(16));
  }

  return groups.join(':');
}

function normalizeIp(value: string) {
  const parsed = parseIp(value);
  if (!parsed) {
    return null;
  }

  return parsed.version === 4 ? ipv4FromBigInt(parsed.value) : value.trim().toLowerCase();
}

function normalizeCidr(value: string) {
  const parsed = parseCidr(value);
  if (!parsed) {
    return null;
  }

  const hostBits = BigInt(parsed.bits - parsed.prefix);
  const networkValue = hostBits === ZERO ? parsed.value : (parsed.value >> hostBits) << hostBits;
  const address = parsed.version === 4 ? ipv4FromBigInt(networkValue) : ipv6FromBigInt(networkValue);

  return `${address}/${parsed.prefix}`;
}

function isRuleActive(rule: BranchIpRule) {
  return rule.isActive === undefined || rule.isActive === null || rule.isActive === true || rule.isActive === 1;
}

function cidrContains(clientIp: ParsedIp, cidr: ParsedCidr) {
  if (clientIp.version !== cidr.version) {
    return false;
  }

  if (cidr.prefix === 0) {
    return true;
  }

  const hostBits = BigInt(cidr.bits - cidr.prefix);
  return (clientIp.value >> hostBits) === (cidr.value >> hostBits);
}

export function isValidIp(value: string) {
  return !containsUnsupportedPattern(value.trim()) && parseIp(value) !== null;
}

export function isValidCidr(value: string) {
  return !containsUnsupportedPattern(value.trim()) && parseCidr(value) !== null;
}

export function normalizeIpRule(ruleType: IpRuleType, value: string): NormalizeResult {
  const trimmed = value.trim();

  if (!trimmed || containsUnsupportedPattern(trimmed)) {
    return { ok: false, error: containsUnsupportedPattern(trimmed) ? PARTIAL_ERROR : ruleType === 'exact_ip' ? EXACT_IP_ERROR : CIDR_ERROR };
  }

  if (ruleType === 'exact_ip') {
    const normalized = normalizeIp(trimmed);
    return normalized ? { ok: true, value: normalized } : { ok: false, error: EXACT_IP_ERROR };
  }

  const normalized = normalizeCidr(trimmed);
  return normalized ? { ok: true, value: normalized } : { ok: false, error: CIDR_ERROR };
}

export function isIpAllowedForBranch(clientIp: string, branchRules: BranchIpRule[]) {
  const parsedClientIp = parseIp(clientIp);
  if (!parsedClientIp) {
    return { allowed: false as const };
  }

  for (const rule of branchRules) {
    if (!isRuleActive(rule) || !rule.ipNetwork) {
      continue;
    }

    const ruleType = rule.ruleType ?? (rule.ipNetwork.includes('/') ? 'cidr' : 'exact_ip');
    if (ruleType === 'exact_ip') {
      const parsedRuleIp = parseIp(rule.ipNetwork);
      if (
        parsedRuleIp &&
        parsedRuleIp.version === parsedClientIp.version &&
        parsedRuleIp.value === parsedClientIp.value
      ) {
        return { allowed: true as const, branchName: rule.branchName, rule };
      }
      continue;
    }

    const parsedRuleCidr = parseCidr(rule.ipNetwork);
    if (parsedRuleCidr && cidrContains(parsedClientIp, parsedRuleCidr)) {
      return { allowed: true as const, branchName: rule.branchName, rule };
    }
  }

  return { allowed: false as const };
}

export function resolveClientIp(
  headers: Pick<Headers, 'get'>,
  options: { trustForwardedFor?: boolean } = {}
) {
  if (options.trustForwardedFor) {
    const forwardedIp = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwardedIp && isValidIp(forwardedIp)) {
      return forwardedIp;
    }
  }

  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  return 'Unknown';
}

export const ipValidationMessages = {
  exactIp: EXACT_IP_ERROR,
  cidr: CIDR_ERROR,
  partial: PARTIAL_ERROR,
};
