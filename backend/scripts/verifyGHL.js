import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const GHL_VERSION = '2021-07-28';
const FIELD_LAST_POST_DATE = 'Last Post Date';
const FIELD_POST_STATUS = 'Post Status';

/** Display order matching Richie's three locations */
const LOCATION_ORDER = [
  'NDYfMNSuMjNJz3N2CjPd',
  '4diJ9Q8sTqY55I5ihUD7',
  'cFaTJXAmUqSLpoaxQ2fn',
];

function formatValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return 'NOT SET';
  }
  return String(value);
}

function formatFieldId(id) {
  if (!id || String(id).trim() === '') {
    return 'NOT SET';
  }
  return String(id);
}

async function fetchCustomValues(ghlLocationId, ghlApiKey) {
  const token = ghlApiKey?.trim() || process.env.GHL_API_KEY?.trim() || '';
  if (!token) {
    return { error: 'No ghlApiKey on location and GHL_API_KEY env is empty' };
  }

  const url = `https://services.leadconnectorhq.com/locations/${encodeURIComponent(ghlLocationId)}/customValues`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Version: GHL_VERSION,
    },
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    const msg =
      response.data?.message ||
      response.data?.error ||
      response.data?.msg ||
      `HTTP ${response.status}`;
    return { error: msg };
  }

  const raw = response.data?.customValues ?? [];
  const list = Array.isArray(raw) ? raw : [];
  return { list };
}

function findFieldValue(list, name) {
  const item = list.find((entry) => entry?.name === name);
  return item?.value ?? null;
}

async function main() {
  const locations = await prisma.location.findMany({
    where: { ghlLocationId: { in: LOCATION_ORDER } },
    include: { business: { select: { name: true } } },
  });

  const byGhlId = new Map(locations.map((loc) => [loc.ghlLocationId, loc]));

  console.log('');
  console.log('=== GHL VERIFICATION REPORT ===');
  console.log('');

  for (const ghlLocationId of LOCATION_ORDER) {
    const loc = byGhlId.get(ghlLocationId);
    if (!loc) {
      console.log(`(missing in DB) (${ghlLocationId})`);
      console.log('Last Post Date field ID: NOT SET');
      console.log('Post Status field ID: NOT SET');
      console.log('Custom Values in GHL:');
      console.log('- Last Post Date: NOT SET');
      console.log('- Post Status: NOT SET');
      console.log('');
      continue;
    }

    const businessName = loc.business?.name ?? 'Unknown';
    console.log(`${businessName} (${ghlLocationId})`);
    console.log(`Last Post Date field ID: ${formatFieldId(loc.ghlLastPostDateFieldId)}`);
    console.log(`Post Status field ID: ${formatFieldId(loc.ghlPostStatusFieldId)}`);
    console.log('Custom Values in GHL:');

    const result = await fetchCustomValues(loc.ghlLocationId, loc.ghlApiKey);

    if (result.error) {
      console.log(`- Last Post Date: ERROR — ${result.error}`);
      console.log(`- Post Status: ERROR — ${result.error}`);
    } else {
      console.log(
        `- Last Post Date: ${formatValue(findFieldValue(result.list, FIELD_LAST_POST_DATE))}`,
      );
      console.log(
        `- Post Status: ${formatValue(findFieldValue(result.list, FIELD_POST_STATUS))}`,
      );
    }

    console.log('');
  }

  console.log('==============================');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
