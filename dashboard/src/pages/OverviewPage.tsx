import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { deleteBusiness, fetchLocationSummaries, runDailyJob } from '../api/endpoints';
import {
  ErrorBanner,
  StatusBadge,
  SuccessBanner,
} from '../components/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { CardGridSkeleton } from '../components/ui/skeleton';
import { useLocations } from '../contexts/LocationsContext';
import type { LocationSummary } from '../types/location';
import { formatDate, isToday } from '../utils/format';

function hasLivePostToday(summary: LocationSummary): boolean {
  if (!summary.lastPost?.postedAt) return false;
  return isToday(summary.lastPost.postedAt);
}

export function OverviewPage() {
  const { refresh: refreshLocations } = useLocations();
  const [summaries, setSummaries] = useState<LocationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobRunning, setJobRunning] = useState(false);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummaries(await fetchLocationSummaries());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleRunDailyJob() {
    setJobRunning(true);
    setJobMessage(null);
    setError(null);
    try {
      const result = await runDailyJob();
      if (result.failed > 0) {
        const firstError = result.results.find((r) => !r.success)?.error;
        setError(
          firstError
            ? `Daily job: ${result.ok} succeeded, ${result.failed} failed. ${firstError}`
            : `Daily job: ${result.ok} succeeded, ${result.failed} failed.`,
        );
        setJobMessage(null);
      } else {
        setJobMessage(
          `Daily job complete: ${result.ok} succeeded across ${result.locationCount} locations.`,
        );
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daily job failed');
    } finally {
      setJobRunning(false);
    }
  }

  async function handleDeleteBusiness() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    setJobMessage(null);
    try {
      await deleteBusiness(deleteTarget.businessId);
      setJobMessage(`"${deleteTarget.businessName}" was deleted.`);
      setDeleteTarget(null);
      await Promise.all([loadData(), refreshLocations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete business');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Overview Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor all businesses and their latest post activity.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleRunDailyJob}
            disabled={jobRunning}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {jobRunning ? 'Running… (may take 1-3 min)' : 'Run Daily Job'}
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {jobMessage ? <SuccessBanner message={jobMessage} /> : null}

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <article
              key={summary.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{summary.businessName}</h2>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    GHL: {summary.ghlLocationId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasLivePostToday(summary) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(summary)}
                    aria-label={`Delete ${summary.businessName}`}
                    title="Delete business"
                    className="rounded-lg border border-slate-700 p-2 text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Last Post Date</dt>
                  <dd className="text-right text-slate-200">
                    {formatDate(
                      summary.lastPost?.postedAt ?? summary.lastPost?.createdAt,
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Post Status</dt>
                  <dd>
                    {summary.lastPost ? (
                      <StatusBadge status={summary.lastPost.status} />
                    ) : (
                      <span className="text-slate-500">No posts</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Total Posts</dt>
                  <dd className="font-medium text-white">{summary.totalPosts}</dd>
                </div>
                {summary.pendingCount > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Pending Approval</dt>
                    <dd className="font-medium text-amber-400">{summary.pendingCount}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-6 flex gap-2 border-t border-slate-800 pt-4">
                <Link
                  to={`/posts?locationId=${summary.id}`}
                  className="flex-1 rounded-lg border border-slate-700 py-2 text-center text-xs text-slate-300 hover:bg-slate-800"
                >
                  View Posts
                </Link>
                <Link
                  to="/daily-job"
                  className="flex-1 rounded-lg bg-slate-800 py-2 text-center text-xs text-slate-300 hover:bg-slate-700"
                >
                  Run Job
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this business?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{' '}
              <span className="font-medium text-slate-200">
                {deleteTarget?.businessName}
              </span>{' '}
              and all of its posts, media, and schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              loading={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteBusiness();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete business'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
