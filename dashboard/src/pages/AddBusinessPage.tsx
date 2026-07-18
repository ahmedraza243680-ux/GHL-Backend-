import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  createBusiness,
  fetchGoogleAccounts,
  fetchGoogleLocations,
  getGoogleAuthUrl,
  saveGoogleLocation,
  type GoogleAccount,
  type GoogleGbpLocation,
} from '../api/endpoints';
import { useLocations } from '../contexts/LocationsContext';
import { ErrorBanner, PageHeader, SuccessBanner } from '../components/ui';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-300';

const CATEGORY_OPTIONS = [
  'HVAC',
  'Automotive',
  'Restaurant',
  'Plumbing',
  'Electrical',
  'Landscaping',
  'Cleaning',
  'Beauty & Spa',
  'Business Services',
  'General',
];

/** Sentinel value for the "add a custom category" dropdown option. */
const CUSTOM_CATEGORY = '__custom__';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
];

type Step = 'form' | 'connect' | 'select';

const STEPS: { id: Step; label: string }[] = [
  { id: 'form', label: 'Business details' },
  { id: 'connect', label: 'Connect Google' },
  { id: 'select', label: 'Pick GBP location' },
];

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <div key={step.id} className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-emerald-500 text-white'
                    : isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={`text-sm ${isActive ? 'font-medium text-white' : 'text-slate-500'}`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <ChevronRight className="h-4 w-4 text-slate-700" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AddBusinessPage() {
  const navigate = useNavigate();
  const { refresh } = useLocations();

  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Step 1 form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [postDays, setPostDays] = useState<string[]>(['Monday', 'Wednesday', 'Friday']);
  const [postTime, setPostTime] = useState('09:00');
  const [submitting, setSubmitting] = useState(false);

  // Created records
  const [newLocationId, setNewLocationId] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');

  // Step 2 (connect) state
  const [connecting, setConnecting] = useState(false);
  const [awaitingOAuth, setAwaitingOAuth] = useState(false);
  const [consentUrl, setConsentUrl] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Step 3 (select) state
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [gbpLocations, setGbpLocations] = useState<GoogleGbpLocation[]>([]);
  const [selectedGbpLocationId, setSelectedGbpLocationId] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [saving, setSaving] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
      try {
        popupRef.current?.close();
      } catch {
        // Ignore — nothing we can do if the popup can't be closed.
      }
    };
  }, [stopPolling]);

  function toggleDay(day: string) {
    setPostDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Business name is required.');
      return;
    }
    if (postDays.length === 0) {
      setError('Select at least one posting day.');
      return;
    }

    const resolvedCategory =
      category === CUSTOM_CATEGORY ? customCategory.trim() : category;
    if (category === CUSTOM_CATEGORY && !resolvedCategory) {
      setError('Enter your custom category, or pick one from the list.');
      return;
    }

    setSubmitting(true);
    try {
      const { business, location } = await createBusiness({
        name: trimmedName,
        category: resolvedCategory || null,
        city: city.trim() || null,
        timezone,
        postDays,
        postTime,
      });
      setNewLocationId(location.id);
      setNewBusinessName(business.name);
      await refresh();
      setNotice(`Created "${business.name}". Next, connect Google to pick its Business Profile.`);
      setStep('connect');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business.');
    } finally {
      setSubmitting(false);
    }
  }

  const proceedToSelect = useCallback((found: GoogleAccount[]) => {
    // Close the OAuth popup once we've detected the connection so the user
    // doesn't have to dismiss the "Google account linked" page manually.
    try {
      popupRef.current?.close();
    } catch {
      // Ignore — popup may already be closed or blocked from closing.
    }
    popupRef.current = null;
    setAccounts(found);
    setSelectedAccountId((prev) => prev || found[0]?.accountId || '');
    setAwaitingOAuth(false);
    setNotice('Google connected. Choose the Business Profile location that matches this business.');
    setStep('select');
  }, []);

  // The OAuth callback page posts a message when it links the account, then
  // closes itself. React to it immediately instead of waiting for the poll.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as
        | { type?: string; status?: string; locationId?: string }
        | null;
      if (!data || data.type !== 'peakwa-google-oauth' || data.status !== 'success') return;
      if (!newLocationId || (data.locationId && data.locationId !== newLocationId)) return;

      // The message only signals completion — confirm real tokens exist before
      // advancing, so a stray/spoofed message can never fake a connection.
      void fetchGoogleAccounts(newLocationId)
        .then((found) => {
          if (found && found.length > 0) {
            stopPolling();
            proceedToSelect(found);
          }
        })
        .catch(() => {
          // Ignore — polling remains as the fallback.
        });
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [newLocationId, proceedToSelect, stopPolling]);

  const startPolling = useCallback(
    (locationId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const found = await fetchGoogleAccounts(locationId);
          if (found && found.length > 0) {
            stopPolling();
            proceedToSelect(found);
          }
        } catch {
          // Not connected yet — keep polling until the user finishes OAuth.
        }
      }, 3000);
    },
    [proceedToSelect, stopPolling],
  );

  async function handleConnectGoogle() {
    setError(null);
    setConnecting(true);
    try {
      const url = await getGoogleAuthUrl(newLocationId);
      setConsentUrl(url);
      popupRef.current = window.open(url, 'peakwa-google-oauth', 'width=520,height=720');
      setAwaitingOAuth(true);
      startPolling(newLocationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Google connection.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleManualCheck() {
    setError(null);
    try {
      const found = await fetchGoogleAccounts(newLocationId);
      if (found && found.length > 0) {
        stopPolling();
        proceedToSelect(found);
      } else {
        setError('No Google account found yet. Finish the Google sign-in, then try again.');
      }
    } catch {
      setError('Google is not connected yet. Complete the sign-in in the popup, then try again.');
    }
  }

  // Load GBP locations whenever the selected Google account changes.
  useEffect(() => {
    if (step !== 'select' || !selectedAccountId || !newLocationId) return;
    let cancelled = false;
    setLoadingLocations(true);
    setError(null);
    fetchGoogleLocations(newLocationId, selectedAccountId)
      .then((locs) => {
        if (!cancelled) {
          setGbpLocations(locs);
          setSelectedGbpLocationId('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load GBP locations.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLocations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedAccountId, newLocationId]);

  async function handleSaveSelection() {
    if (!selectedGbpLocationId) {
      setError('Pick a Google Business Profile location.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveGoogleLocation(newLocationId, {
        googleAccountId: selectedAccountId,
        googleLocationId: selectedGbpLocationId,
      });
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the selected location.');
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Add Business"
        description="Create a business and location, connect Google, and link its Business Profile."
      />

      <Stepper current={step} />

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <SuccessBanner message={notice} /> : null}

      <section className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
        {step === 'form' ? (
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>
                Business name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className={inputClass}
                placeholder="e.g. Peakwa Plumbing"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Category</label>
                <Select value={category} onValueChange={setCategory} disabled={submitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_CATEGORY}>+ Add custom category…</SelectItem>
                  </SelectContent>
                </Select>
                {category === CUSTOM_CATEGORY ? (
                  <input
                    type="text"
                    autoFocus
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    disabled={submitting}
                    className={`${inputClass} mt-2`}
                    placeholder="Type your category, e.g. Roofing"
                  />
                ) : null}
              </div>

              <div>
                <label htmlFor="city" className={labelClass}>
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                  placeholder="e.g. Hackensack"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Posting days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = postDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      disabled={submitting}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {postDays.length} day{postDays.length === 1 ? '' : 's'} selected
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="postTime" className={labelClass}>
                  Posting time
                </label>
                <input
                  id="postTime"
                  type="time"
                  value={postTime}
                  onChange={(e) => setPostTime(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Timezone</label>
                <Select value={timezone} onValueChange={setTimezone} disabled={submitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              {submitting ? 'Creating…' : 'Create business'}
            </Button>
          </form>
        ) : null}

        {step === 'connect' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Connect Google</h2>
              <p className="mt-1 text-sm text-slate-400">
                Sign in with the Google account that manages{' '}
                <span className="font-medium text-slate-200">{newBusinessName}</span>&apos;s Business
                Profile. A popup will open for Google sign-in.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleConnectGoogle} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {connecting ? 'Opening…' : 'Connect Google'}
              </Button>

              {awaitingOAuth ? (
                <Button variant="outline" onClick={handleManualCheck}>
                  <RefreshCw className="h-4 w-4" />
                  I&apos;ve connected — continue
                </Button>
              ) : null}
            </div>

            {awaitingOAuth ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                Waiting for Google sign-in to complete…
              </div>
            ) : null}

            {consentUrl ? (
              <p className="text-xs text-slate-500">
                Popup blocked?{' '}
                <a
                  href={consentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline hover:text-emerald-300"
                >
                  Open the Google consent page in a new tab
                </a>
                .
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'select' ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Pick the Business Profile</h2>
              <p className="mt-1 text-sm text-slate-400">
                Select the Google Business Profile location that matches{' '}
                <span className="font-medium text-slate-200">{newBusinessName}</span>.
              </p>
            </div>

            {accounts.length > 1 ? (
              <div>
                <label className={labelClass}>Google account</label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.accountId} value={acc.accountId}>
                        {acc.name ?? acc.accountId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <label className={labelClass}>Business Profile location</label>
              {loadingLocations ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Loading locations…
                </div>
              ) : gbpLocations.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No Business Profile locations found under this account.
                </p>
              ) : (
                <Select
                  value={selectedGbpLocationId}
                  onValueChange={setSelectedGbpLocationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {gbpLocations.map((loc) => (
                      <SelectItem key={loc.locationId ?? ''} value={loc.locationId ?? ''}>
                        {loc.title ?? loc.locationId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              onClick={handleSaveSelection}
              disabled={saving || !selectedGbpLocationId}
              className="w-full sm:w-auto"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save & go to Overview'}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
