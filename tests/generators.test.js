const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  generatePosts,
  generateIndexPages,
  generateTagPages,
  generateArchive,
  generateRss,
  generateSitemap,
  generateRobots,
  copyAssets,
} = require('../lib/generators');

let tmpDir;
let mockRender;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bogl-gen-test-'));
  mockRender = jest.fn((tpl, ctx, rootPath) => `<html>${tpl} root=${rootPath}</html>`);
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  jest.restoreAllMocks();
});

const siteCtx = { title: 'Test Blog', url: 'https://test.com' };
const makePost = (slug, title, date, tags = []) => ({
  slug,
  title,
  date,
  tags,
  excerpt: `Excerpt of ${title}`,
  content: '<p>content</p>',
});

describe('generatePosts', () => {
  it('generates post pages for published posts', () => {
    const posts = [
      makePost('hello', 'Hello', '2024-01-01T00:00:00Z'),
      makePost('world', 'World', '2024-01-02T00:00:00Z'),
    ];
    const result = generatePosts(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'posts', 'hello', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'posts', 'world', 'index.html'))).toBe(true);
    expect(mockRender).toHaveBeenCalledWith('post.html', expect.any(Object), '../../');
  });

  it('handles empty published list', () => {
    const result = generatePosts([], { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'posts'))).toBe(true);
  });

  it('handles directory creation failure', () => {
    const originalMkdirSync = fs.mkdirSync;
    const originalExistsSync = fs.existsSync;
    fs.existsSync = jest.fn(() => false);
    fs.mkdirSync = jest.fn(() => { throw new Error('Permission denied'); });
    const posts = [makePost('hello', 'Hello', '2024-01-01T00:00:00Z')];
    const result = generatePosts(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].type).toBe('mkdir');
    fs.existsSync = originalExistsSync;
    fs.mkdirSync = originalMkdirSync;
  });

  it('handles render failure for a post', () => {
    const failingRender = jest.fn(() => {
      throw new Error('render err');
    });
    const posts = [makePost('fail', 'Fail', '2024-01-01T00:00:00Z')];
    const result = generatePosts(posts, { outputDir: tmpDir, render: failingRender, siteCtx });
    expect(result.failed).toBe(1);
    expect(result.errors[0].type).toBe('write');
    expect(result.errors[0].slug).toBe('fail');
  });
});

describe('generateIndexPages', () => {
  it('generates first page at root and subsequent pages in subdirs', () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost(`post-${i}`, `Post ${i}`, '2024-01-01T00:00:00Z')
    );
    const result = generateIndexPages(posts, {
      outputDir: tmpDir,
      render: mockRender,
      siteCtx,
      allTags: [],
      archiveYears: [],
      postsPerPage: 10,
    });
    expect(result.success).toBe(2);
    expect(fs.existsSync(path.join(tmpDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'page', '2', 'index.html'))).toBe(true);
    expect(mockRender).toHaveBeenCalledWith(
      'index.html',
      expect.objectContaining({ currentPage: 1 }),
      ''
    );
    expect(mockRender).toHaveBeenCalledWith(
      'index.html',
      expect.objectContaining({ currentPage: 2 }),
      '../'
    );
  });

  it('handles empty published list (still creates 1 page)', () => {
    const result = generateIndexPages([], {
      outputDir: tmpDir,
      render: mockRender,
      siteCtx,
      allTags: [],
      archiveYears: [],
      postsPerPage: 10,
    });
    expect(result.success).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'index.html'))).toBe(true);
  });

  it('handles exact multiple of postsPerPage', () => {
    const posts = Array.from({ length: 10 }, (_, i) =>
      makePost(`post-${i}`, `Post ${i}`, '2024-01-01T00:00:00Z')
    );
    const result = generateIndexPages(posts, {
      outputDir: tmpDir,
      render: mockRender,
      siteCtx,
      allTags: [],
      archiveYears: [],
      postsPerPage: 10,
    });
    expect(result.success).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'page'))).toBe(false);
  });

  it('handles render failure', () => {
    const failingRender = jest.fn(() => {
      throw new Error('render err');
    });
    const posts = [makePost('p1', 'P1', '2024-01-01T00:00:00Z')];
    const result = generateIndexPages(posts, {
      outputDir: tmpDir,
      render: failingRender,
      siteCtx,
      allTags: [],
      archiveYears: [],
      postsPerPage: 10,
    });
    expect(result.failed).toBe(1);
    expect(result.errors[0].type).toBe('write');
  });
});

