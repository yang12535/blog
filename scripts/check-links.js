const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getAllMdFiles, log, COLORS } = require('../lib/utils');

const POSTS_DIR = path.join(__dirname, '..', 'content', 'posts');

// 提取 Markdown 中的所有链接 [text](url) 和 <url>
// 跳过代码块（```...```）和行内代码（`...`）中的内容
function extractLinks(content) {
  const links = [];

  // 移除代码块和行内代码，但保留位置信息
  // 用占位符替换代码块和行内代码
  let cleaned = content;

  // 移除 fenced code blocks ```...```
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => ' '.repeat(match.length));

  // 移除 inline code `...`（不跨行）
  cleaned = cleaned.replace(/`[^`\n]+`/g, (match) => ' '.repeat(match.length));

  // [text](url "title")
  const mdLinkRe = /!?\[([^\]]*)\]\(([^\s"]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = mdLinkRe.exec(cleaned)) !== null) {
    links.push({ text: m[1], url: m[2] });
  }

  // <url>
  const angleRe = /\u003c([a-z][a-z0-9+.-]*:\/\/[^\u003e]+)\u003e/gi;
  while ((m = angleRe.exec(cleaned)) !== null) {
    links.push({ text: m[1], url: m[1] });
  }

  // 裸 URL http://... 或 https://...（排除 markdown 语法中的字符）
  const bareRe = /(?<![\]"(`])(https?:\/\/[^\s)\]`"]+)/g;
  while ((m = bareRe.exec(cleaned)) !== null) {
    const url = m[1];
    // 跳过占位符链接
    if (/^https?:\/\/\.\.\.['`]?$/.test(url)) continue;
    links.push({ text: url, url });
  }

  return links;
}

// 检查外部链接，带并发限制
async function checkExternalLinks(links, concurrency = 5, timeoutMs = 10000) {
  const results = [];
  const queue = [...links];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      const { url } = item;
      const result = await checkSingleUrl(url, timeoutMs);
      results.push({ ...item, ...result });
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

function checkSingleUrl(url, timeoutMs, retries = 2) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;

    function makeRequest(method, attempt = 0) {
      let settled = false;
      const req = client.request(url, { method, timeout: timeoutMs }, (res) => {
        const status = res.statusCode;
        // 跟随重定向
        if (status >= 300 && status < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          res.resume();
          settled = true;
          resolve({ status: 'redirect', redirectTo: redirectUrl, finalStatus: status });
          return;
        }
        // 某些服务器不支持 HEAD，降级到 GET
        if ((status === 403 || status === 405) && method === 'HEAD') {
          res.resume();
          makeRequest('GET', attempt);
          return;
        }
        if (status >= 200 && status < 400) {
          res.resume();
          settled = true;
          resolve({ status: 'ok', finalStatus: status });
        } else {
          res.resume();
          settled = true;
          resolve({ status: 'error', finalStatus: status, error: `HTTP ${status}` });
        }
      });
      req.on('timeout', () => {
        req.destroy();
        if (settled) return;
        settled = true;
        if (attempt < retries) {
          setTimeout(() => makeRequest(method, attempt + 1), 500);
        } else {
          resolve({ status: 'timeout', error: '请求超时' });
        }
      });
      req.on('error', (err) => {
        if (settled) return;
        settled = true;
        if (method === 'HEAD') {
          // HEAD 请求失败，尝试 GET
          makeRequest('GET', attempt);
          return;
        }
        if (attempt < retries) {
          setTimeout(() => makeRequest(method, attempt + 1), 500);
        } else {
          resolve({ status: 'error', error: `[${err.code || 'UNKNOWN'}] ${err.message}` });
        }
      });
      req.end();
    }

    makeRequest('HEAD');
  });
}

