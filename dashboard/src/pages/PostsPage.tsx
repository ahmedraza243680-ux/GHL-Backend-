import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  approvePost,
  fetchPostsPaginated,
  publishPost,
  rejectPost,
} from '../api/endpoints';
import { PostCard } from '../components/PostCard';
import { PostDetailModal } from '../components/PostDetailModal';
import { PostMediaThumb } from '../components/PostMediaThumb';
import {
  ErrorBanner,
  PageHeader,
  Pagination,
  StatusBadge,
  SuccessBanner,
} from '../components/ui';
import {
  PostFormFields,
  formValuesToPayload,
  type PostFormValues,
} from '../components/PostFormFields';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { CardListSkeleton, TableSkeleton } from '../components/ui/skeleton';
import { useLocations } from '../contexts/LocationsContext';
import type { Post } from '../types';
import { formatDate, truncate } from '../utils/format';

export function PostsPage() {
  const { locations, loading: locationsLoading } = useLocations();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationIdFromUrl = searchParams.get('locationId');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewPost, setViewPost] = useState<Post | null>(null);

  const [formValues, setFormValues] = useState<PostFormValues>({
    type: 'UPDATE',
    content: '',
    mediaUrl: '',
    scheduledAt: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (locationsLoading || locations.length === 0) return;

    const fromUrl =
      locationIdFromUrl &&
      locations.some((loc) => loc.id === locationIdFromUrl)
        ? locationIdFromUrl
        : null;

    if (fromUrl) {
      if (selectedLocationId !== fromUrl) {
        setSelectedLocationId(fromUrl);
        setPage(1);
      }
      return;
    }

    if (!selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, locationsLoading, locationIdFromUrl, selectedLocationId]);

  function handleLocationChange(locationId: string) {
    setSelectedLocationId(locationId);
    setPage(1);
    setSearchParams({ locationId }, { replace: true });
  }

  const loadPosts = useCallback(
    async (pageOverride?: number) => {
      if (!selectedLocationId) return;
      const targetPage = pageOverride ?? page;
      setLoading(true);
      setError(null);
      try {
        const { posts: data, pagination } = await fetchPostsPaginated(
          selectedLocationId,
          targetPage,
          pageSize,
        );
        setPosts(data);
        setTotalItems(pagination.total);
        if (targetPage > pagination.totalPages && pagination.totalPages > 0) {
          setPage(pagination.totalPages);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    },
    [selectedLocationId, page, pageSize],
  );

  useEffect(() => {
    if (selectedLocationId) {
      void loadPosts();
    }
  }, [loadPosts, selectedLocationId]);

  useEffect(() => {
    setPage(1);
  }, [selectedLocationId, pageSize]);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await publishPost(selectedLocationId, formValuesToPayload(formValues));
      setSuccess('Test post published successfully.');
      setModalOpen(false);
      setFormValues({
        type: 'UPDATE',
        content: '',
        mediaUrl: '',
        scheduledAt: '',
      });
      setPage(1);
      await loadPosts(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  return (
    <div>
      <PageHeader
        title="Posts"
        description="View and manage posts for each location."
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!selectedLocationId}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
          >
            Publish Test Post
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <div className="mb-6">
        <label className="mb-2 block text-sm text-slate-400">Select Location</label>
        {locationsLoading ? (
          <div className="h-10 max-w-md animate-pulse rounded-lg bg-slate-800" />
        ) : (
          <Select value={selectedLocationId} onValueChange={handleLocationChange}>
            <SelectTrigger className="w-full max-w-none lg:max-w-md">
              <SelectValue placeholder="Choose a location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.businessName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedLocation ? (
          <p className="mt-2 font-mono text-xs text-slate-500">
            GHL ID: {selectedLocation.ghlLocationId}
          </p>
        ) : null}
      </div>

      {loading ? (
        <>
          <div className="lg:hidden">
            <CardListSkeleton count={3} />
          </div>
          <div className="hidden lg:block">
            <TableSkeleton rows={pageSize > 5 ? 5 : pageSize} />
          </div>
        </>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 py-12 text-center text-sm text-slate-500">
          No posts found for this location.
        </div>
      ) : (
        <>
          {/* Mobile / tablet cards */}
          <div className="space-y-4 lg:hidden">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onViewDetails={() => setViewPost(post)}
              />
            ))}
            <div className="rounded-xl border border-slate-800">
              <Pagination
                page={safePage}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-800 lg:block">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Content
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    Media
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
                      {formatDate(post.postedAt ?? post.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{post.type}</td>
                    <td className="max-w-xs px-4 py-3 text-sm text-slate-400">
                      {truncate(post.content, 100)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={post.status} />
                    </td>
                    <td className="px-4 py-3">
                      {post.mediaUrl ? (
                        <PostMediaThumb url={post.mediaUrl} />
                      ) : (
                        <span className="text-xs text-slate-600">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setViewPost(post)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={safePage}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}

      <PostDetailModal
        post={viewPost}
        locationId={selectedLocationId}
        locationName={selectedLocation?.businessName}
        open={!!viewPost}
        onOpenChange={(open) => {
          if (!open) setViewPost(null);
        }}
        onUpdated={(updated) => {
          setViewPost(updated);
          setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setSuccess('Post updated successfully.');
        }}
        onDeleted={() => {
          setViewPost(null);
          setSuccess('Post deleted successfully.');
          void loadPosts();
        }}
        onApprove={
          viewPost?.status === 'PENDING'
            ? async (postId) => {
                await approvePost(selectedLocationId, postId);
                setSuccess('Post approved.');
                await loadPosts();
              }
            : undefined
        }
        onReject={
          viewPost?.status === 'PENDING'
            ? async (postId) => {
                await rejectPost(selectedLocationId, postId);
                setSuccess('Post rejected.');
                await loadPosts();
              }
            : undefined
        }
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Publish Test Post</DialogTitle>
            <DialogDescription>
              Create a post for {selectedLocation?.businessName ?? 'selected location'} with
              content, image, and optional schedule.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePublish} className="space-y-4">
            <PostFormFields
              locationId={selectedLocationId}
              values={formValues}
              onChange={setFormValues}
              disabled={submitting}
              idPrefix="publish-post"
            />
            <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formValues.content.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
