import { google } from 'googleapis';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { createOAuth2Client } from './googleAuth.service.js';

/**
 * Parse `accounts/{accountId}` → accountId.
 */
function accountResourceToId(resourceName) {
  if (!resourceName || typeof resourceName !== 'string') return null;
  const prefix = 'accounts/';
  if (!resourceName.startsWith(prefix)) return resourceName;
  return resourceName.slice(prefix.length);
}

async function fetchAllAccounts(auth) {
  const api = google.mybusinessaccountmanagement({ version: 'v1', auth });
  const accounts = [];
  let pageToken;

  do {
    const { data } = await api.accounts.list({
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    });

    if (data.accounts?.length) {
      accounts.push(...data.accounts);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return accounts;
}

/**
 * Lists Google My Business accounts the authenticated user can access,
 * using the OAuth tokens stored on the given location.
 */
export async function listGoogleAccountsForLocation(locationId) {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }
  if (!location.googleAccessToken) {
    throw new AppError('Google is not connected for this location.', 400, {
      code: 'GOOGLE_NOT_CONNECTED',
    });
  }

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    access_token: location.googleAccessToken,
    ...(location.googleRefreshToken
      ? { refresh_token: location.googleRefreshToken }
      : {}),
  });

  try {
    const raw = await fetchAllAccounts(oauth2);
    return raw.map((a) => {
      const accountId = accountResourceToId(a.name ?? '');
      return {
        accountId,
        name: a.accountName ?? a.name ?? null,
      };
    });
  } catch (e) {
    const status = e.code;
    const apiMessage =
      e.response?.data?.error?.message || e.errors?.[0]?.message || e.message;
    throw new AppError(
      `Google Account Management API error: ${apiMessage ?? 'Unknown error'}`,
      status === 404 ? 404 : 502,
      {
        code: 'GBP_ACCOUNT_MANAGEMENT_ERROR',
        details: e.response?.data ?? e.errors,
      },
    );
  }
}

/**
 * Extract location ID from Google resource name (last path segment).
 * e.g. accounts/123/locations/456 → 456, or locations/456 → 456
 */
function locationResourceToId(resourceName) {
  if (!resourceName || typeof resourceName !== 'string') return null;
  const trimmed = resourceName.trim().replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  if (lastSlash === -1) return trimmed || null;
  const id = trimmed.slice(lastSlash + 1);
  return id || null;
}

function normalizeAccountId(accountId) {
  const raw = String(accountId ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('accounts/') ? raw.slice('accounts/'.length) : raw;
}

async function fetchAllLocationsForAccount(auth, accountId) {
  const api = google.mybusinessbusinessinformation({ version: 'v1', auth });
  const locations = [];
  let pageToken;

  do {
    const { data } = await api.accounts.locations.list({
      parent: `accounts/${accountId}`,
      readMask: 'name,title',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    if (data.locations?.length) {
      locations.push(...data.locations);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  return locations;
}

/**
 * Lists Google Business Profile locations under an account,
 * using the OAuth tokens stored on the given location.
 */
export async function listGoogleLocationsForAccount(locationId, accountId) {
  const normalizedAccountId = normalizeAccountId(accountId);
  if (!normalizedAccountId) {
    throw new AppError('Query parameter `accountId` is required.', 400, {
      code: 'INVALID_QUERY',
    });
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }
  if (!location.googleAccessToken) {
    throw new AppError('Google is not connected for this location.', 400, {
      code: 'GOOGLE_NOT_CONNECTED',
    });
  }

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    access_token: location.googleAccessToken,
    ...(location.googleRefreshToken
      ? { refresh_token: location.googleRefreshToken }
      : {}),
  });

  try {
    const raw = await fetchAllLocationsForAccount(oauth2, normalizedAccountId);
    return raw.map((loc) => ({
      name: loc.name ?? null,
      title: loc.title ?? null,
      locationId: locationResourceToId(loc.name ?? ''),
    }));
  } catch (e) {
    const status = e.code;
    const apiMessage =
      e.response?.data?.error?.message || e.errors?.[0]?.message || e.message;
    throw new AppError(
      `Google Business Information API error: ${apiMessage ?? 'Unknown error'}`,
      status === 404 ? 404 : 502,
      {
        code: 'GBP_LOCATIONS_LIST_ERROR',
        details: e.response?.data ?? e.errors,
      },
    );
  }
}
