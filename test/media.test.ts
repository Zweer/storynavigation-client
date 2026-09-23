import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ExpiredUrlError, MediaTooLargeError } from '../lib/errors.js';
import {
  buildImageProxyUrl,
  buildVideoUrl,
  decodeMediaUrl,
  downloadImage,
  downloadVideo,
} from '../lib/media.js';
import { server } from './setup.js';

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

describe('downloadImage', () => {
  it('fetches bytes through the CDN proxy with the Referer header', async () => {
    // Arrange
    const base64Url = 'aHR0cHM6Ly9leGFtcGxl';
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG magic
    let referer: string | null = null;
    server.use(
      http.get('https://cdn.storynavigation.com/', ({ request }) => {
        referer = request.headers.get('referer');
        return HttpResponse.arrayBuffer(bytes.buffer, {
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }),
    );

    // Act
    const result = await downloadImage(base64Url);

    // Assert
    expect(referer).toBe('https://storynavigation.com/');
    expect([...result]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('throws ExpiredUrlError on 403', async () => {
    // Arrange
    server.use(
      http.get('https://cdn.storynavigation.com/', () =>
        HttpResponse.text('URL signature mismatch', { status: 403 }),
      ),
    );

    // Act & Assert
    await expect(downloadImage('YWJj')).rejects.toBeInstanceOf(ExpiredUrlError);
  });
});

describe('downloadVideo', () => {
  it('fetches bytes from the stories-cdn.fun host', async () => {
    // Arrange
    const base64Url = 'dmlkZW8';
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18]); // mp4-ish
    server.use(
      http.get(`https://stories-cdn.fun/${base64Url}`, () =>
        HttpResponse.arrayBuffer(bytes.buffer, {
          headers: { 'Content-Type': 'video/mp4' },
        }),
      ),
    );

    // Act
    const result = await downloadVideo(base64Url);

    // Assert
    expect(result.byteLength).toBe(4);
  });

  it('throws ExpiredUrlError on 403', async () => {
    // Arrange
    server.use(
      http.get('https://stories-cdn.fun/:b64', () =>
        HttpResponse.text('Bad URL hash', { status: 403 }),
      ),
    );

    // Act & Assert
    await expect(downloadVideo('YWJj')).rejects.toBeInstanceOf(ExpiredUrlError);
  });
});

describe('download size cap', () => {
  it('rejects when the declared Content-Length exceeds maxBytes', async () => {
    // Arrange
    server.use(
      http.get('https://cdn.storynavigation.com/', () =>
        HttpResponse.arrayBuffer(new Uint8Array(10).buffer, {
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '999999' },
        }),
      ),
    );

    // Act & Assert
    await expect(downloadImage('YWJj', { maxBytes: 1024 })).rejects.toBeInstanceOf(
      MediaTooLargeError,
    );
  });

  it('aborts a stream that grows past maxBytes even without Content-Length', async () => {
    // Arrange — a body larger than the cap, no Content-Length header
    const big = new Uint8Array(5000);
    server.use(
      http.get('https://cdn.storynavigation.com/', () =>
        HttpResponse.arrayBuffer(big.buffer, { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
    );

    // Act & Assert
    await expect(downloadImage('YWJj', { maxBytes: 1024 })).rejects.toBeInstanceOf(
      MediaTooLargeError,
    );
  });

  it('accepts a body within maxBytes', async () => {
    // Arrange
    const bytes = new Uint8Array([1, 2, 3, 4]);
    server.use(
      http.get('https://cdn.storynavigation.com/', () =>
        HttpResponse.arrayBuffer(bytes.buffer, { headers: { 'Content-Type': 'image/jpeg' } }),
      ),
    );

    // Act
    const result = await downloadImage('YWJj', { maxBytes: 1024 });

    // Assert
    expect(result.byteLength).toBe(4);
  });
});
