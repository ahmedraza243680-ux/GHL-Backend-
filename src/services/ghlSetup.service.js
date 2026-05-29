import axios from 'axios';
import { env } from '../config/env.js';
import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';

const GHL_VERSION = '2021-07-28';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const FIELD_LAST_POST_DATE = 'Last Post Date';
const FIELD_POST_STATUS = 'Post Status';

function resolveApiKey(apiKey) {
  return apiKey?.trim() || env.GHL_API_KEY?.trim() || '';
}

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${resolveApiKey(apiKey)}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Version: GHL_VERSION,
  };
}

function customFieldsUrl(ghlLocationId) {
  return `${GHL_BASE}/locations/${encodeURIComponent(ghlLocationId)}/customFields`;
}

function extractFieldsList(data) {
  const raw = data?.customFields ?? data?.fields ?? data?.data ?? data;
  return Array.isArray(raw) ? raw : [];
}

function extractFieldId(field) {
  return field?.id ?? field?._id ?? field?.fieldId ?? null;
}

function findFieldByExactName(fields, name) {
  return fields.find((f) => f?.name === name || f?.label === name);
}

function throwGhlSetupError(message, details) {
  console.error(JSON.stringify({ event: 'ghl_setup_error', message, details }));
  throw new AppError(message, 502, { code: 'GHL_SETUP_ERROR', details });
}

async function listCustomFields(ghlLocationId, apiKey) {
  const response = await axios.get(customFieldsUrl(ghlLocationId), {
    headers: ghlHeaders(apiKey),
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    throwGhlSetupError(
      `GHL list customFields failed: ${response.data?.message ?? `HTTP ${response.status}`}`,
      response.data,
    );
  }

  return extractFieldsList(response.data);
}

async function createCustomField(ghlLocationId, name, dataType, apiKey) {
  const response = await axios.post(
    customFieldsUrl(ghlLocationId),
    { name, dataType },
    { headers: ghlHeaders(apiKey), validateStatus: () => true },
  );

  if (response.status < 200 || response.status >= 300) {
    throwGhlSetupError(
      `GHL create customField "${name}" failed: ${response.data?.message ?? `HTTP ${response.status}`}`,
      response.data,
    );
  }

  const created = response.data?.customField ?? response.data?.field ?? response.data;
  const id = extractFieldId(created);
  if (!id) {
    throwGhlSetupError(`GHL create customField "${name}" did not return an id.`, response.data);
  }
  return String(id);
}

async function resolveFieldId(ghlLocationId, fields, name, dataType, apiKey) {
  const existing = findFieldByExactName(fields, name);
  if (existing) {
    const id = extractFieldId(existing);
    if (!id) {
      throwGhlSetupError(`Existing GHL field "${name}" has no id.`, existing);
    }
    return { id: String(id), alreadyExisted: true };
  }

  const id = await createCustomField(ghlLocationId, name, dataType, apiKey);
  return { id, alreadyExisted: false };
}

/**
 * Ensures GHL custom fields exist for a location and stores their ids on Location.
 */
export async function createGHLCustomFieldsForLocation(ghlLocationId) {
  const location = await prisma.location.findUnique({
    where: { ghlLocationId },
  });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }

  const apiKey = resolveApiKey(location.ghlApiKey);

  let lastPostDateFieldId;
  let postStatusFieldId;
  let lastPostDateExisted = false;
  let postStatusExisted = false;

  if (env.MOCK_MODE) {
    console.info(
      JSON.stringify({
        event: 'ghl_setup_mock',
        ghlLocationId,
        fields: [FIELD_LAST_POST_DATE, FIELD_POST_STATUS],
      }),
    );
    lastPostDateFieldId = `mock-last-post-date-${ghlLocationId}`;
    postStatusFieldId = `mock-post-status-${ghlLocationId}`;
  } else {
    if (!apiKey) {
      throwGhlSetupError('GHL API key is not configured for this location or in env.', {
        ghlLocationId,
      });
    }

    const fields = await listCustomFields(ghlLocationId, apiKey);

    const lastPost = await resolveFieldId(
      ghlLocationId,
      fields,
      FIELD_LAST_POST_DATE,
      'TEXT',
      apiKey,
    );
    lastPostDateFieldId = lastPost.id;
    lastPostDateExisted = lastPost.alreadyExisted;

    const postStatus = await resolveFieldId(
      ghlLocationId,
      fields,
      FIELD_POST_STATUS,
      'TEXT',
      apiKey,
    );
    postStatusFieldId = postStatus.id;
    postStatusExisted = postStatus.alreadyExisted;
  }

  await prisma.location.update({
    where: { ghlLocationId },
    data: {
      ghlLastPostDateFieldId: lastPostDateFieldId,
      ghlPostStatusFieldId: postStatusFieldId,
    },
  });

  return {
    ghlLocationId,
    lastPostDateFieldId,
    postStatusFieldId,
    alreadyExisted: lastPostDateExisted && postStatusExisted,
  };
}
