import axios from 'axios';
import { env } from '../config/env.js';

const PEXELS_PHOTO_SEARCH = 'https://api.pexels.com/v1/search';
const PEXELS_VIDEO_SEARCH = 'https://api.pexels.com/videos/search';

const CATEGORY_BY_BUSINESS = {
  'Bergen Car Company': 'car dealership automobiles',
  '551 HVAC': 'HVAC heating cooling technician',
  'Biz Solutions INC': 'business office professional',
};

function buildSearchQuery(businessName, category, city) {
  const name = String(businessName ?? '').trim() || 'Business';
  const place = String(city ?? '').trim() || 'New Jersey';
  const mapped = CATEGORY_BY_BUSINESS[name];

  if (mapped) {
    return `${name} ${mapped} ${place}`;
  }

  const cat = String(category ?? '').trim();
  if (cat && cat !== 'local business') {
    return `${name} ${cat} ${place}`;
  }

  return `${name} ${place}`;
}

function pexelsHeaders() {
  const key = env.PEXELS_API_KEY?.trim();
  if (!key) return null;
  return { Authorization: key };
}

function pickRandom(items) {
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * @param {object} [options]
 * @param {string[]} [options.excludeUrls] - skip these image URLs (e.g. recent posts)
 * @returns {Promise<string|null>} photo.src.large2x URL
 */
export async function fetchPexelsImage(businessName, category, city, options = {}) {
  const headers = pexelsHeaders();
  if (!headers) {
    console.warn(JSON.stringify({ event: 'pexels_skipped', reason: 'PEXELS_API_KEY not configured' }));
    return null;
  }

  const query = buildSearchQuery(businessName, category, city);
  const exclude = new Set((options.excludeUrls ?? []).filter(Boolean));
  const page = Math.floor(Math.random() * 5) + 1;

  try {
    const response = await axios.get(PEXELS_PHOTO_SEARCH, {
      headers,
      params: { query, per_page: 30, orientation: 'landscape', page },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.data?.error ?? `HTTP ${response.status}`);
    }

    const photos = (response.data?.photos ?? [])
      .map((p) => ({
        url: p?.src?.large2x ?? p?.src?.large ?? null,
      }))
      .filter((p) => p.url && !exclude.has(p.url));

    const picked = pickRandom(photos.length ? photos : response.data?.photos);
    const url = picked?.url ?? picked?.src?.large2x ?? picked?.src?.large ?? null;
    if (!url) {
      console.warn(JSON.stringify({ event: 'pexels_image_empty', query }));
      return null;
    }

    return url;
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'pexels_image_failed',
        query,
        error: e?.message ?? String(e),
      }),
    );
    return null;
  }
}

/**
 * @param {string} query - raw Pexels search query
 * @param {object} [options]
 * @param {string[]} [options.excludeUrls]
 * @returns {Promise<string|null>}
 */
export async function fetchPexelsImageByQuery(query, options = {}) {
  const headers = pexelsHeaders();
  const normalizedQuery = String(query ?? '').trim();
  if (!headers || !normalizedQuery) {
    return null;
  }

  const exclude = new Set((options.excludeUrls ?? []).filter(Boolean));
  const page = Math.floor(Math.random() * 5) + 1;

  try {
    const response = await axios.get(PEXELS_PHOTO_SEARCH, {
      headers,
      params: { query: normalizedQuery, per_page: 15, orientation: 'landscape', page },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.data?.error ?? `HTTP ${response.status}`);
    }

    const photos = (response.data?.photos ?? [])
      .map((p) => p?.src?.large2x ?? p?.src?.large ?? null)
      .filter((url) => url && !exclude.has(url));

    const url = pickRandom(photos);
    if (!url) {
      console.warn(JSON.stringify({ event: 'pexels_image_empty', query: normalizedQuery }));
      return null;
    }

    return url;
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'pexels_image_by_query_failed',
        query: normalizedQuery,
        error: e?.message ?? String(e),
      }),
    );
    return null;
  }
}

/**
 * @returns {Promise<string|null>} video file link URL
 */
export async function fetchPexelsVideo(businessName, category, city) {
  const headers = pexelsHeaders();
  if (!headers) {
    console.warn(JSON.stringify({ event: 'pexels_skipped', reason: 'PEXELS_API_KEY not configured' }));
    return null;
  }

  const query = buildSearchQuery(businessName, category, city);

  try {
    const response = await axios.get(PEXELS_VIDEO_SEARCH, {
      headers,
      params: { query, per_page: 20, orientation: 'landscape' },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.data?.error ?? `HTTP ${response.status}`);
    }

    const video = pickRandom(response.data?.videos);
    const files = video?.video_files;
    if (!files?.length) {
      console.warn(JSON.stringify({ event: 'pexels_video_empty', query }));
      return null;
    }

    const hd =
      files.find((f) => f.quality === 'hd' && f.width >= 1280) ??
      files.find((f) => f.width >= 1280) ??
      files[0];

    return hd?.link ?? files[0]?.link ?? null;
  } catch (e) {
    console.error(
      JSON.stringify({
        event: 'pexels_video_failed',
        query,
        error: e?.message ?? String(e),
      }),
    );
    return null;
  }
}
