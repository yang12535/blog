const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const { normalizeText, toSlug, toTagLink, formatDate } = require('./utils');

// Pull content from external repo if configured
const CONTENT_REPO = process.env.CONTENT_REPO || '';
const CONTENT_BRANCH = process.env.CONTENT_BRANCH || 'main';
const CONTENT_TOKEN = process.env.GITHUB_TOKEN || process.env.GIT_TOKEN || '';

function hasGit() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function pullContent(postsDir) {
  if (!CONTENT_REPO) return;

  if (!hasGit()) {
    console.warn('⚠️ Git not found in PATH. Skipping content pull.');
    return;
  }

  let repoUrl = CONTENT_REPO;
  if (!repoUrl.startsWith('http') && !repoUrl.startsWith('git@')) {
    repoUrl = `https://github.com/${repoUrl}`;
  }
  if (CONTENT_TOKEN && repoUrl.includes('github.com')) {
    repoUrl = repoUrl.replace('https://', `https://x-access-token:${CONTENT_TOKEN}@`);
  }

  const tmpDir = path.join(process.cwd(), '.content-tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`📥 Pulling content from ${CONTENT_REPO}...`);
  try {
    execFileSync(
      'git',
      ['clone', '--depth', '1', '--branch', CONTENT_BRANCH, repoUrl, tmpDir],
      { stdio: 'inherit' }
    );
  } catch (err) {
    console.error('❌ Failed to pull content:', err.message);
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    return;
  }

  const srcPosts = path.join(tmpDir, 'posts');
  const srcContentPosts = path.join(tmpDir, 'content', 'posts');
  const srcDir = fs.existsSync(srcPosts)
    ? srcPosts
    : fs.existsSync(srcContentPosts)
      ? srcContentPosts
      : tmpDir;

  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));

  if (fs.existsSync(postsDir)) {
    fs.rmSync(postsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(postsDir, { recursive: true });

  for (const f of files) {
    fs.copyFileSync(path.join(srcDir, f), path.join(postsDir, f));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`  Copied ${files.length} markdown files.`);
}

function sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    .replace(/\son\w+=["'][^"']*["']/gi, '');
}

async function parsePosts(postsDir) {
  const { marked } = await import('marked');
  const mdFiles = fs.existsSync(postsDir)
    ? fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))
    : [];

  const posts = [];

  for (const filename of mdFiles) {
    const filePath = path.join(postsDir, filename);
    try {
      const raw = fs.readFileSync(filePath);
      const slug = path.basename(filename, '.md');

      let text = normalizeText(raw);
      text = text.replace(/\]\((\.?\/?)([^\)/]+)\.md\)/g, '](/posts/$2/)');
      const parsed = matter(text);
      let html = sanitizeHtml(marked.parse(parsed.content));

      const toc = [];
      let headingIndex = 0;
      html = html.replace(/<h([23])>(.*?)<\/h\1>/g, (match, level, text) => {
        const id = 'heading-' + headingIndex++;
        const plainText = text.replace(/<[^>]+>/g, '');
        toc.push({ id, text: plainText, level: parseInt(level) });
        return `<h${level} id="${id}">${text}</h${level}>`;
      });

      const excerpt = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const date = parsed.data.date
        ? new Date(parsed.data.date).toISOString()
        : fs.statSync(filePath).mtime.toISOString();
      const tags = (parsed.data.tags || []).map(t => String(t).trim()).filter(Boolean);

      posts.push({
        slug,
        title: parsed.data.title || slug,
        date,
        dateDisplay: formatDate(date),
        tags,
        tagLinks: tags.map(toTagLink),
        excerpt,
        content: html,
        draft: parsed.data.draft === true,
        toc,
      });
    } catch (err) {
      console.error(`❌ Failed to parse ${filename}:`, err.message);
    }
  }

  // Filter drafts & sort by date desc
  const published = posts.filter(p => !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Link prev/next
  for (let i = 0; i < published.length; i++) {
    published[i].prev = published[i - 1] || null;
    published[i].next = published[i + 1] || null;
  }

  return published;
}

module.exports = { pullContent, parsePosts };
