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
    if (originalSiteUrl === undefined) {
      delete process.env.SITE_URL;
    } else {
      process.env.SITE_URL = originalSiteUrl;
    }
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

  it(
    'skips rss/sitemap/robots when SITE_URL is not set',
    async () => {
      delete process.env.SITE_URL;
      jest.resetModules();
      const buildNoUrl = require('../build').build;
      const report = await buildNoUrl();
      expect(report.steps.rss.status).toBe('skipped');
      expect(report.steps.sitemap.status).toBe('skipped');
      expect(report.steps.robots.status).toBe('skipped');

      const distDir = path.join(__dirname, '..', 'dist');
      expect(fs.existsSync(path.join(distDir, 'feed.xml'))).toBe(false);
      expect(fs.existsSync(path.join(distDir, 'sitemap.xml'))).toBe(false);
      expect(fs.existsSync(path.join(distDir, 'robots.txt'))).toBe(false);
    },
    30000
  );

  it(
    'generates ads.txt when ADSENSE_ID is set',
    async () => {
      const originalAdsenseId = process.env.ADSENSE_ID;
      process.env.ADSENSE_ID = '1234567890123456';
      jest.resetModules();
      const buildWithAds = require('../build').build;
      const report = await buildWithAds();
      expect(report.steps.adsTxt.status).toBe('success');

      const distDir = path.join(__dirname, '..', 'dist');
      const adsTxtPath = path.join(distDir, 'ads.txt');
      expect(fs.existsSync(adsTxtPath)).toBe(true);
      const content = fs.readFileSync(adsTxtPath, 'utf-8');
      expect(content).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');

      if (originalAdsenseId === undefined) {
        delete process.env.ADSENSE_ID;
      } else {
        process.env.ADSENSE_ID = originalAdsenseId;
      }
    },
    30000
  );

  it(
    'skips ads.txt when ADSENSE_ID is not set',
    async () => {
      const originalAdsenseId = process.env.ADSENSE_ID;
      delete process.env.ADSENSE_ID;
      jest.resetModules();
      const buildNoAds = require('../build').build;
      const report = await buildNoAds();
      expect(report.steps.adsTxt.status).toBe('skipped');

      const distDir = path.join(__dirname, '..', 'dist');
      expect(fs.existsSync(path.join(distDir, 'ads.txt'))).toBe(false);

      if (originalAdsenseId === undefined) {
        delete process.env.ADSENSE_ID;
      } else {
        process.env.ADSENSE_ID = originalAdsenseId;
      }
    },
    30000
  );
});
