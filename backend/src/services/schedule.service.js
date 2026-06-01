import prisma from '../database/client.js';
import { AppError } from '../utils/AppError.js';

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const ALLOWED_POST_TYPES = ['UPDATE', 'OFFER', 'EVENT', 'VIDEO'];

const DEFAULT_SCHEDULE = {
  postsPerWeek: 3,
  postDays: ['Monday', 'Wednesday', 'Friday'],
  postTime: '09:00',
  postTypes: ['UPDATE', 'OFFER', 'VIDEO'],
  timezone: 'America/New_York',
};

function normalizePostTime(postTime) {
  const match = String(postTime ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new AppError('postTime must be HH:mm (24-hour).', 400, { code: 'INVALID_POST_TIME' });
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) {
    throw new AppError('postTime must be a valid time.', 400, { code: 'INVALID_POST_TIME' });
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizePostDays(postDays) {
  if (!Array.isArray(postDays) || postDays.length === 0) {
    throw new AppError('postDays must be a non-empty array.', 400, { code: 'INVALID_POST_DAYS' });
  }
  const days = postDays.map((d) => String(d).trim());
  for (const day of days) {
    if (!WEEKDAYS.includes(day)) {
      throw new AppError(`Invalid weekday: ${day}`, 400, { code: 'INVALID_POST_DAYS' });
    }
  }
  return [...new Set(days)];
}

function normalizePostTypes(postTypes) {
  if (!Array.isArray(postTypes) || postTypes.length === 0) {
    throw new AppError('postTypes must be a non-empty array.', 400, { code: 'INVALID_POST_TYPES' });
  }
  const types = postTypes.map((t) => String(t).trim().toUpperCase());
  for (const type of types) {
    if (!ALLOWED_POST_TYPES.includes(type)) {
      throw new AppError(`Invalid post type: ${type}`, 400, { code: 'INVALID_POST_TYPES' });
    }
  }
  return types;
}

export function mapScheduleTypeToPublishType(scheduleType) {
  const t = String(scheduleType ?? 'UPDATE').toUpperCase();
  if (t === 'VIDEO') return 'UPDATE';
  if (t === 'EVENT' || t === 'OFFER' || t === 'UPDATE') return t;
  return 'UPDATE';
}

/** Build day → type map from selected days and rotation order. */
export function buildPostDayTypes(postDays, postTypes) {
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const types = postTypes?.length ? postTypes : DEFAULT_SCHEDULE.postTypes;
  const map = {};
  ordered.forEach((day, index) => {
    map[day] = types[index % types.length];
  });
  return map;
}

function normalizePostDayTypes(postDays, postTypes, postDayTypesInput) {
  const raw =
    postDayTypesInput && typeof postDayTypesInput === 'object' && !Array.isArray(postDayTypesInput)
      ? postDayTypesInput
      : {};
  const result = buildPostDayTypes(postDays, postTypes);

  for (const day of postDays) {
    const value = raw[day];
    if (!value) continue;
    const type = String(value).trim().toUpperCase();
    if (ALLOWED_POST_TYPES.includes(type)) {
      result[day] = type;
    }
  }

  return result;
}

export function buildPostDayTimes(postDays, defaultTime) {
  const time = normalizePostTime(defaultTime);
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const map = {};
  ordered.forEach((day) => {
    map[day] = time;
  });
  return map;
}

function normalizePostDayTimes(postDays, defaultTime, postDayTimesInput) {
  const raw =
    postDayTimesInput && typeof postDayTimesInput === 'object' && !Array.isArray(postDayTimesInput)
      ? postDayTimesInput
      : {};
  const result = buildPostDayTimes(postDays, defaultTime);

  for (const day of postDays) {
    const value = raw[day];
    if (!value) continue;
    try {
      result[day] = normalizePostTime(value);
    } catch {
      // keep default for invalid entries
    }
  }

  return result;
}

export function scheduleRecordToClient(schedule) {
  const postDayTypes = normalizePostDayTypes(
    schedule.postDays,
    schedule.postTypes,
    schedule.postDayTypes,
  );
  const postDayTimes = normalizePostDayTimes(
    schedule.postDays,
    schedule.postTime,
    schedule.postDayTimes,
  );
  return { ...schedule, postDayTypes, postDayTimes };
}

export async function getOrCreateLocationSchedule(locationId) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true, timezone: true },
  });
  if (!location) {
    throw new AppError('Location not found.', 404, { code: 'LOCATION_NOT_FOUND' });
  }

  let schedule = await prisma.locationSchedule.findUnique({
    where: { locationId },
  });

  if (!schedule) {
    const postDayTypes = buildPostDayTypes(
      DEFAULT_SCHEDULE.postDays,
      DEFAULT_SCHEDULE.postTypes,
    );
    const postDayTimes = buildPostDayTimes(
      DEFAULT_SCHEDULE.postDays,
      DEFAULT_SCHEDULE.postTime,
    );
    schedule = await prisma.locationSchedule.create({
      data: {
        locationId,
        ...DEFAULT_SCHEDULE,
        postDayTypes,
        postDayTimes,
        timezone: location.timezone || DEFAULT_SCHEDULE.timezone,
      },
    });
  }

  return scheduleRecordToClient(schedule);
}

