const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// External deps (installed via npm)
const nunjucks = require('nunjucks');
const matter = require('gray-matter');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');

// Pull content from external repo if configured
const CONTENT_REPO = process.env.CONTENT_REPO || '';
const CONTENT_BRANCH = process.env.CONTENT_BRANCH || 'main';
const CONTENT_TOKEN = process.env.GITHUB_TOKEN || process.env.GIT_TOKEN || '';

function pullContent() {
  if (!CONTENT_REPO) return;
  const dest = path.join(__dirname, 'content', 'posts');
  // Clean existing content/posts to avoid stale files
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  ensureDir(dest);

  let repoUrl = CONTENT_REPO;
  if (!repoUrl.startsWith('http') && !repoUrl.startsWith('git@')) {
    repoUrl = `https://github.com/${repoUrl}`;
  }
  if (CONTENT_TOKEN && repoUrl.includes('github.com')) {
    repoUrl = repoUrl.replace('https://', `https://x-access-token:${CONTENT_TOKEN}@`);
  }

  const tmpDir = path.join(__dirname, '.content-tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`📥 Pulling content from ${CONTENT_REPO}...`);
  execSync(`git clone --depth 1 --branch ${CONTENT_BRANCH} "${repoUrl}" "${tmpDir}"`, { stdio: 'inherit' });

  // Copy .md files from repo root (or posts/ subdir if exists)
  const srcPosts = path.join(tmpDir, 'posts');
  const srcDir = fs.existsSync(srcPosts) ? srcPosts : tmpDir;
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    fs.copyFileSync(path.join(srcDir, f), path.join(dest, f));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`  Copied ${files.length} markdown files.`);
}

// Config
const CONFIG = {
  title: 'Bogl Blog',
  description: 'A lightweight static blog powered by Bogl.',
  postsDir: path.join(__dirname, 'content', 'posts'),
  outputDir: path.join(__dirname, 'dist'),
  templateDir: path.join(__dirname, 'src', 'templates'),
  assetsDir: path.join(__dirname, 'src', 'assets'),
  postsPerPage: 10,
  siteUrl: process.env.SITE_URL || 'https://example.com',
};

// Setup Nunjucks
const env = nunjucks.configure(CONFIG.templateDir, { autoescape: true });
env.addFilter('safe', str => new nunjucks.runtime.SafeString(str));
env.addFilter('striptags', str => str.replace(/<[^>]+>/g, ''));
env.addFilter('truncate', (str, len) => (str.length > len ? str.slice(0, len) + '…' : str));

// Utilities
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeText(rawBuf) {
  // Detect encoding
  const det = jschardet.detect(rawBuf);
  let encoding = (det && det.encoding) ? det.encoding.toLowerCase() : 'utf-8';
  // Fix common detection issues
  if (encoding === 'ascii') encoding = 'utf-8';

  // Decode to string
  let str;
  if (encoding === 'utf-8' || encoding === 'utf8') {
    str = rawBuf.toString('utf-8');
  } else {
    str = iconv.decode(rawBuf, encoding);
  }

  // Remove BOM
  if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1);

  // CRLF -> LF
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

function render(tpl, ctx, rootPath = '/') {
  return env.render(tpl, { ...ctx, site: { ...ctx.site, year: new Date().getFullYear() }, root: rootPath });
}

