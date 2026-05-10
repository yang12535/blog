/**
 * Converts a string to a URL-friendly slug.
 * @param name The string to convert
 * @returns The slug string
 */
export function toSlug(name: string): string;

/**
 * Creates a tag link object with name and slug.
 * @param name The tag name
 * @returns An object with name and slug properties
 */
export function toTagLink(name: string): { name: string; slug: string };

/**
 * Normalizes text from a raw buffer by detecting encoding and converting to UTF-8.
 * @param rawBuf The raw buffer containing text
 * @returns Normalized UTF-8 string
 */
export function normalizeText(rawBuf: Buffer): string;

/**
 * Ensures a directory exists, creating it recursively if needed.
 * @param dir The directory path
 */
export function ensureDir(dir: string): void;

/**
 * Recursively copies files and directories from source to destination.
 * @param src Source directory path
 * @param dest Destination directory path
 */
export function copyRecursive(src: string, dest: string): void;

/**
 * Formats an ISO date string to YYYY-MM-DD format.
 * @param iso ISO 8601 date string
 * @returns Formatted date string
 */
export function formatDate(iso: string | Date): string;

/**
 * Escapes special XML characters in a string.
 * @param str The string to escape
 * @returns Escaped XML string
 */
export function escapeXml(str: any): string;
