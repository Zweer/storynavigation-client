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
  percentOfFollowersWhoLikes: number;
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

/**
 * A saved highlight cover as returned by `POST /get-user-highlights`.
 * Use {@link Highlight.id} as the `highlightId` for `get-highlight-stories`.
 */
export interface Highlight {
  /** Highlight id, e.g. "18195781759377100". */
  id: string;
  /** Display title, e.g. "Roman". */
  title: string;
  /** Base64-encoded IG cover image URL. */
  imageThumbnail: string;
}

/** The media type of a story item. */
export type StoryType = 'image' | 'video';

/**
 * A single item inside a highlight, as returned by
 * `POST /get-highlight-stories`. Leaner than {@link Post}.
 */
export interface StoryItem {
  type: StoryType;
  /** Space-separated timestamp, e.g. "2026-08-30 11:00:53" (not ISO-T). */
  createdTime: string;
  /** Base64-encoded IG image URL (poster / still). */
  thumbnailUrl: string;
  /** Base64-encoded IG video URL — only present when `type === 'video'`. */
  videoUrl?: string;
}

/**
 * A currently-active story as returned by `POST /get-user-last-stories`.
 * Ephemeral (24h) — download immediately (see `media.md`).
 */
export interface Story {
  /** Composite id "mediaId_ownerId", e.g. "3991908919060144294_528817151". */
  id: string;
  type: StoryType;
  /** Base64-encoded IG image URL (poster). */
  thumbnailUrl: string;
  /** Base64-encoded IG media URL (image or video). */
  url: string;
  /** Time-of-day string, e.g. "15:57:27". */
  createdTime: string;
  /** Unix timestamp (seconds) when the story was taken. */
  taken_at: number;
  /** Unix timestamp (seconds) when the story expires. */
  expiring_at: number;
  /** Numeric IG user id as a string. */
  owner_id: string;
}

/** Wrapper object returned by `POST /get-user-last-stories`. */
export interface LastStoriesResponse {
  lastStories: Story[];
}

/**
 * A comment on a post, as returned by `POST /get-media-comments`.
 * Field names are snake_case (matching the API); `child_comments` is recursive.
 */
export interface Comment {
  /** Human string, e.g. "21 September 2026 09:48:23" (not ISO). */
  created_at: string;
  /** Comment body; may contain @mentions / unicode / emoji. */
  text: string;
  /** Commenter's IG handle. */
  user_name: string;
  /** Base64-encoded IG avatar URL. */
  profile_pic_url: string;
  /** Nested replies; `[]` when there are none. */
  child_comments: Comment[];
}
