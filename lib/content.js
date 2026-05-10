const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');
const matter = require('gray-matter');
const { normalizeText, toTagLink, formatDate } = require('./utils');
const sanitizeHtmlLib = require('sanitize-html');



// Cache marked module to avoid repeated dynamic imports in watch mode
let markedModule = null;
async function getMarked() {
  if (!markedModule) {
    try {
      markedModule = await import('marked');
    } catch (err) {
      console.error('❌ Failed to import marked:', err.message);
      throw new Error(`Failed to load markdown parser: ${err.message}`);
    }
  }
  return markedModule;
}

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

/**
 * 构建带认证的仓库 URL
 * @param {string} repo - 仓库地址或简写
 * @returns {string} 完整的仓库 URL
 */
function buildRepoUrl(repo) {
  let repoUrl = repo;
  if (!repoUrl.startsWith('http') && !repoUrl.startsWith('git@')) {
    repoUrl = `https://github.com/${repoUrl}`;
  }
  return repoUrl;
}

/**
 * 创建 GIT_ASKPASS 辅助脚本
 * @param {string} token - GitHub/Git 访问令牌
 * @param {string} repoUrl - 仓库 URL
 * @returns {string|null} 辅助脚本路径，如果不需要则返回 null
 */
function createAskPassHelper(token, repoUrl) {
  if (!token || !repoUrl.includes('github.com')) return null;

  const isWin = process.platform === 'win32';
  const askPassHelper = path.join(os.tmpdir(), `bogl-askpass-${Date.now()}${isWin ? '.cmd' : '.sh'}`);
  const askPassContent = isWin
    ? `@echo off\r\necho %~1 | findstr /I "Username" >nul && (echo x-access-token & exit /b 0)\r\necho %~1 | findstr /I "Password" >nul && (echo %GIT_ASKPASS_TOKEN% & exit /b 0)\r\n`
    : `#!/bin/sh\ncase "$1" in\n  *[Uu]sername*) echo "x-access-token" ;;\n  *[Pp]assword*) echo "$GIT_ASKPASS_TOKEN" ;;\nesac\n`;
  fs.writeFileSync(askPassHelper, askPassContent, { mode: 0o700 });
  return askPassHelper;
}

/**
 * 清理临时目录和辅助脚本
 * @param {string} tmpDir - 临时目录路径
 * @param {string|null} askPassHelper - 辅助脚本路径
 */
function cleanup(tmpDir, askPassHelper) {
  if (tmpDir && fs.existsSync(tmpDir)) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  if (askPassHelper && fs.existsSync(askPassHelper)) {
    try { fs.unlinkSync(askPassHelper); } catch { /* ignore */ }
  }
}

/**
 * 执行 Git clone
 * @param {string} url - 仓库 URL
 * @param {string} tmpDir - 目标临时目录
 * @param {string} branch - 分支名
 * @param {number} timeout - 超时时间（毫秒）
 * @param {object} [env] - 环境变量
 * @returns {Promise<void>}
 */
function cloneRepo(url, tmpDir, branch, timeout, env) {
  if (fs.existsSync(tmpDir)) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['clone', '--depth', '1', '--branch', branch, url, tmpDir], {
      stdio: 'pipe',
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Git clone timeout after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Git clone failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 探测并复制文章文件
 * @param {string} tmpDir - 临时克隆目录
 * @param {string} postsDir - 目标文章目录
 * @returns {{copied: number}}
 */
function copyPosts(tmpDir, postsDir) {
  const srcPosts = path.join(tmpDir, 'posts');
  const srcContentPosts = path.join(tmpDir, 'content', 'posts');
  const srcDir = fs.existsSync(srcPosts)
    ? srcPosts
    : fs.existsSync(srcContentPosts)
      ? srcContentPosts
      : tmpDir;

  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));
  fs.mkdirSync(postsDir, { recursive: true });

  for (const f of files) {
    fs.copyFileSync(path.join(srcDir, f), path.join(postsDir, f));
  }

  return { copied: files.length };
}

/**
 * Pulls content from an external Git repository if configured via environment variables.
 * Supports retry on network/timeout failures and returns a result object.
 * @param {string} postsDir - The directory to copy markdown posts into
 * @param {object} [options]
 * @param {number} [options.retries=2] - Number of retry attempts after initial failure
 * @param {number} [options.timeout=60000] - Clone timeout in milliseconds
 * @returns {Promise<{success: boolean, skipped?: boolean, copied: number, error?: Error}>}
 */
