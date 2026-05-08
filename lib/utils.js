const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toTagLink(name) {
  return { name, slug: toSlug(name) };
}

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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

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

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeXml(str) {
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  toSlug,
  toTagLink,
  normalizeText,
  ensureDir,
  copyRecursive,
  formatDate,
  escapeXml,
};
