export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface TagLink {
  name: string;
  slug: string;
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  dateDisplay: string;
  tags: string[];
  tagLinks: TagLink[];
  excerpt: string;
  content: string;
  draft: boolean;
  hidden: boolean;
  toc: TocItem[];
  prev: Post | null;
  next: Post | null;
}

export interface PullContentResult {
  success: boolean;
  skipped?: boolean;
  copied: number;
  error?: string;
}

export interface ParsePostsResult {
  posts: Post[];
  failed: number;
  failures: string[];
}

/**
 * Pulls content from an external Git repository if configured via environment variables.
 * @param postsDir The directory to copy markdown posts into
 */
export function pullContent(postsDir: string): Promise<PullContentResult>;

/**
 * Parses all markdown posts in a directory.
 * @param postsDir Directory containing markdown files
 * @returns Parsed posts result with posts sorted by date (newest first), with prev/next links
 */
export function parsePosts(postsDir: string): Promise<ParsePostsResult>;
