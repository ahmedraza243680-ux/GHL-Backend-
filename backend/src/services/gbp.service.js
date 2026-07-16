import { google } from 'googleapis';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { withGoogleAuth } from './googleAuth.service.js';

export const MOCK_GBP_LOCATION_PROFILE = {
  locationName: 'Bergen Car Company',
  address: '22 US-46 E, Lodi, NJ 07644',
  category: 'Used car dealer',
  phoneNumber: '+1 201-555-0100',
  website: 'https://bergencar.com',
  hours: 'Mon-Fri 9am-6pm',
};

/**
 * GBP Local Posts API — Google's current API for creating posts (2025/2026).
 * Not part of Business Information API; uses the dedicated Local Posts surface.
 * @see https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts/create
 */
const LOCAL_POSTS_API_BASE = 'https://mybusiness.googleapis.com/v4';
const LOCAL_POSTS_GCP_SERVICE = 'mybusiness.googleapis.com';

function resolveAccountId(location) {
  const accountId = location.googleAccountId?.trim() || env.GOOGLE_GBP_ACCOUNT_ID;
  if (!accountId) {
    throw new AppError(
      'Google Business Profile account ID is not configured. Set Location.googleAccountId or GOOGLE_GBP_ACCOUNT_ID.',
      400,
      { code: 'GBP_ACCOUNT_ID_MISSING' },
    );
  }
  return accountId;
}

function resolveLocationResourceId(location) {
  const id = location.googleLocationId?.trim();
  if (!id) {
    throw new AppError(
      'Location has no googleLocationId. Set it to the Google location ID (resource suffix).',
      400,
      { code: 'GBP_LOCATION_ID_MISSING' },
    );
  }
  return id;
}

function buildLocationParent(accountId, googleLocationId) {
  return `accounts/${accountId}/locations/${googleLocationId}`;
}

function extractGoogleApiError(error) {
  const details = error?.response?.data ?? error?.errors ?? error?.data;
  const message =
    details?.error?.message ||
    error?.errors?.[0]?.message ||
    error?.message ||
    'Unknown error';
  const status = error?.response?.status ?? error?.code;
  return { message, details, status };
}

function formatLocalPostApiError(message, details) {
  const lower = String(message).toLowerCase();
  if (
    lower.includes('has not been used') ||
    lower.includes('is disabled') ||
    lower.includes('not been enabled')
  ) {
    return (
      `Google Business Profile Local Posts API (${LOCAL_POSTS_GCP_SERVICE}) is not enabled for this GCP project. ` +
      'Enable the "Google My Business API" in Google Cloud Console (visible after GBP API access approval). ' +
      `Details: ${message}`
    );
  }
  if (lower.includes('permission denied') || lower.includes('insufficient')) {
    return (
      `Google Business Profile Local Posts API permission denied. Confirm GBP API access is approved, ` +
      `"Google My Business API" is enabled, and the OAuth user manages this location. Details: ${message}`
    );
  }
  return `Google Local Posts API failed: ${message}`;
}

/**
 * Fetch Business Profile location details via Business Information API.
 * When MOCK_MODE is enabled, returns static mock data (location must exist).
 */
export async function fetchGbpLocationDetails(locationId) {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }

  if (env.MOCK_MODE) {
    return { ...MOCK_GBP_LOCATION_PROFILE };
  }

  const accountId = resolveAccountId(location);
  const gLocationId = resolveLocationResourceId(location);
  const name = buildLocationParent(accountId, gLocationId);

  try {
    return await withGoogleAuth(locationId, async (oauth2) => {
      const businessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2 });
      const { data } = await businessInfo.accounts.locations.get({
        name,
        readMask: [
          'name',
          'title',
          'languageCode',
          'categories',
          'storefrontAddress',
          'phoneNumbers',
          'websiteUri',
          'regularHours',
          'specialHours',
          'profile',
          'openInfo',
        ].join(','),
      });

      return {
        name: data.name,
        title: data.title,
        languageCode: data.languageCode,
        categories: data.categories,
        storefrontAddress: data.storefrontAddress,
        phoneNumbers: data.phoneNumbers,
        websiteUri: data.websiteUri,
        regularHours: data.regularHours,
        specialHours: data.specialHours,
        profile: data.profile,
        openInfo: data.openInfo,
      };
    });
  } catch (e) {
    const { message, details, status } = extractGoogleApiError(e);
    throw new AppError(
      `Google Business Profile API error: ${message}`,
      status === 404 ? 404 : 502,
      {
        code: 'GBP_API_ERROR',
        details,
      },
    );
  }
}

function mapPostTypeToGoogleTopic(type) {
  switch (type) {
    case 'UPDATE':
      return 'STANDARD';
    case 'EVENT':
      return 'EVENT';
    case 'OFFER':
      return 'OFFER';
    default:
      return null;
  }
}