async function pullContent(postsDir, { retries = 2, timeout = 60000 } = {}) {
  if (!CONTENT_REPO) return { success: true, skipped: true, copied: 0 };

  if (!hasGit()) {
    console.warn('⚠️ Git not found in PATH. Skipping content pull.');
    return { success: false, error: new Error('Git not found in PATH'), copied: 0 };
  }

  const repoUrl = buildRepoUrl(CONTENT_REPO);
  const tmpDir = path.join(__dirname, '..', '.content-tmp');
  const askPassHelper = createAskPassHelper(CONTENT_TOKEN, repoUrl);

  const cloneEnv = askPassHelper
    ? { ...process.env, GIT_ASKPASS: askPassHelper, GIT_ASKPASS_TOKEN: CONTENT_TOKEN }
    : process.env;

  for (let attempt = 0; attempt <= retries; attempt++) {
    console.log(`📥 Pulling content from ${CONTENT_REPO}... (attempt ${attempt + 1}/${retries + 1})`);

    try {
      await cloneRepo(repoUrl, tmpDir, CONTENT_BRANCH, timeout, cloneEnv);
    } catch (err) {
      const isTimeout = err.killed && err.signal === 'SIGTERM';
      const isNetwork = /timeout|connect|network|ENOTFOUND|ECONNREFUSED/i.test(err.message);
      const errorType = isTimeout ? 'timeout' : isNetwork ? 'network' : 'git';
      console.error(`  ❌ Clone failed (${errorType}, attempt ${attempt + 1}/${retries + 1}): ${err.message}`);

      if (attempt < retries) {
        const delay = 2000 * (attempt + 1);
        console.log(`  Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      cleanup(tmpDir, askPassHelper);
      return { success: false, error: err, copied: 0 };
    }

    let copied;
    try {
      const result = copyPosts(tmpDir, postsDir);
      copied = result.copied;
    } catch (err) {
      console.error(`  ❌ Failed to copy files: ${err.message}`);
      cleanup(tmpDir, askPassHelper);
      return { success: false, error: err, copied: 0 };
    }

    cleanup(tmpDir, askPassHelper);
    console.log(`  Copied ${copied} markdown files.`);
    return { success: true, copied };
  }

  cleanup(null, askPassHelper);
  return { success: false, error: new Error('Unexpected end of retry loop'), copied: 0 };
}

function sanitizeHtml(html) {
  return sanitizeHtmlLib(html, {
    allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat(['img', 'iframe', 'details', 'summary']),
    allowedAttributes: {
      ...sanitizeHtmlLib.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen'],
      details: ['open'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube.com', 'player.bilibili.com', 'www.bilibili.com'],
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.target === '_blank') {
          const existingRel = (attribs.rel || '').split(/\s+/).filter(Boolean);
          if (!existingRel.includes('noopener')) {
            existingRel.push('noopener');
          }
          if (!existingRel.includes('noreferrer')) {
            existingRel.push('noreferrer');
          }
          attribs.rel = existingRel.join(' ');
        }
        return { tagName, attribs };
      },
    },
  });
}

/**
 * Parses all markdown posts in a directory.
 * @param {string} postsDir - Directory containing markdown files
 * @returns {Promise<{posts: Array, failed: number, failures: Array<{filename: string, error: Error}>}>}
 */
async function parsePosts(postsDir) {
  const { marked } = await getMarked();
  const mdFiles = fs.existsSync(postsDir)
    ? fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))
    : [];

  if (mdFiles.length === 0) {
    return { posts: [], failed: 0, failures: [] };
  }

  const posts = [];
  const failures = [];
  let fatalErrors = 0;

  for (const filename of mdFiles) {
    const filePath = path.join(postsDir, filename);
    try {
      const raw = fs.readFileSync(filePath);
      const slug = path.basename(filename, '.md');

      let text = normalizeText(raw);
      text = text.replace(/\]\((\.?\/?)([^)/]+)\.md\)/g, '](/posts/$2/)');
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
      let date;
      if (parsed.data.date) {
        const d = new Date(parsed.data.date);
        date = isNaN(d.getTime()) ? fs.statSync(filePath).mtime.toISOString() : d.toISOString();
      } else {
        date = fs.statSync(filePath).mtime.toISOString();
      }
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
        hidden: parsed.data.hidden === true,
        toc,
        prev: null,
        next: null,
      });
    } catch (err) {
      console.error(`❌ Failed to parse ${filename}: ${err.name}: ${err.message}`);
      failures.push({ filename, error: err });
      if (err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'EPERM') {
        fatalErrors++;
      }
    }
  }

  // Critical failure checks
  if (posts.length === 0) {
    const err = new Error(`All ${mdFiles.length} posts failed to parse`);
    err.code = 'PARSE_ALL_FAILED';
    err.failures = failures;
    throw err;
  }
  if (fatalErrors > 0 && fatalErrors >= mdFiles.length / 2) {
    const err = new Error(`Too many fatal parse errors (${fatalErrors}/${mdFiles.length})`);
    err.code = 'PARSE_FATAL_ERRORS';
    err.failures = failures;
    throw err;
  }

  // Filter drafts & sort by date desc
  const allPosts = posts.filter(p => !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Link prev/next (only for visible posts)
  const visiblePosts = allPosts.filter(p => !p.hidden);
  for (let i = 0; i < visiblePosts.length; i++) {
    visiblePosts[i].prev = visiblePosts[i - 1] || null;
    visiblePosts[i].next = visiblePosts[i + 1] || null;
  }

  return { posts: allPosts, failed: failures.length, failures };
}

module.exports = { pullContent, parsePosts, sanitizeHtml };
