import { describe, expect, it } from 'vitest';

import { buildImageProxyUrl, buildVideoUrl, decodeMediaUrl } from '../lib/media.js';

describe('decodeMediaUrl', () => {
  it('decodes a base64-encoded URL', () => {
    // Arrange
    const url = 'https://scontent.cdninstagram.com/v/t51.png';
    const encoded = Buffer.from(url, 'utf8').toString('base64');

    // Act
    const decoded = decodeMediaUrl(encoded);

    // Assert
    expect(decoded).toBe(url);
  });

  it('handles values that are missing base64 padding', () => {
    // Arrange — strip trailing '=' padding to simulate the API response
    const url = 'https://cdn.example/abc';
    const unpadded = Buffer.from(url, 'utf8').toString('base64').replace(/=+$/, '');

    // Act
    const decoded = decodeMediaUrl(unpadded);

    // Assert
    expect(decoded).toBe(url);
  });
});

describe('buildImageProxyUrl', () => {
  it('passes the base64 URL as a query string on the CDN proxy host', () => {
    // Arrange
    const base64Url = 'aHR0cHM6Ly9leGFtcGxl';

    // Act
    const result = buildImageProxyUrl(base64Url);

    // Assert
    expect(result).toBe(`https://cdn.storynavigation.com/?${base64Url}`);
  });
});

describe('buildVideoUrl', () => {
  it('appends the raw base64 URL to the video host path', () => {
    // Arrange
    const base64Url = 'aHR0cHM6Ly9leGFtcGxl';

    // Act
    const result = buildVideoUrl(base64Url);

    // Assert
    expect(result).toBe(`https://stories-cdn.fun/${base64Url}`);
  });
});
