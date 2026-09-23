/**
 * A single carousel slide inside a `sidecar` post.
 * `display_url` is a base64-encoded Instagram CDN URL (snake_case by design).
 */
export interface SidecarItem {
  /** Base64-encoded Instagram image URL for this slide. */
  display_url: string;
}

/** The media type of a post. Drives which fields are populated. */
export type PostType = 'image' | 'video' | 'sidecar';

/**
 * A single Instagram post as returned by StoryNavigation.
 * All media URLs are base64-encoded Instagram CDN URLs.
 */
export interface Post {
  /** Instagram short code, e.g. "DaD1mynjH8E". */
  id: string;
  type: PostType;
  isVideo: boolean;
  /** May contain unicode/emoji; can be empty. */
  caption: string;
  likesCount: number;
  commentsCount: number;
  /** Human string, not ISO — e.g. "26 June 2026 18:57:05". */
  createdTime: string;
  /** Base64-encoded IG image URL (cover frame for videos). */
  thumbnailUrl: string;
  /** Empty unless `type === 'sidecar'`. */
  sidecarItems: SidecarItem[];
  /** Base64-encoded IG video URL — only present when `type === 'video'`. */
  videoUrl?: string;
}

/** Public account information for a profile. */
export interface AccountInfo {
  id: number;
  username: string;
  fullName: string;
  biography: string;
  followsCount: number;
  followedByCount: number;
  /** Total posts on Instagram (not the number returned here — see the ~12 cap). */
  mediaCount: number;
  isPrivate: boolean;
  /** Base64-encoded IG profile picture URL. */
  profilePicUrl: string;
}

/** Aggregate statistics for a profile. */
export interface PostsStatistics {
  averageCountOfLikes: number;
  averageCountOfComments: number;
  averageTimeBetweenPosts: string;
  commentsCount: number;
  likesCount: number;
  percentOfFollowersWhoComments: number;
}

/** Full response of `POST /get-user-profile`. */
export interface Profile {
  found: boolean;
  isPrivate: boolean;
  needToLoadPosts: boolean;
  accountInfo: AccountInfo;
  posts: Post[];
  postsStatistics: PostsStatistics;
}
