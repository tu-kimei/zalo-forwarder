import { config } from '../config';
import { logger } from './logger';
import {
  ZaloCookie,
  extractCookies,
  getCookiesByDomain,
  formatCookieHeader,
  getDomainFromUrl,
  mergeCookieLists,
} from './cookie-manager';

/** Default headers matching the Python HEADERS_DEFAULT */
const DEFAULT_HEADERS: Record<string, string> = {
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': config.zalo.userAgent,
};

interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  cookies?: ZaloCookie[];
  followRedirects?: boolean;
}

interface HttpResponse {
  status: number;
  headers: Headers;
  cookies: ZaloCookie[];
  body: string;
  json: <T = unknown>() => T;
  redirectUrl?: string;
}

/**
 * HTTP client wrapper with cookie support.
 * Mimics the Python requests-based pattern.
 */
export async function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    cookies = [],
    followRedirects = true,
  } = options;

  const domain = getDomainFromUrl(url);
  const domainCookies = getCookiesByDomain(cookies, domain);
  const cookieHeader = formatCookieHeader(domainCookies);

  const mergedHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...headers,
  };

  if (cookieHeader) {
    mergedHeaders['cookie'] = cookieHeader;
  }

  logger.debug(`HTTP ${method} ${url}`, { domain });

  const fetchOptions: RequestInit = {
    method,
    headers: mergedHeaders,
    redirect: followRedirects ? 'follow' : 'manual',
  };

  if (body && method === 'POST') {
    fetchOptions.body = body;
  }

  const response = await fetch(url, fetchOptions);
  const responseBody = await response.text();
  const responseCookies = extractCookies(response, domain);

  return {
    status: response.status,
    headers: response.headers,
    cookies: responseCookies,
    body: responseBody,
    json: <T = unknown>() => JSON.parse(responseBody) as T,
    redirectUrl: response.status === 302
      ? (response.headers.get('location') || undefined)
      : undefined,
  };
}

/**
 * Follow redirect chain, collecting cookies along the way.
 * Matches Python's loop_redirect function.
 */
export async function followRedirectChain(
  startUrl: string,
  cookies: ZaloCookie[],
): Promise<ZaloCookie[]> {
  let url = startUrl;
  let currentCookies = [...cookies];
  let statusCode = 302;

  while (statusCode === 302) {
    const domain = getDomainFromUrl(url);
    const domainCookies = getCookiesByDomain(currentCookies, domain);
    const cookieHeader = formatCookieHeader(domainCookies);

    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      'authority': domain,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'referer': 'https://id.zalo.me/',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'cross-site',
      'upgrade-insecure-requests': '1',
    };

    if (cookieHeader) {
      headers['cookie'] = cookieHeader;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
    });

    statusCode = response.status;
    const responseCookies = extractCookies(response, domain);
    currentCookies = mergeCookieLists(currentCookies, responseCookies);

    if (statusCode === 302) {
      const location = response.headers.get('location');
      if (!location) break;
      url = location;
    }

    // Consume response body to avoid leaks
    await response.text().catch(() => {});
  }

  return currentCookies;
}
