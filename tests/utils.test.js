const {
  toSlug,
  toTagLink,
  normalizeText,
  ensureDir,
  copyRecursive,
  formatDate,
  escapeXml,
} = require('../lib/utils');
const fs = require('fs');
const path = require('path');

describe('toSlug', () => {
  it('converts English text to lowercase slug', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('replaces underscores and multiple spaces with single hyphen', () => {
    expect(toSlug('Hello__World  Test')).toBe('hello-world-test');
  });

  it('removes special characters except Chinese and hyphens', () => {
    expect(toSlug('Hello!@#$%World')).toBe('helloworld');
  });

  it('preserves Chinese characters', () => {
    expect(toSlug('你好世界')).toBe('你好世界');
  });

  it('handles mixed Chinese and English', () => {
    expect(toSlug('Hello 你好 World 世界')).toBe('hello-你好-world-世界');
  });

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('-Hello World-')).toBe('hello-world');
    expect(toSlug('---Hello---')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(toSlug('')).toBe('');
  });

  it('returns empty string for input with only special characters', () => {
    expect(toSlug('!@#$%')).toBe('');
  });

  it('handles numbers correctly', () => {
    expect(toSlug('Hello 123 World')).toBe('hello-123-world');
  });

  it('handles single character', () => {
    expect(toSlug('A')).toBe('a');
  });

  it('throws error for null input', () => {
    expect(() => toSlug(null)).toThrow();
  });

  it('throws error for undefined input', () => {
    expect(() => toSlug(undefined)).toThrow();
  });
});

describe('toTagLink', () => {
  it('returns name and slug object', () => {
    expect(toTagLink('JavaScript')).toEqual({ name: 'JavaScript', slug: 'javascript' });
  });

  it('handles Chinese tag name', () => {
    expect(toTagLink('前端开发')).toEqual({ name: '前端开发', slug: '前端开发' });
  });

  it('handles empty string', () => {
    expect(toTagLink('')).toEqual({ name: '', slug: '' });
  });
});

describe('normalizeText', () => {
  it('handles UTF-8 buffer with BOM', () => {
    const buf = Buffer.from('\uFEFFHello World', 'utf-8');
    expect(normalizeText(buf)).toBe('Hello World');
  });

  it('converts CRLF to LF', () => {
    const buf = Buffer.from('Line1\r\nLine2', 'utf-8');
    expect(normalizeText(buf)).toBe('Line1\nLine2');
  });

  it('converts CR to LF', () => {
    const buf = Buffer.from('Line1\rLine2', 'utf-8');
    expect(normalizeText(buf)).toBe('Line1\nLine2');
  });

  it('handles GBK encoded buffer', () => {
    const iconv = require('iconv-lite');
    const text = '这是一段用于测试编码检测的中文内容，需要足够长才能被正确识别编码格式。';
    const buf = iconv.encode(text, 'gbk');
    expect(normalizeText(buf)).toBe(text);
  });

  it('handles ASCII buffer', () => {
    const buf = Buffer.from('Hello', 'ascii');
    expect(normalizeText(buf)).toBe('Hello');
  });

  it('handles empty buffer', () => {
    const buf = Buffer.from('', 'utf-8');
    expect(normalizeText(buf)).toBe('');
  });

  it('handles Chinese content with UTF-8', () => {
    const buf = Buffer.from('这是一段中文内容', 'utf-8');
    expect(normalizeText(buf)).toBe('这是一段中文内容');
  });
});

describe('ensureDir', () => {
  const testDir = path.join(__dirname, 'tmp-test-dir');

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('creates directory if it does not exist', () => {
    ensureDir(testDir);
    expect(fs.existsSync(testDir)).toBe(true);
    expect(fs.statSync(testDir).isDirectory()).toBe(true);
  });

  it('does not throw if directory already exists', () => {
    fs.mkdirSync(testDir, { recursive: true });
    expect(() => ensureDir(testDir)).not.toThrow();
  });

  it('creates nested directories', () => {
    const nested = path.join(testDir, 'a', 'b', 'c');
    ensureDir(nested);
    expect(fs.existsSync(nested)).toBe(true);
  });
});

