import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';

const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';

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
 * Refresh access token for a location and persist new credentials.
 */
export async function refreshAccessTokenForLocation(locationId) {
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }
  if (!location.googleRefreshToken) {
    throw new AppError('No Google refresh token stored for this location.', 400, {
      code: 'REFRESH_TOKEN_MISSING',
    });
  }

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: location.googleRefreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    const accessToken = credentials.access_token;
    const expiryDate = credentials.expiry_date;

    if (!accessToken) {
      throw new AppError('Google did not return a new access token.', 502, {
        code: 'REFRESH_INCOMPLETE',
      });
    }

    await prisma.location.update({
      where: { id: locationId },
      data: {
        googleAccessToken: accessToken,
        ...(credentials.refresh_token
          ? { googleRefreshToken: credentials.refresh_token }
          : {}),
        ...(expiryDate
          ? { googleTokenExpiresAt: new Date(expiryDate) }
          : { googleTokenExpiresAt: null }),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'GOOGLE_TOKEN_REFRESHED',
        locationId,
        details: {},
      },
    });

    return { accessToken, expiryDate };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('Failed to refresh Google access token.', 502, {
      code: 'REFRESH_FAILED',
      details: e.message,
    });
  }
}
