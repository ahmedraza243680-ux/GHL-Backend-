import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  fetchLocationSchedule,
  updateLocationMaxPostLength,
  updateLocationOfferConfig,
  updateLocationSchedule,
  updateLocationServiceTowns,
  type LocationSchedulePayload,
  type OfferConfigPayload,
} from '../api/endpoints';
import {
  ErrorBanner,
  PageHeader,
  SuccessBanner,
} from '../components/ui';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ListSkeleton } from '../components/ui/skeleton';
import { TimePicker, type TimeParts } from '../components/ui/time-picker';
import { useLocations } from '../contexts/LocationsContext';
import type { LocationSchedule } from '../types';
import { cn } from '../lib/utils';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const ROTATION_TYPES = ['UPDATE', 'OFFER', 'EVENT', 'VIDEO', 'INFORMATIONAL'] as const;

const POST_TYPE_INFO: Record<string, { label: string }> = {
  UPDATE: { label: 'General update' },
  OFFER: { label: 'Special offer' },
  EVENT: { label: 'Event' },
  VIDEO: { label: 'Video post' },
  INFORMATIONAL: { label: 'Informational post' },
};

function postTimeToParts(postTime: string): TimeParts {
  const [hStr, mStr] = postTime.split(':');
  let h = Number.parseInt(hStr, 10);
  const minute = mStr.padStart(2, '0');
  const period: TimeParts['period'] = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: String(h), minute, period };
}

