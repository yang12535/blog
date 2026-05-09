const fs = require('fs');
const path = require('path');
const { pullContent, parsePosts } = require('./lib/content');
const { createRenderer } = require('./lib/renderer');
const {
  generatePosts,
  generateIndexPages,
  generateTagPages,
  generateArchive,
  generateRss,
  generateSitemap,
  generateRobots,
  copyAssets,
} = require('./lib/generators');
const { ensureDir } = require('./lib/utils');

// Config
const CONFIG = {
  title: 'Bogl Blog',
  description: 'Bogl Blog - 分享 Windows、Linux、开发工具等实用技术教程与一键安装脚本。',
  postsDir: path.join(__dirname, 'content', 'posts'),
  outputDir: path.join(__dirname, 'dist'),
  templateDir: path.join(__dirname, 'src', 'templates'),
  assetsDir: path.join(__dirname, 'src', 'assets'),
  postsPerPage: 10,
  siteUrl: (process.env.SITE_URL || 'https://bash.yang125.fun').replace(/\/+$/, ''),
  icp: process.env.SITE_ICP || '皖ICP备2025105642号-2',
  psb: process.env.SITE_PSB || '',
  // Giscus (GitHub Discussions) 评论配置
  // 支持通过环境变量覆盖，方便 fork 后自定义
  giscus: {
    repo: process.env.GISCUS_REPO || 'yang12535/blog',
    repoId: process.env.GISCUS_REPO_ID || 'R_kgDOR75DVQ',
    category: process.env.GISCUS_CATEGORY || 'Announcements',
    categoryId: process.env.GISCUS_CATEGORY_ID || 'DIC_kwDOR75DVc4C8ot-',
    mapping: process.env.GISCUS_MAPPING || 'pathname',
    reactionsEnabled: process.env.GISCUS_REACTIONS || '1',
    theme: process.env.GISCUS_THEME || 'preferred_color_scheme',
    lang: process.env.GISCUS_LANG || 'zh-CN',
  },
};

async function build() {
  const startTime = Date.now();
  console.log('🔨 Bogl build started...');

  // Pull external content if configured
  pullContent(CONFIG.postsDir);

  // Parse markdown posts
  const allPosts = await parsePosts(CONFIG.postsDir);
  const published = allPosts.filter(p => !p.hidden);
  console.log(`  Found ${published.length} published posts.`);

  // Clean output dir
  if (fs.existsSync(CONFIG.outputDir)) {
    fs.rmSync(CONFIG.outputDir, { recursive: true, force: true });
  }
  ensureDir(CONFIG.outputDir);

  // Setup renderer
  const render = createRenderer(CONFIG.templateDir);

  // Site context
  const siteCtx = {
    title: CONFIG.title,
    description: CONFIG.description,
    url: CONFIG.siteUrl,
    icp: CONFIG.icp,
    psb: CONFIG.psb,
    giscus: CONFIG.giscus,
  };

  // Generate tag pages first (returns allTags + archiveYears for index)
  const { allTags, archiveYears } = generateTagPages(published, {
    outputDir: CONFIG.outputDir,
    render,
    siteCtx,
  });

  // Generate all pages
  generatePosts(allPosts, { outputDir: CONFIG.outputDir, render, siteCtx });
  generateIndexPages(published, {
    outputDir: CONFIG.outputDir,
    render,
    siteCtx,
    allTags,
    archiveYears,
    postsPerPage: CONFIG.postsPerPage,
  });
  generateArchive(published, { outputDir: CONFIG.outputDir, render, siteCtx });
  generateRss(published, {
    outputDir: CONFIG.outputDir,
    siteUrl: CONFIG.siteUrl,
    title: CONFIG.title,
    description: CONFIG.description,
  });
  generateSitemap(allPosts, {
    outputDir: CONFIG.outputDir,
    siteUrl: CONFIG.siteUrl,
    allTags,
  });
  generateRobots({ outputDir: CONFIG.outputDir, siteUrl: CONFIG.siteUrl });
  copyAssets({ outputDir: CONFIG.outputDir, assetsDir: CONFIG.assetsDir });

  // Copy ads.txt to root for AdSense
  const adsTxtSrc = path.join(CONFIG.assetsDir, 'ads.txt');
  const adsTxtDest = path.join(CONFIG.outputDir, 'ads.txt');
  if (fs.existsSync(adsTxtSrc)) {
    fs.copyFileSync(adsTxtSrc, adsTxtDest);
    console.log('  Copied ads.txt to root.');
  }

  console.log(`✅ Build finished in ${Date.now() - startTime}ms.`);
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--watch')) {
  build().catch(err => {
    console.error(err);
  });
  const chokidar = require('chokidar');
  chokidar
    .watch([CONFIG.postsDir, CONFIG.templateDir, CONFIG.assetsDir], { ignoreInitial: true })
    .on('all', () => build().catch(console.error));
} else {
  build().catch(err => {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  });
}
