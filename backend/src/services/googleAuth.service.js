import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';
import { sendGoogleConnectionLostAlert } from './alert.service.js';

const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';

/** Refresh access token when expiry is within this window (5 minutes). */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export function createOAuth2Client() {
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function getGoogleConsentUrl({ state } = {}) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GBP_SCOPE],
    include_granted_scopes: true,
    ...(state ? { state } : {}),
  });
}

/**
 * Returns true when the stored access token is missing expiry, already expired,
 * or will expire within `bufferMs` (default 5 minutes).
 */
export function isGoogleTokenExpiringSoon(location, bufferMs = TOKEN_REFRESH_BUFFER_MS) {
  if (!location?.googleTokenExpiresAt) {
    return true;
  }
  return location.googleTokenExpiresAt.getTime() <= Date.now() + bufferMs;
}

function isInvalidRefreshTokenError(error) {
  const code = error?.response?.data?.error ?? error?.code;
  const message = String(
    error?.response?.data?.error_description ||
      error?.response?.data?.error?.message ||
      error?.message ||
      '',
  ).toLowerCase();

  return (
    code === 'invalid_grant' ||
    message.includes('invalid_grant') ||
    message.includes('token has been expired or revoked') ||
    message.includes('refresh token') && message.includes('invalid')
  );
}

async function loadLocationWithBusiness(locationId) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { business: true },
  });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }
  return location;
}

async function persistGoogleTokens(locationId, credentials) {
  const accessToken = credentials.access_token;
  const expiryDate = credentials.expiry_date;

  if (!accessToken) {
    throw new AppError('Google did not return an access token.', 502, {
      code: 'REFRESH_INCOMPLETE',
    });
  }

  await prisma.location.update({
    where: { id: locationId },
    data: {
      googleAccessToken: accessToken,
      ...(credentials.refresh_token ? { googleRefreshToken: credentials.refresh_token } : {}),
      ...(expiryDate
        ? { googleTokenExpiresAt: new Date(expiryDate) }
        : { googleTokenExpiresAt: null }),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'GOOGLE_TOKEN_REFRESHED',
      locationId,
      details: {
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null,
      },
    },
  });

  return { accessToken, expiryDate };
}

async function notifyGoogleConnectionLost(location, error) {
  const businessName = location.business?.name?.trim() || location.id;
  const errorMessage = error?.message ?? String(error);

  try {
    await sendGoogleConnectionLostAlert(location.id, businessName, errorMessage);
  } catch (alertError) {
    console.error(
      JSON.stringify({
        event: 'google_connection_lost_alert_failed',
        locationId: location.id,
        error: alertError?.message ?? String(alertError),
      }),
    );
  }
}

/**
 * Calls Google's OAuth token endpoint and persists new credentials for the location.
 */
async function refreshAndPersistGoogleTokens(location) {
  if (!location.googleRefreshToken) {
    const err = new AppError('No Google refresh token stored for this location.', 400, {
      code: 'REFRESH_TOKEN_MISSING',
    });
    await notifyGoogleConnectionLost(location, err);
    throw err;
  }

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: location.googleRefreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    await persistGoogleTokens(location.id, credentials);
    return loadLocationWithBusiness(location.id);
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === 'REFRESH_TOKEN_MISSING') {
        await notifyGoogleConnectionLost(location, e);
      }
      throw e;
    }

    const refreshError = new AppError(
      isInvalidRefreshTokenError(e)
        ? 'Google refresh token is invalid or expired. Reconnect Google OAuth for this location.'
        : `Failed to refresh Google access token: ${e.message ?? String(e)}`,
      isInvalidRefreshTokenError(e) ? 401 : 502,
      {
        code: isInvalidRefreshTokenError(e)
          ? 'GOOGLE_REFRESH_TOKEN_INVALID'
          : 'REFRESH_FAILED',
        details: e?.response?.data ?? e?.message,
      },
    );

    if (isInvalidRefreshTokenError(e)) {
      await notifyGoogleConnectionLost(location, refreshError);
    }

    throw refreshError;
  }
}

/**
 * Ensures the location has a valid access token, refreshing via OAuth when needed.
 * Reloads the location from the database after a refresh.
 */
export async function ensureFreshGoogleTokensForLocation(locationId) {
  const location = await loadLocationWithBusiness(locationId);

  if (!location.googleAccessToken) {
    throw new AppError('Google is not connected for this location.', 400, {
      code: 'GOOGLE_NOT_CONNECTED',
    });
  }

  if (!isGoogleTokenExpiringSoon(location)) {
    return location;
  }

  console.info(
    JSON.stringify({
      event: 'google_token_refresh_needed',
      locationId: location.id,
      expiresAt: location.googleTokenExpiresAt?.toISOString() ?? null,
    }),
  );

  return refreshAndPersistGoogleTokens(location);
}

/**
 * Returns an OAuth2 client with a valid access token for the location.
 */
export async function getAuthenticatedOAuth2Client(locationOrId) {
  const locationId = typeof locationOrId === 'string' ? locationOrId : locationOrId.id;
  const location = await ensureFreshGoogleTokensForLocation(locationId);

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    access_token: location.googleAccessToken,
    refresh_token: location.googleRefreshToken ?? undefined,
    expiry_date: location.googleTokenExpiresAt?.getTime(),
  });

  return { oauth2, location };
}

/**
 * Wraps a Google API call with automatic token refresh before execution.
 *
 * @template T
 * @param {string | { id: string }} locationOrId
 * @param {(oauth2: OAuth2Client, location: object) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withGoogleAuth(locationOrId, fn) {
  const { oauth2, location } = await getAuthenticatedOAuth2Client(locationOrId);
  return fn(oauth2, location);
}

/**
 * @param {{ code: string; locationId: string }} params
 */
export async function exchangeCodeAndSaveTokens({ code, locationId }) {
  const client = createOAuth2Client();
  let tokens;
  try {
    const result = await client.getToken(code);
    tokens = result.tokens;
  } catch (e) {
    throw new AppError('Failed to exchange Google authorization code.', 400, {
      code: 'OAUTH_EXCHANGE_FAILED',
      details: e.message,
    });
  }

  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  const expiryDate = tokens.expiry_date;

  if (!accessToken) {
    throw new AppError('Google did not return an access token.', 502, {
      code: 'OAUTH_INCOMPLETE',
    });
  }

  try {
    await prisma.location.update({
      where: { id: locationId },
      data: {
        googleAccessToken: accessToken,
        ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
        ...(expiryDate
          ? { googleTokenExpiresAt: new Date(expiryDate) }
          : { googleTokenExpiresAt: null }),
      },
    });
  } catch (e) {
    if (e.code === 'P2025') {
      throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
    }
    throw e;
  }

  await prisma.auditLog.create({
    data: {
      action: 'GOOGLE_OAUTH_CONNECTED',
      locationId,
      details: { hadRefreshToken: Boolean(refreshToken) },
    },
  });

  return { accessToken, refreshToken, expiryDate };
}

/**
 * Force-refresh access token for a location and persist new credentials.
 */
export async function refreshAccessTokenForLocation(locationId) {
  const location = await loadLocationWithBusiness(locationId);
  const refreshed = await refreshAndPersistGoogleTokens(location);
  return {
    accessToken: refreshed.googleAccessToken,
    expiryDate: refreshed.googleTokenExpiresAt?.getTime() ?? null,
  };
}
