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
  description: 'A lightweight static blog powered by Bogl.',
  postsDir: path.join(__dirname, 'content', 'posts'),
  outputDir: path.join(__dirname, 'dist'),
  templateDir: path.join(__dirname, 'src', 'templates'),
  assetsDir: path.join(__dirname, 'src', 'assets'),
  postsPerPage: 10,
  siteUrl: process.env.SITE_URL || 'https://example.com',
  icp: process.env.SITE_ICP || '皖ICP备2025105642号-2',
  psb: process.env.SITE_PSB || '',
  // Giscus (GitHub Discussions) 评论配置
  giscus: {
    repo: 'yang12535/blog',
    repoId: 'R_kgDOR75DVQ',
    category: 'Announcements',
    categoryId: 'DIC_kwDOR75DVc4C8ot-',
    mapping: 'pathname',
    reactionsEnabled: '1',
    theme: 'preferred_color_scheme',
    lang: 'zh-CN',
  },
};

async function build() {
  const startTime = Date.now();
  console.log('🔨 Bogl build started...');

  // Pull external content if configured
  pullContent(CONFIG.postsDir);

  // Parse markdown posts
  const published = await parsePosts(CONFIG.postsDir);
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
  generatePosts(published, { outputDir: CONFIG.outputDir, render, siteCtx });
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
  generateSitemap(published, {
    outputDir: CONFIG.outputDir,
    siteUrl: CONFIG.siteUrl,
    allTags,
  });
  generateRobots({ outputDir: CONFIG.outputDir, siteUrl: CONFIG.siteUrl });
  copyAssets({ outputDir: CONFIG.outputDir, assetsDir: CONFIG.assetsDir });

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