// 解析相对链接 /posts/slug/ → content/posts/slug.md
function resolveRelativeLink(url, baseFile) {
  // 移除 hash 和 query
  const clean = url.split(/[#?]/)[0];
  if (clean.startsWith('/posts/')) {
    const slug = clean.replace(/^\/posts\//, '').replace(/\/$/, '');
    // 过滤路径遍历：拒绝包含 .. 或路径分隔符的 slug
    if (slug.includes('..') || slug.includes(path.sep) || slug.includes('/')) {
      return null;
    }
    const resolved = path.resolve(path.join(POSTS_DIR, `${slug}.md`));
    // 确保解析后的路径仍在 POSTS_DIR 内
    if (!resolved.startsWith(path.resolve(POSTS_DIR) + path.sep)) {
      return null;
    }
    return resolved;
  }
  if (clean.startsWith('/')) {
    // 其他根路径，基于项目根目录解析
    const rootDir = path.resolve(__dirname, '..');
    const resolved = path.resolve(rootDir, clean.slice(1));
    // 确保解析后的路径仍在项目根目录内
    if (!resolved.startsWith(rootDir + path.sep)) {
      return null;
    }
    // 构建资源fallback：如果根目录不存在，尝试 src/ 目录（src/assets 会在构建时复制到 dist/assets）
    if (!fs.existsSync(resolved) && clean.startsWith('/assets/')) {
      const srcResolved = path.resolve(rootDir, 'src', clean.slice(1));
      if (srcResolved.startsWith(rootDir + path.sep) && fs.existsSync(srcResolved)) {
        return srcResolved;
      }
    }
    return resolved;
  }
  if (clean.startsWith('./') || clean.startsWith('../')) {
    const rootDir = path.resolve(__dirname, '..');
    const resolved = path.resolve(path.dirname(baseFile), clean);
    // 确保解析后的路径仍在项目根目录内
    if (!resolved.startsWith(rootDir + path.sep)) {
      return null;
    }
    // 构建资源fallback：如果从 content/posts 解析的 assets 路径不存在，尝试 src/ 目录
    if (!fs.existsSync(resolved) && clean.includes('assets/')) {
      // 更通用的方式：把相对路径中指向 assets 的部分映射到 src/assets
      const assetsMatch = clean.match(/(?:\.\.\/)*assets\/.*$/);
      if (assetsMatch) {
        const srcFallback = path.resolve(rootDir, 'src', assetsMatch[0].replace(/^(\.\.\/)+/, ''));
        if (srcFallback.startsWith(rootDir + path.sep) && fs.existsSync(srcFallback)) {
          return srcFallback;
        }
      }
    }
    return resolved;
  }
  return null;
}

function findLineNumber(content, url) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(url)) return i + 1;
  }
  return 0;
}

