const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

/**
 * Converts a string to a URL-friendly slug.
 * @param {string} name - The string to convert
 * @returns {string}
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Creates a tag link object with name and slug.
 * @param {string} name - The tag name
 * @returns {{ name: string, slug: string }}
 */
function toTagLink(name) {
  return { name, slug: toSlug(name) };
}

/**
 * Normalizes text from a raw buffer by detecting encoding and converting to UTF-8.
 * @param {Buffer} rawBuf - The raw buffer containing text
 * @returns {string}
 */
function normalizeText(rawBuf) {
  const det = jschardet.detect(rawBuf);
  let encoding = (det && det.encoding) ? det.encoding.toLowerCase() : 'utf-8';
  if (encoding === 'ascii') encoding = 'utf-8';

  let str;
  if (encoding === 'utf-8' || encoding === 'utf8') {
    str = rawBuf.toString('utf-8');
  } else {
    str = iconv.decode(rawBuf, encoding);
  }

  if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1);
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return str;
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 * @param {string} dir - The directory path
 * @returns {void}
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Recursively copies files and directories from source to destination.
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 * @returns {void}
 */
function copyRecursive(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Formats an ISO date string to YYYY-MM-DD format.
 * @param {string} iso - ISO 8601 date string
 * @returns {string}
 */
function formatDate(iso) {
  if (typeof iso === 'string') {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Escapes special XML characters in a string.
 * @param {string} str - The string to escape
 * @returns {string}
 */
function escapeXml(str) {
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(text, color) {
  return COLORS[color] + text + COLORS.reset;
}

function getAllMdFiles(dir) {
  const files = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function log(msg) { console.log(msg); }

module.exports = {
  toSlug,
  toTagLink,
  normalizeText,
  ensureDir,
  copyRecursive,
  formatDate,
  escapeXml,
  COLORS,
  colorize,
  getAllMdFiles,
  log,
};
