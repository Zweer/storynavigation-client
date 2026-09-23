import { ExpiredUrlError, HttpError } from './errors.js';

/** Base URL of the CDN proxy used for images. */
export const CDN_IMAGE_HOST = 'https://cdn.storynavigation.com';
/** Base URL used for videos. */
export const CDN_VIDEO_HOST = 'https://stories-cdn.fun';
/** Referer required by both CDN hosts. */
export const CDN_REFERER = 'https://storynavigation.com/';

/**
 * Decode a base64-encoded Instagram CDN URL as returned by the API.
 * The values arrive without guaranteed padding, so we pad to a multiple of 4.
 *
 * @param encoded - The base64 string from `thumbnailUrl` / `videoUrl` / `display_url`.
 * @returns The decoded Instagram CDN URL.
 */
export function decodeMediaUrl(encoded: string): string {
  const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * Build the CDN proxy URL for an image (or a sidecar slide).
 * The base64 URL is passed as a query string.
 *
 * @param base64Url - The base64-encoded IG image URL from the API.
 */
export function buildImageProxyUrl(base64Url: string): string {
  return `${CDN_IMAGE_HOST}/?${base64Url}`;
}

/**
 * Build the download URL for a video.
 * The raw base64 URL is appended to the path (not decoded, not a query param).
 *
 * @param base64Url - The base64-encoded IG video URL from the API.
 */
export function buildVideoUrl(base64Url: string): string {
  return `${CDN_VIDEO_HOST}/${base64Url}`;
}

/** Options for the media download helpers. */
export interface DownloadOptions {
  /** Injectable fetch, mainly for testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Defaults to 60000 (media can be large). */
  timeoutMs?: number;
}

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60_000;

async function downloadBytes(url: string, options: DownloadOptions): Promise<Uint8Array> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Referer: CDN_REFERER },
    });

    if (response.status === 403) {
      const body = await response.text().catch(() => '');
      throw new ExpiredUrlError(
        body.trim() ? `${body.trim()} — the media URL has expired` : undefined,
      );
    }
    if (!response.ok) {
      throw new HttpError(response.status, url, `Media download failed (HTTP ${response.status})`);
    }

    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download the bytes of an image (or sidecar slide / profile pic / highlight
 * thumbnail) through the CDN proxy.
 *
 * ⚠️ Signed IG URLs are short-lived. Call this **immediately** after receiving
 * the API response — never persist the base64 URL to download later.
 *
 * @param base64Url - The base64-encoded IG image URL from the API.
 * @param options - Optional fetch/timeout overrides.
 * @throws {ExpiredUrlError} When the proxy answers `403` (expired signature).
 */
export async function downloadImage(
  base64Url: string,
  options: DownloadOptions = {},
): Promise<Uint8Array> {
  return downloadBytes(buildImageProxyUrl(base64Url), options);
}

/**
 * Download the bytes of a video (post or highlight/story video) through the
 * `stories-cdn.fun` host.
 *
 * ⚠️ Signed IG URLs are short-lived — download immediately.
 *
 * @param base64Url - The base64-encoded IG video URL from the API.
 * @param options - Optional fetch/timeout overrides.
 * @throws {ExpiredUrlError} When the host answers `403` (expired signature).
 */
export async function downloadVideo(
  base64Url: string,
  options: DownloadOptions = {},
): Promise<Uint8Array> {
  return downloadBytes(buildVideoUrl(base64Url), options);
}