/**
 * @param {'UPDATE'|'EVENT'|'OFFER'} type
 * @param {string} content
 * @param {string|null} mediaUrl
 * @param {{ offer?: { couponCode?: string|null, terms?: string|null, redeemUrl?: string|null } }} [options]
 */
function buildLocalPostBody(type, content, mediaUrl, options = {}) {
  const media = mediaUrl
    ? [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }]
    : undefined;
  const base = {
    languageCode: 'en-US',
    summary: content,
    ...(media ? { media } : {}),
  };

  if (type === 'UPDATE') {
    return { ...base, topicType: 'STANDARD' };
  }

  if (type === 'EVENT') {
    const startDate = toGoogleDate(new Date());
    return {
      ...base,
      topicType: 'EVENT',
      event: {
        title: buildEventTitle(content),
        schedule: {
          startDate,
          startTime: { hours: 9, minutes: 0, seconds: 0, nanos: 0 },
          endDate: startDate,
          endTime: { hours: 17, minutes: 0, seconds: 0, nanos: 0 },
        },
      },
    };
  }

  if (type === 'OFFER') {
    // Google requires `event` (title + schedule) for OFFER posts, not just EVENT.
    // The schedule defines the offer's validity window; default it to 30 days.
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    return {
      ...base,
      topicType: 'OFFER',
      event: {
        title: buildEventTitle(content),
        schedule: {
          startDate: toGoogleDate(now),
          startTime: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
          endDate: toGoogleDate(end),
          endTime: { hours: 23, minutes: 59, seconds: 0, nanos: 0 },
        },
      },
      offer: buildOfferDetails(options.offer),
    };
  }

  return null;
}

/**
 * Builds the OFFER `offer` object from a location's saved config. couponCode and
 * redeemOnlineUrl are only sent when the business has actually provided them —
 * both are optional in Google's API, so we never fabricate a coupon. termsConditions
 * falls back to a safe generic string when not configured.
 */
function buildOfferDetails(offer = {}) {
  const couponCode = String(offer?.couponCode ?? '').trim();
  const redeemUrl = String(offer?.redeemUrl ?? '').trim();
  const terms = String(offer?.terms ?? '').trim();
  return {
    ...(couponCode ? { couponCode } : {}),
    ...(redeemUrl ? { redeemOnlineUrl: redeemUrl } : {}),
    termsConditions: terms || 'See store for details.',
  };
}

function toGoogleDate(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

// Google caps EVENT/OFFER post titles at 58 characters. Prefer the first
// sentence of the post as the headline; fall back to a word-boundary trim so
// the title reads cleanly and never exceeds the limit.
const EVENT_TITLE_MAX = 58;

function buildEventTitle(content) {
  const text = String(content ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Update';
  if (text.length <= EVENT_TITLE_MAX) return text;

  // First sentence, if it fits comfortably.
  const sentenceEnd = text.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd + 1 <= EVENT_TITLE_MAX) {
    return text.slice(0, sentenceEnd).trim();
  }

  const cut = text.slice(0, EVENT_TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Creates a local post via the GBP Local Posts API
 * (accounts.locations.localPosts.create on mybusiness.googleapis.com/v4).
 */
export async function publishLocalPostToGoogle(location, { type, content, mediaUrl }) {
  if (!location.googleAccessToken) {
    throw new AppError('Google is not connected for this location.', 400, {
      code: 'GOOGLE_NOT_CONNECTED',
    });
  }

  const accountId = resolveAccountId(location);
  const gLocationId = resolveLocationResourceId(location);
  const topic = mapPostTypeToGoogleTopic(type);
  if (!topic) {
    throw new AppError('Invalid post type.', 400, { code: 'INVALID_POST_TYPE' });
  }

  const requestBody = buildLocalPostBody(type, content, mediaUrl, {
    offer: {
      couponCode: location.offerCouponCode,
      terms: location.offerTerms,
      redeemUrl: location.offerRedeemUrl,
    },
  });
  if (!requestBody) {
    throw new AppError('Invalid post type.', 400, { code: 'INVALID_POST_TYPE' });
  }

  const parent = buildLocationParent(accountId, gLocationId);

  try {
    return await withGoogleAuth(location.id, async (oauth2) => {
      const response = await oauth2.request({
        url: `${LOCAL_POSTS_API_BASE}/${parent}/localPosts`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: requestBody,
      });

      return response.data;
    });
  } catch (e) {
    const { message, details, status } = extractGoogleApiError(e);
    throw new AppError(formatLocalPostApiError(message, details), status === 404 ? 404 : 502, {
      code: 'GBP_LOCAL_POST_ERROR',
      details: {
        api: 'accounts.locations.localPosts.create',
        service: LOCAL_POSTS_GCP_SERVICE,
        parent,
        googleError: details,
      },
    });
  }
}