export async function getLocationSchedule(locationId) {
  return getOrCreateLocationSchedule(locationId);
}

export async function updateLocationSchedule(locationId, body) {
  await getOrCreateLocationSchedule(locationId);

  const postsPerWeek = Number(body.postsPerWeek);
  if (!Number.isInteger(postsPerWeek) || postsPerWeek < 1 || postsPerWeek > 7) {
    throw new AppError('postsPerWeek must be between 1 and 7.', 400, {
      code: 'INVALID_POSTS_PER_WEEK',
    });
  }

  const postDays = normalizePostDays(body.postDays);
  if (postDays.length !== postsPerWeek) {
    throw new AppError(
      `postDays length (${postDays.length}) must match postsPerWeek (${postsPerWeek}).`,
      400,
      { code: 'POST_DAYS_COUNT_MISMATCH' },
    );
  }

  const postTypes = normalizePostTypes(body.postTypes);
  const timezone = String(body.timezone ?? DEFAULT_SCHEDULE.timezone).trim() || DEFAULT_SCHEDULE.timezone;
  const postDayTypes = normalizePostDayTypes(postDays, postTypes, body.postDayTypes);
  const fallbackTime = body.postTime ?? DEFAULT_SCHEDULE.postTime;
  const postDayTimes = normalizePostDayTimes(postDays, fallbackTime, body.postDayTimes);
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const postTime = normalizePostTime(
    ordered.length > 0 ? postDayTimes[ordered[0]] : fallbackTime,
  );

  const updated = await prisma.locationSchedule.update({
    where: { locationId },
    data: {
      postsPerWeek,
      postDays,
      postTime,
      postTypes,
      postDayTypes,
      postDayTimes,
      timezone,
    },
  });

  return scheduleRecordToClient(updated);
}

function getZonedParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    weekday: get('weekday'),
    hour: Number.parseInt(get('hour'), 10),
    minute: Number.parseInt(get('minute'), 10),
    year: Number.parseInt(get('year'), 10),
    month: Number.parseInt(get('month'), 10),
    day: Number.parseInt(get('day'), 10),
  };
}

/**
 * True when local weekday is in postDays and local time is within [postTime, postTime + windowMinutes).
 */
export function isScheduledPostWindow(schedule, now = new Date(), windowMinutes = 15) {
  const timezone = schedule.timezone || DEFAULT_SCHEDULE.timezone;
  const zoned = getZonedParts(now, timezone);

  if (!schedule.postDays.includes(zoned.weekday)) {
    return false;
  }

  const dayTimes = normalizePostDayTimes(
    schedule.postDays,
    schedule.postTime,
    schedule.postDayTimes,
  );
  const timeForDay = dayTimes[zoned.weekday] ?? schedule.postTime;
  const [sh, sm] = timeForDay.split(':').map((n) => Number.parseInt(n, 10));
  const scheduledMins = sh * 60 + sm;
  const currentMins = zoned.hour * 60 + zoned.minute;
  return currentMins >= scheduledMins && currentMins < scheduledMins + windowMinutes;
}

/**
 * Start of "today" in the location timezone, as UTC Date for DB comparison.
 */
export function getStartOfZonedDayUtc(timezone, now = new Date()) {
  const zoned = getZonedParts(now, timezone);
  const utcGuess = Date.UTC(zoned.year, zoned.month - 1, zoned.day, 0, 0, 0, 0);
  const offsetMs = getTimezoneOffsetMs(timezone, new Date(utcGuess));
  return new Date(utcGuess - offsetMs);
}

function getTimezoneOffsetMs(timezone, date) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return zoned.getTime() - utc.getTime();
}

export async function hasPostedToday(locationId, timezone) {
  const start = getStartOfZonedDayUtc(timezone);
  const count = await prisma.post.count({
    where: {
      locationId,
      createdAt: { gte: start },
    },
  });
  return count > 0;
}

export function pickRotatedPostType(schedule, postCount) {
  const types = schedule.postTypes?.length ? schedule.postTypes : DEFAULT_SCHEDULE.postTypes;
  const scheduleType = types[postCount % types.length];
  return {
    scheduleType,
    publishType: mapScheduleTypeToPublishType(scheduleType),
  };
}

/** Post type for today from per-day settings, or rotation fallback. */
export function getPostTypeForScheduledDay(schedule, weekday) {
  const map = normalizePostDayTypes(
    schedule.postDays,
    schedule.postTypes,
    schedule.postDayTypes,
  );
  const scheduleType = map[weekday];
  if (scheduleType) {
    return {
      scheduleType,
      publishType: mapScheduleTypeToPublishType(scheduleType),
    };
  }
  return pickRotatedPostType(schedule, 0);
}