describe('generateTagPages', () => {
  it('generates tag cloud and individual tag pages', () => {
    const posts = [
      makePost('a', 'A', '2024-01-01T00:00:00Z', ['javascript', 'node']),
      makePost('b', 'B', '2024-01-02T00:00:00Z', ['javascript']),
    ];
    const result = generateTagPages(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(3);
    expect(fs.existsSync(path.join(tmpDir, 'tags', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tags', 'javascript', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tags', 'node', 'index.html'))).toBe(true);
    expect(result.allTags).toEqual([
      expect.objectContaining({ name: 'javascript', count: 2 }),
      expect.objectContaining({ name: 'node', count: 1 }),
    ]);
  });

  it('sorts tags alphabetically using localeCompare', () => {
    const posts = [
      makePost('a', 'A', '2024-01-01T00:00:00Z', ['banana', 'apple', 'cherry']),
    ];
    const result = generateTagPages(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.allTags.map((t) => t.name)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('handles Chinese tags correctly', () => {
    const posts = [
      makePost('a', 'A', '2024-01-01T00:00:00Z', ['后端']),
      makePost('b', 'B', '2024-01-02T00:00:00Z', ['前端']),
    ];
    const result = generateTagPages(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.allTags).toHaveLength(2);
    expect(result.allTags.map((t) => t.slug)).toContain('后端');
    expect(result.allTags.map((t) => t.slug)).toContain('前端');
  });

  it('handles posts without tags', () => {
    const posts = [makePost('a', 'A', '2024-01-01T00:00:00Z', [])];
    const result = generateTagPages(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(1);
    expect(result.allTags).toEqual([]);
  });

  it('handles render failure', () => {
    const failingRender = jest.fn(() => {
      throw new Error('render err');
    });
    const posts = [makePost('a', 'A', '2024-01-01T00:00:00Z', ['tag1'])];
    const result = generateTagPages(posts, { outputDir: tmpDir, render: failingRender, siteCtx });
    expect(result.failed).toBe(2);
  });
});

describe('generateArchive', () => {
  it('groups posts by year in descending order', () => {
    const posts = [
      makePost('a', 'A', '2023-06-01T00:00:00Z'),
      makePost('b', 'B', '2024-01-01T00:00:00Z'),
      makePost('c', 'C', '2023-12-01T00:00:00Z'),
    ];
    const result = generateArchive(posts, { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'archive', 'index.html'))).toBe(true);
    const ctx = mockRender.mock.calls[0][1];
    expect(ctx.archive.map((a) => a.year)).toEqual(['2024', '2023']);
    expect(ctx.archive[0].posts.map((p) => p.slug)).toEqual(['b']);
    expect(ctx.archive[1].posts.map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('handles empty published list', () => {
    const result = generateArchive([], { outputDir: tmpDir, render: mockRender, siteCtx });
    expect(result.success).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'archive', 'index.html'))).toBe(true);
  });

  it('handles render failure', () => {
    const failingRender = jest.fn(() => {
      throw new Error('render err');
    });
    const result = generateArchive([makePost('a', 'A', '2024-01-01T00:00:00Z')], {
      outputDir: tmpDir,
      render: failingRender,
      siteCtx,
    });
    expect(result.failed).toBe(1);
  });
});

describe('generateRss', () => {
  it('generates RSS with latest 10 posts', () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost(`post-${i}`, `Post ${i}`, `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`)
    );
    const result = generateRss(posts, {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      title: 'Test',
      description: 'Desc',
    });
    expect(result.success).toBe(1);
    const rss = fs.readFileSync(path.join(tmpDir, 'feed.xml'), 'utf-8');
    expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(rss).toContain('<title>Test</title>');
    expect(rss).toContain('<language>zh-CN</language>');
    expect(rss).toContain('<link>https://test.com/</link>');
    expect(rss).toContain('post-0');
    expect(rss).toContain('post-9');
    expect(rss).not.toContain('post-10');
  });

  it('escapes XML special characters', () => {
    const posts = [
      { slug: 'x', title: 'A \u0026 B \u003cC\u003e', date: '2024-01-01T00:00:00Z', excerpt: 'D "E" \'F\'' },
    ];
    generateRss(posts, {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      title: 'T \u0026 T',
      description: 'D \u0026 D',
    });
    const rss = fs.readFileSync(path.join(tmpDir, 'feed.xml'), 'utf-8');
    expect(rss).toContain('A \u0026amp; B \u0026lt;C\u0026gt;');
    expect(rss).toContain('D \u0026quot;E\u0026quot; \u0026apos;F\u0026apos;');
    expect(rss).toContain('<title>T \u0026amp; T</title>');
  });

  it('handles empty published list', () => {
    const result = generateRss([], {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      title: 'Test',
      description: 'Desc',
    });
    expect(result.success).toBe(1);
    const rss = fs.readFileSync(path.join(tmpDir, 'feed.xml'), 'utf-8');
    expect(rss).not.toContain('<item>');
  });

  it('handles write failure', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    const result = generateRss([makePost('a', 'A', '2024-01-01T00:00:00Z')], {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      title: 'Test',
      description: 'Desc',
    });
    expect(result.failed).toBe(1);
    expect(result.errors[0].type).toBe('write');
  });
});

describe('generateSitemap', () => {
  it('includes all required URLs', () => {
    const posts = [makePost('hello', 'Hello', '2024-01-01T00:00:00Z')];
    const allTags = [{ name: 'js', slug: 'js' }];
    const result = generateSitemap(posts, {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      allTags,
    });
    expect(result.success).toBe(1);
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8');
    expect(xml).toContain('<loc>https://test.com/</loc>');
    expect(xml).toContain('<loc>https://test.com/archive/</loc>');
    expect(xml).toContain('<loc>https://test.com/tags/</loc>');
    expect(xml).toContain('<loc>https://test.com/posts/hello/</loc>');
    expect(xml).toContain('<loc>https://test.com/tags/js/</loc>');
  });

  it('handles empty published and tags', () => {
    const result = generateSitemap([], {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      allTags: [],
    });
    expect(result.success).toBe(1);
    const xml = fs.readFileSync(path.join(tmpDir, 'sitemap.xml'), 'utf-8');
    expect(xml).toContain('<loc>https://test.com/</loc>');
  });

  it('handles write failure', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    const result = generateSitemap([], {
      outputDir: tmpDir,
      siteUrl: 'https://test.com',
      allTags: [],
    });
    expect(result.failed).toBe(1);
  });
});

