import axios from 'axios';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { exchangeCodeAndSaveTokens, getGoogleConsentUrl, getAuthenticatedOAuth2Client, refreshAccessTokenForLocation } from '../services/googleAuth.service.js';
import { listGoogleAccountsForLocation, listGoogleLocationsForAccount } from '../services/googleAccounts.service.js';
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

export async function getGoogleLocations(req, res, next) {
  try {
    const locationId = req.query.locationId != null ? String(req.query.locationId) : '';
    const accountId = req.query.accountId != null ? String(req.query.accountId) : '';

    if (!locationId) {
      throw new AppError('Query parameter `locationId` is required.', 400, {
        code: 'INVALID_QUERY',
      });
    }
    if (!accountId) {
      throw new AppError('Query parameter `accountId` is required.', 400, {
        code: 'INVALID_QUERY',
      });
    }

    const locations = await listGoogleLocationsForAccount(locationId, accountId);

    return res.json({
      success: true,
      data: { locations },
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

    const { oauth2 } = await getAuthenticatedOAuth2Client(locationId);
    const accessToken = oauth2.credentials.access_token;

    const response = await axios.get(DEBUG_GBP_ACCOUNTS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google connected</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #e2e8f0; }
    .card { text-align: center; max-width: 24rem; padding: 2.5rem 2rem; border: 1px solid #1e293b; border-radius: 16px; background: #111827; }
    .badge { width: 48px; height: 48px; margin: 0 auto 1rem; border-radius: 9999px; background: rgba(16,185,129,0.15); color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
    h1 { font-size: 1.125rem; margin: 0 0 0.5rem; color: #f8fafc; }
    p { color: #94a3b8; font-size: 0.875rem; margin: 0; }
    button { display: none; margin-top: 1.25rem; padding: 0.5rem 1.25rem; font-size: 0.875rem; font-weight: 500; color: #fff; background: #059669; border: 0; border-radius: 8px; cursor: pointer; }
    button:hover { background: #10b981; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">&#10003;</div>
    <h1>Google account linked</h1>
    <p id="status">You can return to the dashboard. This window will close automatically&hellip;</p>
    <button id="closeBtn" type="button">Close window</button>
  </div>
  <script>
    (function () {
      var message = { type: 'peakwa-google-oauth', status: 'success', locationId: ${JSON.stringify(
        locationId,
      )} };

      // Tell the dashboard we're done so it can advance immediately.
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, '*');
        }
      } catch (e) { /* opener may be severed by the OAuth cross-origin flow */ }

      function tryClose() {
        try { window.close(); } catch (e) { /* blocked */ }
      }

      // On a user click we can reset the window to a single-history,
      // script-closable context, which lets close() work even after the OAuth
      // redirect chain severed the opener relationship.
      function forceClose() {
        try { window.open('', '_self'); } catch (e) { /* ignore */ }
        window.close();
      }

      // Browsers only auto-close windows they consider "script-closable". The
      // Google OAuth redirect chain can strip that, so if close() is ignored we
      // fall back to an explicit, user-clickable close button.
      tryClose();
      setTimeout(tryClose, 400);
      setTimeout(function () {
        if (window.closed) return;
        var status = document.getElementById('status');
        var btn = document.getElementById('closeBtn');
        if (status) status.textContent = 'You can now close this window and return to the dashboard.';
        if (btn) {
          btn.style.display = 'inline-block';
          btn.onclick = forceClose;
        }
      }, 1000);
    })();
  </script>
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