function partsToPostTime(parts: TimeParts): string {
  let hours = Number.parseInt(parts.hour, 10);
  const minutes = parts.minute;
  if (parts.period === 'AM') {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

interface LocationScheduleForm {
  postsPerWeek: number;
  postDays: string[];
  postTime: string;
  postTypes: string[];
  postDayTypes: Record<string, string>;
  postDayTimes: Record<string, string>;
  timezone: string;
}

function buildPostDayTypesFromRotation(
  postDays: string[],
  postTypes: string[],
): Record<string, string> {
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const map: Record<string, string> = {};
  ordered.forEach((day, index) => {
    map[day] = postTypes[index % postTypes.length] ?? 'UPDATE';
  });
  return map;
}

function syncPostDayTypes(
  postDays: string[],
  postTypes: string[],
  existing: Record<string, string>,
): Record<string, string> {
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const next: Record<string, string> = {};
  ordered.forEach((day, index) => {
    const kept = existing[day];
    next[day] =
      kept && ROTATION_TYPES.includes(kept as (typeof ROTATION_TYPES)[number])
        ? kept
        : (postTypes[index % postTypes.length] ?? 'UPDATE');
  });
  return next;
}

function syncPostDayTimes(
  postDays: string[],
  defaultTime: string,
  existing: Record<string, string>,
): Record<string, string> {
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const next: Record<string, string> = {};
  ordered.forEach((day) => {
    next[day] = existing[day] ?? defaultTime;
  });
  return next;
}

function scheduleToForm(schedule: LocationSchedule): LocationScheduleForm {
  const postTypes = [...schedule.postTypes];
  const postDays = [...schedule.postDays];
  const postTime = schedule.postTime;
  const postDayTypes =
    schedule.postDayTypes && Object.keys(schedule.postDayTypes).length > 0
      ? { ...schedule.postDayTypes }
      : buildPostDayTypesFromRotation(postDays, postTypes);
  const postDayTimes =
    schedule.postDayTimes && Object.keys(schedule.postDayTimes).length > 0
      ? { ...schedule.postDayTimes }
      : syncPostDayTimes(postDays, postTime, {});

  return {
    postsPerWeek: schedule.postsPerWeek,
    postDays,
    postTime,
    postTypes,
    postDayTypes: syncPostDayTypes(postDays, postTypes, postDayTypes),
    postDayTimes: syncPostDayTimes(postDays, postTime, postDayTimes),
    timezone: schedule.timezone,
  };
}

function formToPayload(form: LocationScheduleForm): LocationSchedulePayload {
  const postDayTypes = syncPostDayTypes(form.postDays, form.postTypes, form.postDayTypes);
  const postDayTimes = syncPostDayTimes(form.postDays, form.postTime, form.postDayTimes);
  const ordered = WEEKDAYS.filter((d) => form.postDays.includes(d));
  const postTime = ordered.length > 0 ? (postDayTimes[ordered[0]] ?? form.postTime) : form.postTime;

  return {
    postsPerWeek: form.postsPerWeek,
    postDays: form.postDays,
    postTime,
    postTypes: form.postTypes,
    postDayTypes,
    postDayTimes,
    timezone: form.timezone,
  };
}

function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function PerDayScheduleTable({
  postDays,
  postDayTypes,
  postDayTimes,
  postsPerWeek,
  timezone,
  disabled,
  onDayTypeChange,
  onDayTimeChange,
  onApplySameTime,
  onRotateTypes,
}: {
  postDays: string[];
  postDayTypes: Record<string, string>;
  postDayTimes: Record<string, string>;
  postsPerWeek: number;
  timezone: string;
  disabled?: boolean;
  onDayTypeChange: (day: string, type: string) => void;
  onDayTimeChange: (day: string, time: string) => void;
  onApplySameTime: (time: string) => void;
  onRotateTypes: () => void;
}) {
  const ordered = WEEKDAYS.filter((d) => postDays.includes(d));
  const countMismatch = ordered.length !== postsPerWeek;
  const [bulkTimeParts, setBulkTimeParts] = useState<TimeParts>(() =>
    postTimeToParts(ordered[0] ? (postDayTimes[ordered[0]] ?? '09:00') : '09:00'),
  );

  if (ordered.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
        Select posting days above. You will get one row per day with its own post type and time.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {countMismatch && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90 ring-1 ring-amber-500/20">
          Select {postsPerWeek} day{postsPerWeek === 1 ? '' : 's'} above, or change posts per week
          to {ordered.length}.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-700/80 bg-slate-800/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">Bulk actions:</span>
          <TimePicker
            value={bulkTimeParts}
            disabled={disabled}
            onChange={setBulkTimeParts}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onApplySameTime(partsToPostTime(bulkTimeParts))}
          >
            Same time on all days
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="shrink-0 text-slate-400"
          onClick={onRotateTypes}
        >
          Cycle post types
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-slate-700/80">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/90 text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-medium">Day</th>
              <th className="px-5 py-3 font-medium">Post type</th>
              <th className="px-5 py-3 font-medium">
                Time <span className="font-normal normal-case text-slate-600">({timezone.replace(/_/g, ' ')})</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((day) => (
              <tr key={day} className="border-b border-slate-800/80 last:border-0 hover:bg-slate-800/25">
                <td className="px-5 py-3.5 text-sm font-medium text-slate-200">{day}</td>
                <td className="px-5 py-3.5">
                  <Select
                    value={postDayTypes[day] ?? 'UPDATE'}
                    onValueChange={(value) => onDayTypeChange(day, value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROTATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {POST_TYPE_INFO[type]?.label ?? type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-5 py-3.5">
                  <TimePicker
                    value={postTimeToParts(postDayTimes[day] ?? '09:00')}
                    disabled={disabled}
                    onChange={(parts) => onDayTimeChange(day, partsToPostTime(parts))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TownsSection({
  towns,
  inputValue,
  disabled,
  onInputChange,
  onAdd,
  onRemove,
  onSave,
  saving,
}: {
  towns: string[];
  inputValue: string;
  disabled?: boolean;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (town: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder="Add a town, e.g. Hackensack"
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 sm:max-w-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !inputValue.trim()}
          onClick={onAdd}
          className="shrink-0"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add town
        </Button>
      </div>

      {towns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
          No service area towns set. Posts will use the location&apos;s home city.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {towns.map((town) => (
            <span
              key={town}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-slate-700"
            >
              {town}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(town)}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:pointer-events-none"
                aria-label={`Remove ${town}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Button type="button" size="sm" disabled={disabled} onClick={onSave}>
        {saving ? 'Saving…' : 'Save towns'}
      </Button>
    </div>
  );
}

const offerInputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

function OfferSettingsSection({
  form,
  disabled,
  onChange,
  onSave,
  saving,
}: {
  form: OfferConfigPayload;
  disabled?: boolean;
  onChange: (patch: Partial<OfferConfigPayload>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Coupon Code</label>
          <input
            type="text"
            value={form.couponCode}
            disabled={disabled}
            placeholder="e.g. SAVE20"
            onChange={(e) => onChange({ couponCode: e.target.value })}
            className={offerInputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">
            Terms and Conditions
          </label>
          <input
            type="text"
            value={form.terms}
            disabled={disabled}
            placeholder="e.g. New customers only. Expires 12/31."
            onChange={(e) => onChange({ terms: e.target.value })}
            className={offerInputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Redeem URL</label>
          <input
            type="text"
            value={form.redeemUrl}
            disabled={disabled}
            placeholder="https://example.com/offer"
            onChange={(e) => onChange({ redeemUrl: e.target.value })}
            className={offerInputClass}
          />
        </div>
      </div>

      <Button type="button" size="sm" disabled={disabled} onClick={onSave}>
        {saving ? 'Saving…' : 'Save offer settings'}
      </Button>
    </div>
  );
}

const MIN_POST_LENGTH = 50;
const MAX_POST_LENGTH = 300;
const DEFAULT_POST_LENGTH = 80;

function PostLengthSection({
  value,
  disabled,
  onChange,
  onSave,
  saving,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const parsed = Number.parseInt(value, 10);
  const invalid =
    value.trim() === '' ||
    Number.isNaN(parsed) ||
    parsed < MIN_POST_LENGTH ||
    parsed > MAX_POST_LENGTH;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="number"
          inputMode="numeric"
          min={MIN_POST_LENGTH}
          max={MAX_POST_LENGTH}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 sm:w-32"
        />
        <span className="text-sm text-slate-500">words per post</span>
      </div>
      {invalid && (
        <p className="text-xs text-amber-300/90">
          Enter a number between {MIN_POST_LENGTH} and {MAX_POST_LENGTH}.
        </p>
      )}
      <Button type="button" size="sm" disabled={disabled || invalid} onClick={onSave}>
        {saving ? 'Saving…' : 'Save post length'}
      </Button>
    </div>
  );
}

export function SettingsPage() {
  const { locations, loading: locationsLoading } = useLocations();
  const [forms, setForms] = useState<Record<string, LocationScheduleForm>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [townForms, setTownForms] = useState<Record<string, string[]>>({});
  const [newTownInputs, setNewTownInputs] = useState<Record<string, string>>({});
  const [townsSavingId, setTownsSavingId] = useState<string | null>(null);

  const [offerForms, setOfferForms] = useState<Record<string, OfferConfigPayload>>({});
  const [offerSavingId, setOfferSavingId] = useState<string | null>(null);

  const [postLengthForms, setPostLengthForms] = useState<Record<string, string>>({});
  const [postLengthSavingId, setPostLengthSavingId] = useState<string | null>(null);

  useEffect(() => {
    setTownForms((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const loc of locations) {
        if (!(loc.id in next)) {
          next[loc.id] = [...(loc.serviceAreaTowns ?? [])];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setOfferForms((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const loc of locations) {
        if (!(loc.id in next)) {
          next[loc.id] = {
            couponCode: loc.offerCouponCode ?? '',
            terms: loc.offerTerms ?? '',
            redeemUrl: loc.offerRedeemUrl ?? '',
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setPostLengthForms((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const loc of locations) {
        if (!(loc.id in next)) {
          next[loc.id] = String(loc.maxPostLength ?? DEFAULT_POST_LENGTH);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [locations]);

  const loadSchedules = useCallback(async () => {
    if (locations.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        locations.map(async (loc) => {
          const schedule = await fetchLocationSchedule(loc.id);
          return [loc.id, scheduleToForm(schedule)] as const;
        }),
      );
      setForms(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [locations]);

  useEffect(() => {
    if (!locationsLoading) {
      void loadSchedules();
    }
  }, [locationsLoading, loadSchedules]);

  function patchForm(locationId: string, patch: Partial<LocationScheduleForm>) {
    setForms((prev) => {
      const current = prev[locationId];
      if (!current) return prev;
      return { ...prev, [locationId]: { ...current, ...patch } };
    });
  }

  function addTown(locationId: string) {
    const value = (newTownInputs[locationId] ?? '').trim();
    if (!value) return;

    setTownForms((prev) => {
      const current = prev[locationId] ?? [];
      if (current.some((t) => t.toLowerCase() === value.toLowerCase())) return prev;
      return { ...prev, [locationId]: [...current, value] };
    });
    setNewTownInputs((prev) => ({ ...prev, [locationId]: '' }));
  }

  function removeTown(locationId: string, town: string) {
    setTownForms((prev) => ({
      ...prev,
      [locationId]: (prev[locationId] ?? []).filter((t) => t !== town),
    }));
  }

  async function handleSaveTowns(locationId: string, businessName: string) {
    const towns = townForms[locationId] ?? [];
    setTownsSavingId(locationId);
    setError(null);
    setSuccess(null);

    try {
      const saved = await updateLocationServiceTowns(locationId, towns);
      setTownForms((prev) => ({ ...prev, [locationId]: saved }));
      setSuccess(`Service towns saved for ${businessName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service towns');
    } finally {
      setTownsSavingId(null);
    }
  }

  function patchOfferForm(locationId: string, patch: Partial<OfferConfigPayload>) {
    setOfferForms((prev) => {
      const current = prev[locationId] ?? { couponCode: '', terms: '', redeemUrl: '' };
      return { ...prev, [locationId]: { ...current, ...patch } };
    });
  }

  async function handleSaveOfferConfig(locationId: string, businessName: string) {
    const form = offerForms[locationId] ?? { couponCode: '', terms: '', redeemUrl: '' };
    setOfferSavingId(locationId);
    setError(null);
    setSuccess(null);

    try {
      const saved = await updateLocationOfferConfig(locationId, form);
      setOfferForms((prev) => ({
        ...prev,
        [locationId]: {
          couponCode: saved.offerCouponCode ?? '',
          terms: saved.offerTerms ?? '',
          redeemUrl: saved.offerRedeemUrl ?? '',
        },
      }));
      setSuccess(`Offer settings saved for ${businessName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save offer settings');
    } finally {
      setOfferSavingId(null);
    }
  }

  async function handleSavePostLength(locationId: string, businessName: string) {
    const raw = postLengthForms[locationId] ?? String(DEFAULT_POST_LENGTH);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < MIN_POST_LENGTH || parsed > MAX_POST_LENGTH) {
      setError(
        `Post length for ${businessName} must be between ${MIN_POST_LENGTH} and ${MAX_POST_LENGTH} words.`,
      );
      return;
    }

    setPostLengthSavingId(locationId);
    setError(null);
    setSuccess(null);

    try {
      const saved = await updateLocationMaxPostLength(locationId, parsed);
      setPostLengthForms((prev) => ({ ...prev, [locationId]: String(saved) }));
      setSuccess(`Max post length saved for ${businessName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post length');
    } finally {
      setPostLengthSavingId(null);
    }
  }

  function syncDayMaps(current: LocationScheduleForm, postDays: string[]) {
    return {
      postDayTypes: syncPostDayTypes(postDays, current.postTypes, current.postDayTypes),
      postDayTimes: syncPostDayTimes(postDays, current.postTime, current.postDayTimes),
    };
  }

  function handlePostsPerWeekChange(locationId: string, value: string) {
    const postsPerWeek = Number.parseInt(value, 10);
    const current = forms[locationId];
    if (!current) return;

    let postDays = [...current.postDays];
    if (postDays.length > postsPerWeek) {
      postDays = postDays.slice(0, postsPerWeek);
    } else {
      while (postDays.length < postsPerWeek) {
        const next = WEEKDAYS.find((d) => !postDays.includes(d));
        if (!next) break;
        postDays.push(next);
      }
    }
    patchForm(locationId, { postsPerWeek, postDays, ...syncDayMaps(current, postDays) });
  }

  function toggleDay(locationId: string, day: string) {
    const current = forms[locationId];
    if (!current) return;

    const has = current.postDays.includes(day);
    let postDays: string[];

    if (has) {
      postDays = current.postDays.filter((d) => d !== day);
    } else if (current.postDays.length >= current.postsPerWeek) {
      postDays = [...current.postDays.slice(1), day];
    } else {
      postDays = [...current.postDays, day];
    }

    const postsPerWeek = postDays.length;
    patchForm(locationId, { postDays, postsPerWeek, ...syncDayMaps(current, postDays) });
  }

  function setDayPostType(locationId: string, day: string, type: string) {
    const current = forms[locationId];
    if (!current) return;
    patchForm(locationId, {
      postDayTypes: { ...current.postDayTypes, [day]: type },
    });
  }

  function setDayPostTime(locationId: string, day: string, time: string) {
    const current = forms[locationId];
    if (!current) return;
    patchForm(locationId, {
      postDayTimes: { ...current.postDayTimes, [day]: time },
      postTime: time,
    });
  }

  function applySameTimeToAllDays(locationId: string, time: string) {
    const current = forms[locationId];
    if (!current) return;
    const ordered = WEEKDAYS.filter((d) => current.postDays.includes(d));
    const postDayTimes = { ...current.postDayTimes };
    ordered.forEach((day) => {
      postDayTimes[day] = time;
    });
    patchForm(locationId, { postDayTimes, postTime: time });
  }

  function rotateTypesForDays(locationId: string) {
    const current = forms[locationId];
    if (!current) return;
    patchForm(locationId, {
      postDayTypes: buildPostDayTypesFromRotation(current.postDays, current.postTypes),
    });
  }

  async function handleSave(locationId: string, businessName: string) {
    const form = forms[locationId];
    if (!form) return;

    if (form.postDays.length !== form.postsPerWeek) {
      setError(
        `Select exactly ${form.postsPerWeek} day(s) for ${businessName} (currently ${form.postDays.length}).`,
      );
      return;
    }

    setSavingId(locationId);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateLocationSchedule(locationId, formToPayload(form));
      setForms((prev) => ({
        ...prev,
        [locationId]: scheduleToForm(updated),
      }));
      setSuccess(`Schedule saved for ${businessName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="w-full space-y-6 pb-10">
      <PageHeader
        title="Settings"
        description="Set posting days, type, and time for each location."
      />

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {locationsLoading || loading ? (
        <ListSkeleton count={3} />
      ) : (
        <div className="space-y-6">
          {locations.map((loc) => {
            const form = forms[loc.id];
            if (!form) return null;
            const daysOk = form.postDays.length === form.postsPerWeek;
            const ordered = WEEKDAYS.filter((d) => form.postDays.includes(d));

            return (
              <Card key={loc.id} className="overflow-hidden">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/80">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{loc.businessName}</CardTitle>
                    <CardDescription className="mt-1">
                      {form.postsPerWeek} posting day{form.postsPerWeek === 1 ? '' : 's'}
                      {ordered.length > 0
                        ? ` · ${ordered.map((d) => d.slice(0, 3)).join(', ')}`
                        : ''}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    disabled={savingId === loc.id || !daysOk}
                    onClick={() => void handleSave(loc.id, loc.businessName)}
                  >
                    {savingId === loc.id ? 'Saving…' : 'Save schedule'}
                  </Button>
                </CardHeader>

                <CardContent className="space-y-8 p-6 lg:p-8">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-4">
                    <div className="shrink-0 space-y-2 sm:w-[148px]">
                      <p className="text-sm font-medium text-slate-200">Posts per week</p>
                      <Select
                        value={String(form.postsPerWeek)}
                        onValueChange={(v) => handlePostsPerWeekChange(loc.id, v)}
                      >
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} {n === 1 ? 'day' : 'days'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm text-slate-500">
                        <span className="font-medium text-slate-200">Posting days</span>
                        {' · '}
                        {form.postDays.length} selected
                      </p>
                      <div className="grid grid-cols-7 gap-2">
                        {WEEKDAYS.map((day) => {
                          const checked = form.postDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(loc.id, day)}
                              className={cn(
                                'h-11 rounded-lg border text-center text-sm font-medium transition-colors',
                                checked
                                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                              )}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <SettingsField
                    label="Schedule"
                    hint="One row per posting day."
                  >
                    <PerDayScheduleTable
                      postDays={form.postDays}
                      postDayTypes={form.postDayTypes}
                      postDayTimes={form.postDayTimes}
                      postsPerWeek={form.postsPerWeek}
                      timezone={form.timezone}
                      disabled={savingId === loc.id}
                      onDayTypeChange={(day, type) => setDayPostType(loc.id, day, type)}
                      onDayTimeChange={(day, time) => setDayPostTime(loc.id, day, time)}
                      onApplySameTime={(time) => applySameTimeToAllDays(loc.id, time)}
                      onRotateTypes={() => rotateTypesForDays(loc.id)}
                    />
                  </SettingsField>

                  <SettingsField
                    label="Towns"
                    hint="Posts pick a random town from this list. Empty falls back to the location's home city."
                  >
                    <TownsSection
                      towns={townForms[loc.id] ?? []}
                      inputValue={newTownInputs[loc.id] ?? ''}
                      disabled={townsSavingId === loc.id}
                      onInputChange={(value) =>
                        setNewTownInputs((prev) => ({ ...prev, [loc.id]: value }))
                      }
                      onAdd={() => addTown(loc.id)}
                      onRemove={(town) => removeTown(loc.id, town)}
                      onSave={() => void handleSaveTowns(loc.id, loc.businessName)}
                      saving={townsSavingId === loc.id}
                    />
                  </SettingsField>

                  <SettingsField
                    label="Offer Settings"
                    hint="Used on OFFER posts. Leave blank to omit — a coupon or URL is never fabricated."
                  >
                    <OfferSettingsSection
                      form={offerForms[loc.id] ?? { couponCode: '', terms: '', redeemUrl: '' }}
                      disabled={offerSavingId === loc.id}
                      onChange={(patch) => patchOfferForm(loc.id, patch)}
                      onSave={() => void handleSaveOfferConfig(loc.id, loc.businessName)}
                      saving={offerSavingId === loc.id}
                    />
                  </SettingsField>

                  <SettingsField
                    label="Post Length"
                    hint={`Max words per generated post (${MIN_POST_LENGTH}-${MAX_POST_LENGTH}). Defaults to ${DEFAULT_POST_LENGTH}.`}
                  >
                    <PostLengthSection
                      value={postLengthForms[loc.id] ?? String(DEFAULT_POST_LENGTH)}
                      disabled={postLengthSavingId === loc.id}
                      onChange={(value) =>
                        setPostLengthForms((prev) => ({ ...prev, [loc.id]: value }))
                      }
                      onSave={() => void handleSavePostLength(loc.id, loc.businessName)}
                      saving={postLengthSavingId === loc.id}
                    />
                  </SettingsField>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
