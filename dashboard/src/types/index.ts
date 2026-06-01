export type PostType = 'UPDATE' | 'OFFER' | 'EVENT';
export type PostStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'POSTED'
  | 'PENDING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'FAILED';

export interface Post {
  id: string;
  locationId: string;
  type: PostType;
  content: string;
  mediaUrl: string | null;
  scheduledAt: string | null;
  postedAt: string | null;
  status: PostStatus;
  platform: string;
  createdAt: string;
}

export interface MediaRecord {
  id: string;
  locationId: string;
  postType: PostType;
  url: string;
  createdAt: string;
}

export interface PostsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedPostsResponse {
  posts: Post[];
  pagination: PostsPagination;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  requestId?: string;
}

export interface DailyJobResult {
  locationCount: number;
  ok: number;
  failed: number;
  skipped?: number;
  results: Array<{
    locationId: string;
    success: boolean;
    postId?: string;
    error?: string;
    skipped?: boolean;
    reason?: string;
  }>;
}

export interface LocationSchedule {
  id: string;
  locationId: string;
  postsPerWeek: number;
  postDays: string[];
  postTime: string;
  postTypes: string[];
  postDayTypes: Record<string, string>;
  postDayTimes: Record<string, string>;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface GhlFieldSetupResult {
  ghlLocationId: string;
  success: boolean;
  skipped?: boolean;
  lastPostDateFieldId?: string;
  postStatusFieldId?: string;
  alreadyExisted?: boolean;
  error?: string;
  code?: string;
}