describe('copyRecursive', () => {
  const srcDir = path.join(__dirname, 'tmp-src-dir');
  const destDir = path.join(__dirname, 'tmp-dest-dir');

  beforeEach(() => {
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(path.join(srcDir, 'subdir'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'content1', 'utf-8');
    fs.writeFileSync(path.join(srcDir, 'subdir', 'file2.txt'), 'content2', 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(srcDir)) fs.rmSync(srcDir, { recursive: true, force: true });
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  });

  it('copies files and directories recursively', () => {
    copyRecursive(srcDir, destDir);
    expect(fs.existsSync(path.join(destDir, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(destDir, 'subdir', 'file2.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, 'file1.txt'), 'utf-8')).toBe('content1');
    expect(fs.readFileSync(path.join(destDir, 'subdir', 'file2.txt'), 'utf-8')).toBe('content2');
  });

  it('overwrites existing files', () => {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'file1.txt'), 'old', 'utf-8');
    copyRecursive(srcDir, destDir);
    expect(fs.readFileSync(path.join(destDir, 'file1.txt'), 'utf-8')).toBe('content1');
  });

  it('throws error when source directory does not exist', () => {
    const nonExistentSrc = path.join(__dirname, 'tmp-non-existent-dir');
    expect(() => copyRecursive(nonExistentSrc, destDir)).toThrow();
  });
});

describe('formatDate', () => {
  it('formats ISO date string correctly', () => {
    expect(formatDate('2024-03-15T10:30:00Z')).toBe('2024-03-15');
  });

  it('formats date string with timezone', () => {
    expect(formatDate('2024-12-01T00:00:00+08:00')).toBe('2024-12-01');
  });

  it('formats single-digit month and day with leading zeros', () => {
    expect(formatDate('2024-01-05T00:00:00Z')).toBe('2024-01-05');
  });

  it('handles Date object input', () => {
    expect(formatDate(new Date('2024-06-20'))).toBe('2024-06-20');
  });

  it('returns NaN-NaN-NaN for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('NaN-NaN-NaN');
  });

  it('returns NaN-NaN-NaN for empty string', () => {
    expect(formatDate('')).toBe('NaN-NaN-NaN');
  });

  it('returns 1970-01-01 for null input', () => {
    expect(formatDate(null)).toBe('1970-01-01');
  });

  it('returns NaN-NaN-NaN for undefined input', () => {
    expect(formatDate(undefined)).toBe('NaN-NaN-NaN');
  });
});

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
  });

  it('escapes less than', () => {
    expect(escapeXml('1 < 2')).toBe('1 &lt; 2');
  });

  it('escapes greater than', () => {
    expect(escapeXml('2 > 1')).toBe('2 &gt; 1');
  });

  it('escapes double quotes', () => {
    expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeXml("it's ok")).toBe('it&apos;s ok');
  });

  it('escapes all special characters at once', () => {
    expect(escapeXml('<tag attr="value">Tom\'s & Jerry</tag>'))
      .toBe('&lt;tag attr=&quot;value&quot;&gt;Tom&apos;s &amp; Jerry&lt;/tag&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeXml('')).toBe('');
  });

  it('converts non-string input to string', () => {
    expect(escapeXml(123)).toBe('123');
    expect(escapeXml(null)).toBe('null');
    expect(escapeXml(undefined)).toBe('undefined');
  });

  it('handles object input by converting to string', () => {
    expect(escapeXml({ a: 1 })).toBe('[object Object]');
  });

  it('handles array input by converting to string', () => {
    expect(escapeXml([1, 2])).toBe('1,2');
  });

  it('handles Symbol input by converting to string', () => {
    expect(escapeXml(Symbol('test'))).toBe('Symbol(test)');
  });

  it('handles Chinese text without modification', () => {
    expect(escapeXml('你好世界')).toBe('你好世界');
  });
});