async function main() {
  const warnExternal = process.argv.includes('--warn-external');

  log(`${COLORS.cyan}🔗 链接检查工具${COLORS.reset}`);
  if (warnExternal) {
    log(`${COLORS.yellow}⚠️  外部链接超时/重置将降级为警告（国内网络环境适配）${COLORS.reset}`);
  }
  log('');

  if (!fs.existsSync(POSTS_DIR)) {
    log(`${COLORS.red}❌ 文章目录不存在: ${POSTS_DIR}${COLORS.reset}`);
    process.exit(1);
  }

  const files = getAllMdFiles(POSTS_DIR);
  if (files.length === 0) {
    log(`${COLORS.yellow}⚠️  未找到任何 .md 文件${COLORS.reset}`);
    process.exit(0);
  }

  const relativeLinks = []; // { file, url, line, targetPath }
  const externalLinks = []; // { file, url, line }

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf-8');
    const links = extractLinks(content);
    for (const link of links) {
      const { url } = link;
      const line = findLineNumber(content, url);
      if (url.startsWith('http://') || url.startsWith('https://')) {
        externalLinks.push({ file: rel, url, line });
      } else if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        const target = resolveRelativeLink(url, file);
        if (target) {
          relativeLinks.push({ file: rel, url, line, targetPath: target });
        }
      }
      // mailto: 和锚点 # 等忽略
    }
  }

  log(`${COLORS.cyan}📄 扫描了 ${files.length} 个文件${COLORS.reset}`);
  log(`${COLORS.cyan}🔗 发现 ${relativeLinks.length} 个相对链接，${externalLinks.length} 个外部链接${COLORS.reset}`);
  log('');

  // 检查相对链接
  const brokenRelative = [];
  const okRelative = [];
  for (const link of relativeLinks) {
    const exists = fs.existsSync(link.targetPath);
    if (exists) {
      okRelative.push(link);
    } else {
      brokenRelative.push(link);
    }
  }

  // 检查外部链接
  const brokenExternal = [];
  const warnExternalLinks = [];
  const okExternal = [];
  if (externalLinks.length > 0) {
    log(`${COLORS.cyan}🌐 正在检查外部链接...${COLORS.reset}`);
    const extResults = await checkExternalLinks(externalLinks, 5, 10000);
    for (const r of extResults) {
      if (r.status === 'ok') {
        okExternal.push(r);
      } else if (r.status === 'redirect') {
        okExternal.push(r); // 重定向视为可用
      } else if (warnExternal && (r.error === '请求超时' || r.error?.includes('ECONNRESET') || r.error?.includes('ETIMEDOUT') || r.error?.includes('ENOTFOUND'))) {
        warnExternalLinks.push(r); // 网络层错误降级为警告
      } else {
        brokenExternal.push(r);
      }
    }
    log(`${COLORS.cyan}🌐 外部链接检查完成${COLORS.reset}`);
    log('');
  }

  // 输出报告
  let hasError = false;

  // 相对链接报告
  if (relativeLinks.length > 0) {
    log(`${COLORS.cyan}📁 相对链接检查结果${COLORS.reset}`);
    if (okRelative.length > 0) {
      log(`   ${COLORS.green}✅ 有效 (${okRelative.length})${COLORS.reset}`);
      for (const link of okRelative) {
        log(`      ${COLORS.green}✔${COLORS.reset} ${link.file}:${link.line} → ${link.url}`);
      }
    }
    if (brokenRelative.length > 0) {
      hasError = true;
      log(`   ${COLORS.red}❌ 断链 (${brokenRelative.length})${COLORS.reset}`);
      for (const link of brokenRelative) {
        log(`      ${COLORS.red}✖${COLORS.reset} ${link.file}:${link.line} → ${link.url}`);
        log(`         ${COLORS.gray}预期路径: ${link.targetPath}${COLORS.reset}`);
      }
    }
    log('');
  }

  // 外部链接报告
  if (externalLinks.length > 0) {
    log(`${COLORS.cyan}🌐 外部链接检查结果${COLORS.reset}`);
    if (okExternal.length > 0) {
      log(`   ${COLORS.green}✅ 可访问 (${okExternal.length})${COLORS.reset}`);
      for (const link of okExternal) {
        const statusStr = link.finalStatus ? ` (HTTP ${link.finalStatus})` : '';
        log(`      ${COLORS.green}✔${COLORS.reset} ${link.file}:${link.line} → ${link.url}${COLORS.gray}${statusStr}${COLORS.reset}`);
      }
    }
    if (warnExternalLinks.length > 0) {
      log(`   ${COLORS.yellow}⚠️  网络不稳定/超时 (${warnExternalLinks.length})${COLORS.reset}`);
      for (const link of warnExternalLinks) {
        log(`      ${COLORS.yellow}⚠${COLORS.reset} ${link.file}:${link.line} → ${link.url}`);
        log(`         ${COLORS.yellow}原因: ${link.error}${COLORS.reset}`);
      }
    }
    if (brokenExternal.length > 0) {
      hasError = true;
      log(`   ${COLORS.red}❌ 不可访问 (${brokenExternal.length})${COLORS.reset}`);
      for (const link of brokenExternal) {
        log(`      ${COLORS.red}✖${COLORS.reset} ${link.file}:${link.line} → ${link.url}`);
        log(`         ${COLORS.red}原因: ${link.error}${COLORS.reset}`);
      }
    }
    log('');
  }

  // 汇总
  const totalBroken = brokenRelative.length + brokenExternal.length;
  log(`${COLORS.cyan}📊 汇总${COLORS.reset}`);
  log(`   相对链接: ${relativeLinks.length} (${COLORS.green}${okRelative.length} 有效${COLORS.reset}${brokenRelative.length > 0 ? `, ${COLORS.red}${brokenRelative.length} 断链${COLORS.reset}` : ''})`);
  const externalWarnStr = warnExternalLinks.length > 0 ? `, ${COLORS.yellow}${warnExternalLinks.length} 超时/重置${COLORS.reset}` : '';
  const externalBrokenStr = brokenExternal.length > 0 ? `, ${COLORS.red}${brokenExternal.length} 不可访问${COLORS.reset}` : '';
  log(`   外部链接: ${externalLinks.length} (${COLORS.green}${okExternal.length} 可访问${COLORS.reset}${externalWarnStr}${externalBrokenStr})`);
  log('');

  if (hasError) {
    log(`${COLORS.red}❌ 发现 ${totalBroken} 个断链，请修复${COLORS.reset}`);
    process.exit(1);
  } else if (warnExternalLinks.length > 0) {
    log(`${COLORS.green}🎉 所有链接检查通过！${COLORS.reset} ${COLORS.yellow}(注意: ${warnExternalLinks.length} 个外部链接因网络不稳定未确认)${COLORS.reset}`);
    process.exit(0);
  } else {
    log(`${COLORS.green}🎉 所有链接检查通过！${COLORS.reset}`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${COLORS.red}错误: ${err.message}${COLORS.reset}`);
  process.exit(1);
});
