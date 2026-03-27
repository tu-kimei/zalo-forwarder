/**
 * Cookie structure matching the Python implementation.
 * Cookies are stored as JSON array of objects with name, value, domain, path.
 */
export interface ZaloCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

/**
 * Extract cookies from a fetch Response's set-cookie headers.
 * Returns an array of ZaloCookie objects.
 */
export function extractCookies(response: Response, defaultDomain: string): ZaloCookie[] {
  const cookies: ZaloCookie[] = [];
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  for (const header of setCookieHeaders) {
    const parts = header.split(';').map(p => p.trim());
    if (parts.length === 0) continue;

    const [nameValue, ...attributes] = parts;
    const eqIdx = nameValue.indexOf('=');
    if (eqIdx === -1) continue;

    const name = nameValue.substring(0, eqIdx).trim();
    const value = nameValue.substring(eqIdx + 1).trim();

    let domain = defaultDomain;
    let path = '/';

    for (const attr of attributes) {
      const [attrName, attrValue] = attr.split('=').map(s => s.trim());
      if (attrName.toLowerCase() === 'domain' && attrValue) {
        domain = attrValue.startsWith('.') ? attrValue.substring(1) : attrValue;
      }
      if (attrName.toLowerCase() === 'path' && attrValue) {
        path = attrValue;
      }
    }

    cookies.push({ name, value, domain, path });
  }

  return cookies;
}

/**
 * Merge two cookie lists. Cookies in list2 override cookies in list1
 * with the same name + domain.
 */
export function mergeCookieLists(list1: ZaloCookie[], list2: ZaloCookie[]): ZaloCookie[] {
  const merged = [...list1];

  for (const cookie2 of list2) {
    const existing = merged.findIndex(
      c => c.name === cookie2.name && c.domain === cookie2.domain
    );
    if (existing !== -1) {
      merged[existing] = { ...cookie2 };
    } else {
      merged.push({ ...cookie2 });
    }
  }

  return merged;
}

/**
 * Get cookies matching a specific domain as a key-value map.
 * Matches cookies where cookie.domain is contained in the requested domain
 * or in '.'+domain (subdomain matching).
 */
export function getCookiesByDomain(cookies: ZaloCookie[], domainName: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const cookie of cookies) {
    if (
      domainName.includes(cookie.domain) ||
      (`.${domainName}`).includes(cookie.domain)
    ) {
      result[cookie.name] = cookie.value;
    }
  }

  return result;
}

/**
 * Format cookies map to a Cookie header string.
 */
export function formatCookieHeader(cookieMap: Record<string, string>): string {
  return Object.entries(cookieMap)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Get domain from a URL string.
 */
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // Fallback: split by '/'
    return url.split('/')[2] || '';
  }
}
