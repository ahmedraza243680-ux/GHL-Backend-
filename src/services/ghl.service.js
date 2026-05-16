import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/** GoHighLevel / LeadConnector API version header */
const GHL_VERSION = '2021-07-28';

const CUSTOM_FIELD_LAST_POST_DATE = 'Last Post Date';
const CUSTOM_FIELD_POST_STATUS = 'Post Status';

/**
 * Updates location custom values (two POSTs — one per field name).
 * Custom value names must match what is configured in the GHL location.
 *
 * @param {string} ghlLocationId
 * @param {string | Date} lastPostDate — stored as string in GHL (e.g. ISO)
 * @param {string} postStatus
 */
export async function updateLocationCustomFields(ghlLocationId, lastPostDate, postStatus) {
  if (!ghlLocationId || String(ghlLocationId).trim() === '') {
    throw new AppError('ghlLocationId is required for GHL custom field updates.', 400, {
      code: 'GHL_LOCATION_ID_MISSING',
    });
  }

  const dateStr =
    lastPostDate instanceof Date ? lastPostDate.toISOString() : String(lastPostDate);
  const statusStr = String(postStatus ?? '');

  if (env.MOCK_MODE) {
    console.info(
      JSON.stringify({
        event: 'ghl_custom_fields_mock',
        ghlLocationId,
        [CUSTOM_FIELD_LAST_POST_DATE]: dateStr,
        [CUSTOM_FIELD_POST_STATUS]: statusStr,
      }),
    );
    return { success: true, mock: true };
  }

  const token = env.GHL_API_KEY?.trim();
  if (!token) {
    console.warn(
      JSON.stringify({
        event: 'ghl_custom_fields_skipped',
        reason: 'GHL_API_KEY empty',
        ghlLocationId,
      }),
    );
    return { success: false, skipped: true };
  }

  const url = `https://services.leadconnectorhq.com/locations/${encodeURIComponent(ghlLocationId)}/customValues`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Version: GHL_VERSION,
  };

  const payloads = [
    { name: CUSTOM_FIELD_LAST_POST_DATE, value: dateStr },
    { name: CUSTOM_FIELD_POST_STATUS, value: statusStr },
  ];

  for (const body of payloads) {
    const response = await axios.post(url, body, {
      headers,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const msg =
        response.data?.message ||
        response.data?.error ||
        response.data?.msg ||
        `HTTP ${response.status}`;
      throw new AppError(`GHL customValues API failed: ${msg}`, 502, {
        code: 'GHL_CUSTOM_VALUES_ERROR',
        details: { status: response.status, body: response.data, field: body.name },
      });
    }
  }

  return { success: true };
}
