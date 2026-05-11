const fs = require('fs');
const path = require('path');

jest.mock('../lib/content', () => ({
  pullContent: jest.fn(async () => ({ success: true, skipped: true, copied: 0 })),
  parsePosts: jest.fn(async () => ({
    posts: [
      {
        slug: 'hello',
        title: 'Hello',
        date: '2024-01-01T00:00:00Z',
        dateDisplay: '2024-01-01',
        excerpt: 'ex',
        content: '<p>c</p>',
        tags: ['js'],
        tagLinks: [{ name: 'js', slug: 'js' }],
        toc: [],
        draft: false,
        hidden: false,
        prev: null,
        next: null,
      },
      {
        slug: 'draft',
        title: 'Draft',
        date: '2024-01-02T00:00:00Z',
        dateDisplay: '2024-01-02',
        excerpt: 'ex',
        content: '<p>c</p>',
        tags: [],
        tagLinks: [],
        toc: [],
        draft: true,
        hidden: false,
        prev: null,
        next: null,
      },
      {
        slug: 'hidden',
        title: 'Hidden',
        date: '2024-01-03T00:00:00Z',
        dateDisplay: '2024-01-03',
        excerpt: 'ex',
        content: '<p>c</p>',
        tags: [],
        tagLinks: [],
        toc: [],
        draft: false,
        hidden: true,
        prev: null,
        next: null,
      },
    ],
    failed: 0,
    failures: [],
  })),
}));

describe('BuildError', () => {
  it('has name BuildError and stores report', () => {
    const { BuildError } = require('../build');
    const report = { steps: {}, totalErrors: 1, totalWarnings: 0 };
    const err = new BuildError('Something failed', report);
    expect(err.name).toBe('BuildError');
    expect(err.message).toBe('Something failed');
    expect(err.report).toBe(report);
  });
});

describe('build integration', () => {
  let originalSiteUrl;
  let build;

  beforeAll(() => {
    originalSiteUrl = process.env.SITE_URL;
    process.env.SITE_URL = 'https://example.com';
    jest.resetModules();
    build = require('../build').build;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env.SITE_URL = originalSiteUrl;
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  it(
    'completes successfully and creates expected dist structure',
    async () => {
      const report = await build();
      expect(report.steps.parsePosts.status).toBe('success');
      expect(report.steps.tagPages.status).toBe('success');
      expect(report.steps.posts.status).toBe('success');
      expect(report.steps.index.status).toBe('success');
      expect(report.steps.archive.status).toBe('success');
      expect(report.steps.rss.status).toBe('success');
      expect(report.steps.sitemap.status).toBe('success');
      expect(report.steps.robots.status).toBe('success');
      expect(report.steps.assets.status).toBe('success');

      const distDir = path.join(__dirname, '..', 'dist');
      expect(fs.existsSync(distDir)).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'posts'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'archive', 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'tags', 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'feed.xml'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'sitemap.xml'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'robots.txt'))).toBe(true);
      expect(fs.existsSync(path.join(distDir, 'assets'))).toBe(true);
    },
    30000
  );
});
