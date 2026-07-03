import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  createIndustrySchema,
  deleteIndustrySchema,
  fetchIndustrySchemasPaginated,
  updateIndustrySchema,
  type IndustrySchema,
  type IndustrySchemaPayload,
} from '../api/endpoints';
import { ErrorBanner, PageHeader, PaginatedPageLayout, Pagination, PaginationFooter, SuccessBanner } from '../components/ui';
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
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { CardListSkeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';
import { formatDate } from '../utils/format';

const emptyForm: IndustrySchemaPayload = {
  industry: '',
  displayName: '',
  systemPrompt: '',
  homePageSchema: '',
  aboutPageSchema: '',
  servicesPageSchema: '',
  contactPageSchema: '',
  locationPageSchema: '',
  blogPageSchema: '',
  isDefault: false,
};

function slugifyIndustry(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const inputClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

const textareaClass =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

function SchemaCard({
  schema,
  onEdit,
  onDelete,
}: {
  schema: IndustrySchema;
  onEdit: (schema: IndustrySchema) => void;
  onDelete: (schema: IndustrySchema) => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-white">{schema.displayName}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{schema.industry}</p>
        </div>
        {schema.isDefault ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
            Default
          </span>
        ) : null}
      </div>

      <dl className="mb-5 flex-1 space-y-2.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Industry</dt>
          <dd className="truncate font-mono text-xs text-slate-400">{schema.industry}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Display name</dt>
          <dd className="text-right text-slate-300">{schema.displayName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Default</dt>
          <dd className="text-right text-slate-300">
            {schema.isDefault ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
                Default
              </span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500">Created</dt>
          <dd className="text-right text-slate-300">{formatDate(schema.createdAt)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 min-w-[7.5rem]"
          onClick={() => onEdit(schema)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 min-w-[7.5rem] border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => onDelete(schema)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

export function IndustrySchemasPage() {
  const [schemas, setSchemas] = useState<IndustrySchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [defaultFilter, setDefaultFilter] = useState<'all' | 'default' | 'non-default'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IndustrySchema | null>(null);
  const [form, setForm] = useState<IndustrySchemaPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IndustrySchema | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSchemas = useCallback(
    async (pageOverride?: number) => {
      const targetPage = pageOverride ?? page;
      setLoading(true);
      setError(null);
      try {
        const { schemas: data, pagination } = await fetchIndustrySchemasPaginated({
          page: targetPage,
          limit: pageSize,
          search: debouncedSearch || undefined,
          default: defaultFilter,
        });
        setSchemas(data);
        setTotalItems(pagination.total);
        if (targetPage > pagination.totalPages && pagination.totalPages > 0) {
          setPage(pagination.totalPages);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load industry schemas');
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [page, pageSize, debouncedSearch, defaultFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, defaultFilter, pageSize]);

  useEffect(() => {
    void loadSchemas();
  }, [loadSchemas]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(schema: IndustrySchema) {
    setEditing(schema);
    setForm({
      industry: schema.industry,
      displayName: schema.displayName,
      systemPrompt: schema.systemPrompt,
      homePageSchema: schema.homePageSchema,
      aboutPageSchema: schema.aboutPageSchema,
      servicesPageSchema: schema.servicesPageSchema,
      contactPageSchema: schema.contactPageSchema,
      locationPageSchema: schema.locationPageSchema,
      blogPageSchema: schema.blogPageSchema,
      isDefault: schema.isDefault,
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: IndustrySchemaPayload = {
        industry: slugifyIndustry(form.industry),
        displayName: form.displayName.trim(),
        systemPrompt: form.systemPrompt.trim(),
        homePageSchema: form.homePageSchema.trim(),
        aboutPageSchema: form.aboutPageSchema.trim(),
        servicesPageSchema: form.servicesPageSchema.trim(),
        contactPageSchema: form.contactPageSchema.trim(),
        locationPageSchema: form.locationPageSchema.trim(),
        blogPageSchema: form.blogPageSchema.trim(),
        isDefault: Boolean(form.isDefault),
      };

      if (editing) {
        await updateIndustrySchema(editing.id, payload);
        setSuccess('Industry schema updated.');
      } else {
        await createIndustrySchema(payload);
        setSuccess('Industry schema created.');
      }

      setDialogOpen(false);
      await loadSchemas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save industry schema');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteIndustrySchema(deleteTarget.id);
      setSuccess(`Schema "${deleteTarget.displayName}" deleted.`);
      setDeleteTarget(null);
      const nextPage = schemas.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadSchemas(nextPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete industry schema');
    } finally {
      setDeleting(false);
    }
  }

  const hasActiveFilters = debouncedSearch.length > 0 || defaultFilter !== 'all';
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  return (
    <PaginatedPageLayout
      footer={
        !initialLoad && totalItems > 0 ? (
          <PaginationFooter className={cn(loading && 'pointer-events-none opacity-60')}>
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={totalItems}
              itemLabel="schemas"
              pageSizeOptions={[6, 12, 24, 48]}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPageSizeChange={(size) => setPageSize(size)}
            />
          </PaginationFooter>
        ) : null
      }
    >
      <PageHeader
        title="Industry Schemas"
        description="Manage AI content schemas for each industry."
        action={
          <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add Schema
          </Button>
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search industry or display name…"
            disabled={loading && initialLoad}
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm text-slate-400" htmlFor="schema-default-filter">
            Default
          </label>
          <Select
            value={defaultFilter}
            onValueChange={(value) =>
              setDefaultFilter(value as 'all' | 'default' | 'non-default')
            }
            disabled={loading && initialLoad}
          >
            <SelectTrigger id="schema-default-filter" className="w-full sm:w-[180px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="default">Default only</SelectItem>
              <SelectItem value="non-default">Non-default</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${totalItems} schema${totalItems === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="flex-1">
      {loading && schemas.length === 0 ? (
        <CardListSkeleton count={6} />
      ) : (
        <div className="relative min-h-[12rem]">
          {loading ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-950/70 backdrop-blur-[1px]"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                Loading schemas…
              </div>
            </div>
          ) : null}

          {schemas.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 py-16 text-center text-sm text-slate-500">
              {hasActiveFilters
                ? 'No schemas match your filters.'
                : 'No industry schemas yet. Add one to get started.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {schemas.map((schema) => (
                <SchemaCard
                  key={schema.id}
                  schema={schema}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,100dvh)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Industry Schema' : 'Add Industry Schema'}</DialogTitle>
            <DialogDescription>
              Configure AI prompts and JSON page schemas for an industry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Industry slug
                </label>
                <input
                  type="text"
                  required
                  value={form.industry}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      industry: slugifyIndustry(e.target.value),
                    }))
                  }
                  className={inputClass}
                  placeholder="automotive"
                  disabled={Boolean(editing)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className={inputClass}
                  placeholder="Automotive"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(form.isDefault)}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500/40"
              />
              Set as default schema (only one can be default)
            </label>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                System Prompt
              </label>
              <textarea
                rows={6}
                required
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                className={cn(textareaClass, 'text-sm')}
                placeholder="AI instructions for content generation..."
              />
            </div>

            {(
              [
                ['homePageSchema', 'Home Page Schema (JSON)'],
                ['aboutPageSchema', 'About Page Schema (JSON)'],
                ['servicesPageSchema', 'Services Page Schema (JSON)'],
                ['contactPageSchema', 'Contact Page Schema (JSON)'],
                ['locationPageSchema', 'Location Page Schema (JSON)'],
                ['blogPageSchema', 'Blog Page Schema (JSON)'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
                <textarea
                  rows={4}
                  required
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className={textareaClass}
                  placeholder="{}"
                />
              </div>
            ))}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete industry schema?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the schema for &quot;{deleteTarget?.displayName}&quot;.
              This cannot be undone if sites are using this industry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PaginatedPageLayout>
  );
}