// Build logic
async function build() {
  console.log('🔨 Bogl build started...');
  const startTime = Date.now();

  pullContent();

  const { marked } = await import('marked');

  // Prepare dirs
  ensureDir(CONFIG.outputDir);

  // Collect markdown files
  const mdFiles = fs.existsSync(CONFIG.postsDir)
    ? fs.readdirSync(CONFIG.postsDir).filter(f => f.endsWith('.md'))
    : [];

  const posts = [];

  for (const filename of mdFiles) {
    const filePath = path.join(CONFIG.postsDir, filename);
    const raw = fs.readFileSync(filePath);
    const slug = path.basename(filename, '.md');

    // Parse
    const text = normalizeText(raw);
    const parsed = matter(text);
    const html = marked.parse(parsed.content);
    const excerpt = html.replace(/<[^>]+>/g, '').slice(0, 200);

    const date = parsed.data.date ? new Date(parsed.data.date).toISOString() : new Date().toISOString();
    const tags = (parsed.data.tags || []).map(t => String(t).trim()).filter(Boolean);

    posts.push({
      slug,
      title: parsed.data.title || slug,
      date,
      dateDisplay: formatDate(date),
      tags,
      excerpt,
      content: html,
      draft: parsed.data.draft === true,
    });
  }

  // Filter drafts & sort by date desc
  const published = posts.filter(p => !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Link prev/next
  for (let i = 0; i < published.length; i++) {
    published[i].prev = published[i - 1] || null;
    published[i].next = published[i + 1] || null;
  }

  console.log(`  Found ${mdFiles.length} files, ${published.length} published.`);

  // Site context
  const siteCtx = {
    title: CONFIG.title,
    description: CONFIG.description,
    url: CONFIG.siteUrl,
  };

  // --- Generate posts ---
  const postsOut = path.join(CONFIG.outputDir, 'posts');
  for (const post of published) {
    const outDir = path.join(postsOut, post.slug);
    ensureDir(outDir);
    const html = render('post.html', { site: siteCtx, post }, '../../');
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
  }
  console.log(`  Generated ${published.length} post pages.`);

  // --- Generate index pages ---
  const totalPages = Math.max(1, Math.ceil(published.length / CONFIG.postsPerPage));
  for (let page = 1; page <= totalPages; page++) {
    const slice = published.slice((page - 1) * CONFIG.postsPerPage, page * CONFIG.postsPerPage);
    const ctx = {
      site: siteCtx,
      posts: slice,
      currentPage: page,
      totalPages,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page < totalPages ? page + 1 : null,
    };
    const html = render('index.html', ctx, page === 1 ? '' : '../');
    if (page === 1) {
      fs.writeFileSync(path.join(CONFIG.outputDir, 'index.html'), html, 'utf-8');
    } else {
      const pDir = path.join(CONFIG.outputDir, 'page', String(page));
      ensureDir(pDir);
      fs.writeFileSync(path.join(pDir, 'index.html'), html, 'utf-8');
    }
  }
  console.log(`  Generated ${totalPages} index pages.`);

  // --- Generate tags ---
  const tagMap = {};
  for (const post of published) {
    for (const tag of post.tags) {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(post);
    }
  }

  const tagsOut = path.join(CONFIG.outputDir, 'tags');
  ensureDir(tagsOut);

  // Tag cloud
  const tagList = Object.keys(tagMap)
    .sort()
    .map(name => ({ name, count: tagMap[name].length }));
  fs.writeFileSync(
    path.join(tagsOut, 'index.html'),
    render('tags.html', { site: siteCtx, tags: tagList }, '../'),
    'utf-8'
  );

  // Individual tag pages
  for (const [tag, tPosts] of Object.entries(tagMap)) {
    const tDir = path.join(tagsOut, toSlug(tag));
    ensureDir(tDir);
    fs.writeFileSync(
      path.join(tDir, 'index.html'),
      render('tag.html', { site: siteCtx, tag, posts: tPosts }, '../../'),
      'utf-8'
    );
  }
  console.log(`  Generated ${tagList.length} tag pages.`);

  // --- Generate archive ---
  const archive = [];
  const yearMap = {};
  for (const post of published) {
    const y = new Date(post.date).getFullYear();
    if (!yearMap[y]) yearMap[y] = [];
    yearMap[y].push(post);
  }
  for (const year of Object.keys(yearMap).sort((a, b) => b - a)) {
    archive.push({ year, posts: yearMap[year] });
  }
  const archDir = path.join(CONFIG.outputDir, 'archive');
  ensureDir(archDir);
  fs.writeFileSync(
    path.join(archDir, 'index.html'),
    render('archive.html', { site: siteCtx, archive }, '../'),
    'utf-8'
  );
  console.log('  Generated archive page.');

  // --- Generate RSS ---
  const latest10 = published.slice(0, 10);
  const rssItems = latest10
    .map(
      p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${CONFIG.siteUrl}/posts/${p.slug}/</link>
      <guid>${CONFIG.siteUrl}/posts/${p.slug}/</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(CONFIG.title)}</title>
    <link>${CONFIG.siteUrl}/</link>
    <description>${escapeXml(CONFIG.description)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>zh-CN</language>
    ${rssItems}
  </channel>
</rss>`;
  fs.writeFileSync(path.join(CONFIG.outputDir, 'feed.xml'), rss, 'utf-8');
  console.log('  Generated RSS feed.');

  // --- Copy assets ---
  const assetsOut = path.join(CONFIG.outputDir, 'assets');
  if (fs.existsSync(CONFIG.assetsDir)) {
    copyRecursive(CONFIG.assetsDir, assetsOut);
    console.log('  Copied assets.');
  }

  console.log(`✅ Build finished in ${Date.now() - startTime}ms.`);
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--watch')) {
  build().catch(console.error);
  const chokidar = require('chokidar');
  chokidar
    .watch([CONFIG.postsDir, CONFIG.templateDir, CONFIG.assetsDir], { ignoreInitial: true })
    .on('all', () => build().catch(console.error));
} else {
  build().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
