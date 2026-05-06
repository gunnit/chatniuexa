/**
 * SSRF protection helpers for routes that fetch user-supplied URLs.
 *
 * Rejects:
 *  - Schemes other than http/https
 *  - Hostnames that resolve to loopback / private / link-local addresses
 *  - Common private hostname patterns (localhost, *.local, *.internal)
 *
 * Used by the URL data-source ingestion flow.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /\.local(host)?$/i,
  /\.internal$/i,
  /^metadata\./i,
]

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 0) return true
  if (a >= 224) return true // multicast / reserved
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true
  // ::ffff:127.0.0.1 (IPv4-mapped)
  if (lower.startsWith('::ffff:')) {
    return isPrivateIPv4(lower.slice(7))
  }
  return false
}

export class UnsafeUrlError extends Error {
  constructor(reason: string) {
    super(`Unsafe URL: ${reason}`)
    this.name = 'UnsafeUrlError'
  }
}

/**
 * Throws UnsafeUrlError if the URL is not safe to fetch.
 * Performs DNS resolution to catch hostnames that point at private IPs.
 */
export async function assertSafePublicUrl(input: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new UnsafeUrlError('malformed URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(`scheme ${url.protocol} not allowed`)
  }

  const hostname = url.hostname.toLowerCase()
  if (!hostname) {
    throw new UnsafeUrlError('missing hostname')
  }

  for (const pattern of PRIVATE_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new UnsafeUrlError(`hostname ${hostname} is private`)
    }
  }

  // If hostname is already an IP literal, validate without DNS.
  const ipKind = isIP(hostname)
  if (ipKind === 4 && isPrivateIPv4(hostname)) {
    throw new UnsafeUrlError(`IP ${hostname} is private`)
  }
  if (ipKind === 6 && isPrivateIPv6(hostname)) {
    throw new UnsafeUrlError(`IP ${hostname} is private`)
  }
  if (ipKind !== 0) return url

  // Resolve all addresses for the hostname; reject if ANY is private (defends
  // against DNS responses that include both public and private records).
  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new UnsafeUrlError(`hostname ${hostname} did not resolve`)
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new UnsafeUrlError(`hostname ${hostname} resolves to private IP ${address}`)
    }
    if (family === 6 && isPrivateIPv6(address)) {
      throw new UnsafeUrlError(`hostname ${hostname} resolves to private IPv6 ${address}`)
    }
  }

  return url
}
