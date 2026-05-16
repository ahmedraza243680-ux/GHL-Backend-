import axios from 'axios';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { exchangeCodeAndSaveTokens, getGoogleConsentUrl, refreshAccessTokenForLocation } from '../services/googleAuth.service.js';
import { listGoogleAccountsForLocation } from '../services/googleAccounts.service.js';
import { AppError } from '../utils/AppError.js';
import jwt from 'jsonwebtoken';

const DEBUG_GBP_ACCOUNTS_URL =
  'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

function signLocationSession(locationId) {
  return jwt.sign(
    { locationId, purpose: 'google_gbp_session' },
    env.JWT_SECRET,
    { expiresIn: '7d', subject: locationId },
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getAuthUrl(req, res, next) {
  try {
    const state = req.query.state ? String(req.query.state) : undefined;
    const url = getGoogleConsentUrl({ state });
    return res.json({
      success: true,
      data: { url },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function getGoogleAccounts(req, res, next) {
  try {
    const locationId = req.query.locationId != null ? String(req.query.locationId) : '';
    if (!locationId) {
      throw new AppError('Query parameter `locationId` is required.', 400, {
        code: 'INVALID_QUERY',
      });
    }

    const accounts = await listGoogleAccountsForLocation(locationId);

    return res.json({
      success: true,
      data: { accounts },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

/** TEMPORARY: direct axios probe — remove before production. */
export async function getGoogleDebugAccounts(req, res, next) {
  try {
    const locationId = req.query.locationId != null ? String(req.query.locationId) : '';
    if (!locationId) {
      throw new AppError('Query parameter `locationId` is required.', 400, {
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

    const params = {};
    if (req.query.pageSize != null && req.query.pageSize !== '') {
      params.pageSize = req.query.pageSize;
    }
    if (req.query.pageToken != null && req.query.pageToken !== '') {
      params.pageToken = req.query.pageToken;
    }
    if (req.query.filter != null && req.query.filter !== '') {
      params.filter = req.query.filter;
    }
    if (req.query.parentAccount != null && req.query.parentAccount !== '') {
      params.parentAccount = req.query.parentAccount;
    }

    const response = await axios.get(DEBUG_GBP_ACCOUNTS_URL, {
      headers: {
        Authorization: `Bearer ${location.googleAccessToken}`,
        Accept: 'application/json',
      },
      params,
      validateStatus: () => true,
    });

    return res
      .status(response.status)
      .type(response.headers['content-type'] || 'application/json')
      .send(response.data);
  } catch (e) {
    next(e);
  }
}

/**
 * Browser redirect target for Google OAuth. Use consent URL from GET /auth/google/url
 * with ?state={locationId} so we know which location to attach tokens to.
 */
export async function getGoogleOAuthCallback(req, res, next) {
  try {
    const { error, error_description: errorDescription, code, state } = req.query;

    if (error) {
      throw new AppError(String(errorDescription || error || 'Google OAuth failed.'), 400, {
        code: 'OAUTH_DENIED',
        details: { error: String(error) },
      });
    }
    if (!code || typeof code !== 'string') {
      throw new AppError('Missing authorization code.', 400, { code: 'OAUTH_CODE_MISSING' });
    }
    const locationId = state != null && state !== '' ? String(state) : '';
    if (!locationId) {
      throw new AppError(
        'Missing state (locationId). Start from GET /auth/google/url?state=YOUR_LOCATION_ID, then sign in.',
        400,
        { code: 'OAUTH_STATE_MISSING' },
      );
    }

    await exchangeCodeAndSaveTokens({ code, locationId });
    const token = signLocationSession(locationId);

    const wantsJson = req.accepts(['html', 'json']) === 'json';
    if (wantsJson) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'Google account linked to location.',
          token,
          expiresInSeconds: 7 * 24 * 60 * 60,
          locationId,
        },
        requestId: req.requestId,
      });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Google connected</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
    pre { background: #f4f4f5; padding: 1rem; overflow-x: auto; font-size: 0.75rem; word-break: break-all; }
    .hint { color: #52525b; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>Google account linked</h1>
  <p>Location ID: <code>${escapeHtml(locationId)}</code></p>
  <p class="hint">Session JWT (use as Bearer token for protected routes you add later):</p>
  <pre>${escapeHtml(token)}</pre>
</body>
</html>`;
    return res.type('html').send(html);
  } catch (e) {
    next(e);
  }
}

export async function postGoogleAuth(req, res, next) {
  try {
    const { code, locationId } = req.body ?? {};
    if (!code || typeof code !== 'string') {
      throw new AppError('Request body must include a string `code`.', 400, {
        code: 'INVALID_BODY',
      });
    }
    if (!locationId || typeof locationId !== 'string') {
      throw new AppError('Request body must include a string `locationId`.', 400, {
        code: 'INVALID_BODY',
      });
    }

    await exchangeCodeAndSaveTokens({ code, locationId });

    const token = signLocationSession(locationId);

    return res.status(200).json({
      success: true,
      data: {
        message: 'Google account linked to location.',
        token,
        expiresInSeconds: 7 * 24 * 60 * 60,
      },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function postRefreshToken(req, res, next) {
  try {
    const { locationId } = req.params;
    if (!locationId) {
      throw new AppError('locationId is required.', 400, { code: 'INVALID_PARAMS' });
    }

    const { expiryDate } = await refreshAccessTokenForLocation(locationId);

    return res.json({
      success: true,
      data: {
        message: 'Access token refreshed and stored.',
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null,
      },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}
