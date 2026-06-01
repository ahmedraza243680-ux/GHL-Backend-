import { applyLocationMapping } from '../config/locations';
import api from './client';
import type { Location, LocationSummary, PendingPostItem } from '../types/location';
import type {
  ApiResponse,
  DailyJobResult,
  GhlFieldSetupResult,
  LocationSchedule,
  MediaRecord,
  PaginatedPostsResponse,
  Post,
} from '../types';

export async function fetchLocations(): Promise<Location[]> {
  const { data } = await api.get<ApiResponse<{ locations: Location[] }>>('/locations');
  return data.data.locations.map(applyLocationMapping);
}

export async function fetchLocationSummaries(): Promise<LocationSummary[]> {
  const { data } = await api.get<ApiResponse<{ summaries: LocationSummary[] }>>(
    '/locations/summary',
  );
  return data.data.summaries.map(applyLocationMapping);
}

export async function fetchPendingPosts(): Promise<PendingPostItem[]> {
  const { data } = await api.get<ApiResponse<{ posts: PendingPostItem[]; total: number }>>(
    '/locations/pending-posts',
  );
  return data.data.posts;
}

export async function fetchPosts(locationId: string): Promise<Post[]> {
  const { data } = await api.get<ApiResponse<{ posts: Post[] }>>(
    `/locations/${locationId}/posts`,
  );
  return data.data.posts;
}

export async function fetchPostsPaginated(
  locationId: string,
  page: number,
  limit: number,
): Promise<PaginatedPostsResponse> {
  const { data } = await api.get<
    ApiResponse<{ posts: Post[]; pagination: PaginatedPostsResponse['pagination'] }>
  >(`/locations/${locationId}/posts`, {
    params: { page, limit },
  });

  return {
    posts: data.data.posts,
    pagination: data.data.pagination,
  };
}

export interface PostWritePayload {
  type: string;
  content: string;
  mediaUrl?: string | null;
  scheduledAt?: string | null;
}

export async function publishPost(
  locationId: string,
  payload: PostWritePayload,
): Promise<Post> {
  const { data } = await api.post<ApiResponse<Post>>(
    `/locations/${locationId}/posts/publish`,
    payload,
  );
  return data.data;
}

export async function approvePost(locationId: string, postId: string): Promise<Post> {
  const { data } = await api.post<ApiResponse<Post>>(
    `/locations/${locationId}/posts/${postId}/approve`,
  );
  return data.data;
}

export async function rejectPost(locationId: string, postId: string): Promise<Post> {
  const { data } = await api.post<ApiResponse<Post>>(
    `/locations/${locationId}/posts/${postId}/reject`,
  );
  return data.data;
}

export async function runDailyJob(): Promise<DailyJobResult> {
  const { data } = await api.post<ApiResponse<DailyJobResult>>(
    '/jobs/run-daily-job',
    {},
    { timeout: 300000 },
  );
  return data.data;
}

export async function setupGhlFields(): Promise<GhlFieldSetupResult[]> {
  const { data } = await api.post<ApiResponse<{ results: GhlFieldSetupResult[] }>>(
    '/setup/ghl-fields',
    {},
    { timeout: 120000 },
  );
  return data.data.results;
}

export async function fetchMedia(locationId: string): Promise<MediaRecord[]> {
  const { data } = await api.get<ApiResponse<{ media: MediaRecord[] }>>(
    `/locations/${locationId}/media`,
  );
  return data.data.media;
}

export async function deleteMedia(
  locationId: string,
  mediaId: string,
): Promise<{ deleted: boolean; mediaId: string }> {
  const { data } = await api.delete<
    ApiResponse<{ deleted: boolean; mediaId: string }>
  >(`/locations/${locationId}/media/${mediaId}`);
  return data.data;
}

export async function uploadMedia(
  locationId: string,
  file: File,
  postType: string,
): Promise<{ url: string; media: MediaRecord }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('postType', postType);

  const { data } = await api.post<
    ApiResponse<{ url: string; media: MediaRecord }>
  >(`/locations/${locationId}/media/upload`, formData);
  return data.data;
}

export async function fetchPost(locationId: string, postId: string): Promise<Post> {
  const { data } = await api.get<ApiResponse<Post>>(
    `/locations/${locationId}/posts/${postId}`,
  );
  return data.data;
}

export async function updatePost(
  locationId: string,
  postId: string,
  payload: PostWritePayload,
): Promise<Post> {
  const { data } = await api.patch<ApiResponse<Post>>(
    `/locations/${locationId}/posts/${postId}`,
    payload,
  );
  return data.data;
}

export async function deletePost(
  locationId: string,
  postId: string,
): Promise<{ deleted: boolean; postId: string }> {
  const { data } = await api.delete<
    ApiResponse<{ deleted: boolean; postId: string }>
  >(`/locations/${locationId}/posts/${postId}`);
  return data.data;
}

export async function fetchLocationSchedule(
  locationId: string,
): Promise<LocationSchedule> {
  const { data } = await api.get<ApiResponse<{ schedule: LocationSchedule }>>(
    `/locations/${locationId}/schedule`,
  );
  return data.data.schedule;
}

export interface LocationSchedulePayload {
  postsPerWeek: number;
  postDays: string[];
  postTime: string;
  postTypes: string[];
  postDayTypes: Record<string, string>;
  postDayTimes: Record<string, string>;
  timezone: string;
}

export async function updateLocationSchedule(
  locationId: string,
  payload: LocationSchedulePayload,
): Promise<LocationSchedule> {
  const { data } = await api.put<ApiResponse<{ schedule: LocationSchedule }>>(
    `/locations/${locationId}/schedule`,
    payload,
  );
  return data.data.schedule;
}
