const fs = require('fs');
const path = require('path');
const os = require('os');
const { createRenderer } = require('../lib/renderer');

const realTemplateDir = path.join(__dirname, '..', 'src', 'templates');
let tmpTemplateDir;

beforeAll(() => {
  tmpTemplateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-test-'));
  fs.writeFileSync(path.join(tmpTemplateDir, 'filter-striptags.html'), '{{ text | striptags }}', 'utf-8');
  fs.writeFileSync(path.join(tmpTemplateDir, 'filter-slice.html'), '{{ text | slice(0,5) }}', 'utf-8');
  fs.writeFileSync(path.join(tmpTemplateDir, 'filter-truncate.html'), '{{ text | truncate(5) }}', 'utf-8');
  fs.writeFileSync(path.join(tmpTemplateDir, 'filter-json.html'), '{{ obj | json }}', 'utf-8');
  fs.writeFileSync(path.join(tmpTemplateDir, 'filter-safe.html'), '{{ html | safe }}', 'utf-8');
  fs.writeFileSync(path.join(tmpTemplateDir, 'year-test.html'), '{{ site.year }}', 'utf-8');
});

afterAll(() => {
  fs.rmSync(tmpTemplateDir, { recursive: true, force: true });
});

describe('createRenderer', () => {
  it('renders a real template with site context and root path', () => {
    const render = createRenderer(realTemplateDir);
    const html = render(
      'post.html',
      {
        site: {
          title: 'Test Blog',
          description: 'A blog',
          url: 'https://test.com',
          year: 2024,
          giscus: {},
        },
        post: {
          title: 'Hello World',
          slug: 'hello-world',
          date: '2024-01-01T00:00:00Z',
          dateDisplay: '2024-01-01',
          excerpt: 'Short excerpt here',
          content: '<p>Paragraph</p>',
          tags: ['js'],
          tagLinks: [{ name: 'js', slug: 'js' }],
          toc: [],
        },
      },
      '../../'
    );
    expect(html).toContain('Hello World - Test Blog');
    expect(html).toContain('../../favicon.svg');
    expect(html).toContain('<p>Paragraph</p>');
  });

  it('defaults rootPath to /', () => {
    const render = createRenderer(realTemplateDir);
    const html = render('post.html', {
      site: {
        title: 'Test Blog',
        description: 'A blog',
        url: 'https://test.com',
        year: 2024,
        giscus: {},
      },
      post: {
        title: 'Hello World',
        slug: 'hello-world',
        date: '2024-01-01T00:00:00Z',
        dateDisplay: '2024-01-01',
        excerpt: 'Short excerpt here',
        content: '<p>Paragraph</p>',
        tags: [],
        tagLinks: [],
        toc: [],
      },
    });
    expect(html).toContain('/favicon.svg');
    expect(html).not.toContain('../../favicon.svg');
  });

  it('sets site.year to current year automatically', () => {
    const render = createRenderer(tmpTemplateDir);
    const html = render('year-test.html', { site: { title: 'T' } });
    expect(html).toBe(String(new Date().getFullYear()));
  });

  it('applies striptags filter', () => {
    const render = createRenderer(tmpTemplateDir);
    expect(render('filter-striptags.html', { text: '<p>Hello</p>' })).toBe('Hello');
  });

  it('applies slice filter', () => {
    const render = createRenderer(tmpTemplateDir);
    expect(render('filter-slice.html', { text: 'Hello World' })).toBe('Hello');
  });

  it('applies truncate filter', () => {
    const render = createRenderer(tmpTemplateDir);
    expect(render('filter-truncate.html', { text: 'Hello World' })).toBe('Hello…');
    expect(render('filter-truncate.html', { text: 'Hi' })).toBe('Hi');
  });

  it('applies json filter and escapes <', () => {
    const render = createRenderer(tmpTemplateDir);
    expect(render('filter-json.html', { obj: { a: 1 } })).toBe('{"a":1}');
    expect(render('filter-json.html', { obj: { html: '<script>' } })).toContain('\\u003c');
  });

  it('applies safe filter without escaping', () => {
    const render = createRenderer(tmpTemplateDir);
    expect(render('filter-safe.html', { html: '<b>Bold</b>' })).toBe('<b>Bold</b>');
  });
});
