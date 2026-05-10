import { Post, TagLink } from './content';
import { RenderFunction } from './renderer';

export interface SiteContext {
  title: string;
  description: string;
  url: string;
  icp: string;
  psb: string;
  giscus: Record<string, any>;
}

export interface GeneratorOptions {
  outputDir: string;
  render: RenderFunction;
  siteCtx: SiteContext;
}

export interface IndexPageOptions extends GeneratorOptions {
  allTags: TagLink[];
  archiveYears: number[];
  postsPerPage: number;
}

export interface RssOptions {
  outputDir: string;
  siteUrl: string;
  title: string;
  description: string;
}

export interface SitemapOptions {
  outputDir: string;
  siteUrl: string;
  allTags: TagLink[];
}

export interface RobotsOptions {
  outputDir: string;
  siteUrl: string;
}

export interface AssetsOptions {
  outputDir: string;
  assetsDir: string;
}

export interface TagPageResult {
  allTags: TagLink[];
  archiveYears: number[];
}

export interface GeneratorResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Generates individual post HTML pages.
 */
export function generatePosts(published: Post[], options: GeneratorOptions): GeneratorResult;

/**
 * Generates paginated index pages.
 */
export function generateIndexPages(published: Post[], options: IndexPageOptions): GeneratorResult;

/**
 * Generates tag cloud and individual tag pages.
 * @returns Tags list and archive years for use by other generators
 */
export function generateTagPages(published: Post[], options: GeneratorOptions): GeneratorResult & TagPageResult;

/**
 * Generates the archive page grouped by year.
 */
export function generateArchive(published: Post[], options: GeneratorOptions): GeneratorResult;

/**
 * Generates the RSS feed XML file.
 */
export function generateRss(published: Post[], options: RssOptions): GeneratorResult;

/**
 * Generates the sitemap.xml file.
 */
export function generateSitemap(published: Post[], options: SitemapOptions): GeneratorResult;

/**
 * Generates the robots.txt file.
 */
export function generateRobots(options: RobotsOptions): GeneratorResult;

/**
 * Copies static assets to the output directory.
 */
export function copyAssets(options: AssetsOptions): GeneratorResult;
