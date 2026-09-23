import { ExpiredUrlError, HttpError, MediaTooLargeError } from './errors.js';

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
  /**
   * Maximum bytes to download. If the response declares a larger
   * `Content-Length`, or the streamed body exceeds this, the download is
   * aborted with a {@link MediaTooLargeError}. Defaults to 100 MiB.
   */
  maxBytes?: number;
}

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

async function downloadBytes(url: string, options: DownloadOptions): Promise<Uint8Array> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

    // Reject early if the declared size already exceeds the cap.
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new MediaTooLargeError(url, maxBytes, declared);
    }

    return await readCappedBody(response, url, maxBytes);
  } finally {
    // Clearing the timer only here means the timeout also covers reading the
    // body, not just receiving the response headers.
    clearTimeout(timer);
  }
}

/**
 * Read a response body into a single `Uint8Array`, aborting if it grows past
 * `maxBytes`. Falls back to `arrayBuffer()` when the body is not a stream.
 */
async function readCappedBody(
  response: Response,
  url: string,
  maxBytes: number,
): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new MediaTooLargeError(url, maxBytes, buf.byteLength);
    }
    return buf;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MediaTooLargeError(url, maxBytes, total);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
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
