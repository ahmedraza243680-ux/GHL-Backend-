import axios from 'axios';
import { google } from 'googleapis';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { createOAuth2Client } from './googleAuth.service.js';

export const MOCK_GBP_LOCATION_PROFILE = {
  locationName: 'Bergen Car Company',
  address: '22 US-46 E, Lodi, NJ 07644',
  category: 'Used car dealer',
  phoneNumber: '+1 201-555-0100',
  website: 'https://bergencar.com',
  hours: 'Mon-Fri 9am-6pm',
};

const LOCAL_POSTS_V4 = 'https://mybusiness.googleapis.com/v4';

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

  if (!location.googleAccessToken) {
    throw new AppError('Google is not connected for this location.', 400, {
      code: 'GOOGLE_NOT_CONNECTED',
    });
  }

  const accountId = resolveAccountId(location);
  const gLocationId = resolveLocationResourceId(location);
  const name = `accounts/${accountId}/locations/${gLocationId}`;

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    access_token: location.googleAccessToken,
    ...(location.googleRefreshToken
      ? { refresh_token: location.googleRefreshToken }
      : {}),
  });

  const businessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2 });

  try {
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
  } catch (e) {
    const status = e.code;
    const apiMessage =
      e.response?.data?.error?.message || e.errors?.[0]?.message || e.message;
    throw new AppError(
      `Google Business Profile API error: ${apiMessage ?? 'Unknown error'}`,
      status === 404 ? 404 : 502,
      {
        code: 'GBP_API_ERROR',
        details: e.response?.data ?? e.errors,
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

function buildLocalPostBody(type, content, mediaUrl) {
  const media = mediaUrl
    ? [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }]
    : undefined;
  const base = {
    languageCode: 'en',
    summary: content,
    ...(media ? { media } : {}),
  };

  if (type === 'UPDATE') {
    return { ...base, topicType: 'STANDARD' };
  }

  if (type === 'EVENT') {
    const d = new Date();
    const startDate = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
    return {
      ...base,
      topicType: 'EVENT',
      event: {
        title: content.slice(0, 100),
        schedule: {
          startDate,
          startTime: { hours: 9, minutes: 0 },
          endDate: startDate,
          endTime: { hours: 17, minutes: 0 },
        },
      },
    };
  }

  if (type === 'OFFER') {
    return {
      ...base,
      topicType: 'OFFER',
      offer: {
        couponCode: 'PROMO',
        termsConditions: 'See store for details.',
      },
    };
  }

  return null;
}

/**
 * Creates a local post via legacy v4 My Business API (requires GBP API access).
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

  const requestBody = buildLocalPostBody(type, content, mediaUrl);
  if (!requestBody) {
    throw new AppError('Invalid post type.', 400, { code: 'INVALID_POST_TYPE' });
  }

  const url = `${LOCAL_POSTS_V4}/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(gLocationId)}/localPosts`;

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${location.googleAccessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const msg =
        response.data?.error?.message ||
        response.data?.error?.status ||
        `HTTP ${response.status}`;
      throw new AppError(`Google local post API failed: ${msg}`, 502, {
        code: 'GBP_LOCAL_POST_ERROR',
        details: response.data,
      });
    }

    return response.data;
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(`Google local post request failed: ${e.message}`, 502, {
      code: 'GBP_LOCAL_POST_ERROR',
      details: e.response?.data,
    });
  }
}
