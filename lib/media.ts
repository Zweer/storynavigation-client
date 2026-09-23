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