describe('generateRobots', () => {
  it('generates correct robots.txt content', () => {
    const result = generateRobots({ outputDir: tmpDir, siteUrl: 'https://test.com' });
    expect(result.success).toBe(1);
    const content = fs.readFileSync(path.join(tmpDir, 'robots.txt'), 'utf-8');
    expect(content).toContain('User-agent: *');
    expect(content).toContain('Allow: /');
    expect(content).toContain('Disallow: /assets/');
    expect(content).toContain('Sitemap: https://test.com/sitemap.xml');
  });

  it('handles write failure', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    const result = generateRobots({ outputDir: tmpDir, siteUrl: 'https://test.com' });
    expect(result.failed).toBe(1);
  });
});

describe('copyAssets', () => {
  it('recursively copies assets directory', () => {
    const assetsDir = path.join(tmpDir, 'assets-src');
    fs.mkdirSync(path.join(assetsDir, 'css'), { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'css', 'style.css'), 'body{}', 'utf-8');
    const outputDir = path.join(tmpDir, 'dist');
    const result = copyAssets({ outputDir, assetsDir });
    expect(result.success).toBe(2);
    expect(fs.existsSync(path.join(outputDir, 'assets', 'css', 'style.css'))).toBe(true);
  });

  it('copies favicon.svg if present', () => {
    const assetsDir = path.join(tmpDir, 'assets-src');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), '<svg/>', 'utf-8');
    const outputDir = path.join(tmpDir, 'dist');
    const result = copyAssets({ outputDir, assetsDir });
    expect(fs.existsSync(path.join(outputDir, 'favicon.svg'))).toBe(true);
    expect(result.success).toBe(2);
  });

  it('handles missing assetsDir gracefully', () => {
    const assetsDir = path.join(tmpDir, 'nonexistent');
    const outputDir = path.join(tmpDir, 'dist');
    const result = copyAssets({ outputDir, assetsDir });
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('handles copy failure', () => {
    const assetsDir = path.join(tmpDir, 'assets-src');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'file.txt'), 'x', 'utf-8');
    const outputDir = path.join(tmpDir, 'dist');
    const originalCopyFileSync = fs.copyFileSync;
    fs.copyFileSync = jest.fn(() => {
      throw new Error('copy err');
    });
    const result = copyAssets({ outputDir, assetsDir });
    expect(result.failed).toBe(1);
    expect(result.errors[0].type).toBe('copy');
    fs.copyFileSync = originalCopyFileSync;
  });
});
