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
  siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  icp: process.env.SITE_ICP || '',
  psb: process.env.SITE_PSB || '',
  adsenseId: process.env.ADSENSE_ID || '',
  githubUrl: (() => {
    const raw = (process.env.GITHUB_URL || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.warn(`⚠️  GITHUB_URL must use http or https scheme.`);
        return '';
      }
      if (parsed.username || parsed.password) {
        console.warn(`⚠️  GITHUB_URL must not contain credentials.`);
        return '';
      }
      return parsed.href;
    } catch {
      console.warn(`⚠️  Invalid GITHUB_URL provided.`);
      return '';
    }
  })(),
  // Giscus (GitHub Discussions) 评论配置
  // 支持通过环境变量覆盖，方便 fork 后自定义
  giscus: {
    repo: process.env.GISCUS_REPO || '',
    repoId: process.env.GISCUS_REPO_ID || '',
    category: process.env.GISCUS_CATEGORY || '',
    categoryId: process.env.GISCUS_CATEGORY_ID || '',
    mapping: process.env.GISCUS_MAPPING || 'pathname',
    reactionsEnabled: process.env.GISCUS_REACTIONS || '1',
    theme: process.env.GISCUS_THEME || 'preferred_color_scheme',
    lang: process.env.GISCUS_LANG || 'zh-CN',
  },
};

class BuildError extends Error {
  constructor(message, report) {
    super(message);
    this.name = 'BuildError';
    this.report = report;
  }
}

function printBuildSummary(report, duration) {
  const padName = (name) => name.padEnd(12, ' ');
  console.log('\n' + '='.repeat(56));
  console.log(`📊 Build Summary  |  Duration: ${duration}ms`);
  console.log('='.repeat(56));

  for (const [name, result] of Object.entries(report.steps)) {
    const icon = result.status === 'success'
      ? '✅'
      : result.status === 'failed'
        ? '❌'
        : result.status === 'skipped'
          ? '⏭️'
          : '⚠️';
    const detail = result.error ? ` — ${result.error}` : '';
    console.log(`  ${icon} ${padName(name)}${detail}`);
  }

  console.log('-'.repeat(56));
  if (report.totalErrors === 0 && report.totalWarnings === 0) {
    console.log('✅ Build completed successfully');
  } else {
    console.log(`⚠️  Errors: ${report.totalErrors}  |  Warnings: ${report.totalWarnings}`);
  }
  console.log('='.repeat(56));
}

/**
 * Builds the static blog site.
 * @returns {Promise<object>} Build report
 */
async function build() {
  const startTime = Date.now();
  const report = {
    _startTime: Date.now(),
    steps: {},
    totalErrors: 0,
    totalWarnings: 0,
  };

  console.log('🔨 Bogl build started...');

  // 1. Pull external content if configured
  try {
    const pullResult = await pullContent(CONFIG.postsDir);
    if (pullResult.success) {
      if (pullResult.skipped) {
        report.steps.pullContent = { status: 'skipped' };
      } else {
        report.steps.pullContent = { status: 'success', copied: pullResult.copied };
      }
    } else {
      report.steps.pullContent = { status: 'failed', error: pullResult.error?.message || 'Unknown error' };
      report.totalWarnings++;
      console.warn(`⚠️  Content pull failed: ${pullResult.error?.message}`);
    }
  } catch (err) {
    report.steps.pullContent = { status: 'failed', error: err.message };
    report.totalWarnings++;
    console.warn(`⚠️  Content pull failed: ${err.message}`);
  }

  // 2. Parse markdown posts
  let allPosts;
  let published;
  try {
    const parseResult = await parsePosts(CONFIG.postsDir);
    allPosts = parseResult.posts;
    published = allPosts.filter(p => !p.hidden);
    report.steps.parsePosts = {
      status: 'success',
      total: allPosts.length,
      published: published.length,
      failed: parseResult.failed,
    };
    if (parseResult.failed > 0) {
      report.totalWarnings += parseResult.failed;
      console.warn(`⚠️  ${parseResult.failed} post(s) failed to parse`);
    }
    console.log(`  Found ${published.length} published posts.`);
  } catch (err) {
    report.steps.parsePosts = { status: 'failed', error: err.message };
    report.totalErrors++;
    throw new BuildError(`Critical step failed: ${err.message}`, report);
  }

  // 3. Clean output dir
  try {
    if (fs.existsSync(CONFIG.outputDir)) {
      fs.rmSync(CONFIG.outputDir, { recursive: true, force: true });
    }
    ensureDir(CONFIG.outputDir);
    report.steps.cleanOutput = { status: 'success' };
  } catch (err) {
    report.steps.cleanOutput = { status: 'failed', error: err.message };
    report.totalErrors++;
    throw new BuildError(`Failed to prepare output directory: ${err.message}`, report);
  }

  // 4. Setup renderer
  let render;
  try {
    render = createRenderer(CONFIG.templateDir);
    report.steps.renderer = { status: 'success' };
  } catch (err) {
    report.steps.renderer = { status: 'failed', error: err.message };
    report.totalErrors++;
    throw new BuildError(`Failed to initialize renderer: ${err.message}`, report);
  }

  // Site context
  const siteCtx = {
    title: CONFIG.title,
    description: CONFIG.description,
    url: CONFIG.siteUrl,
    icp: CONFIG.icp,
    psb: CONFIG.psb,
    giscus: CONFIG.giscus,
    adsenseId: CONFIG.adsenseId,
    githubUrl: CONFIG.githubUrl,
  };

  // 5. Generate pages — each step is independent; failures don't block others
  let allTags = [], archiveYears = [];

  const generators = [
    {
      name: 'tagPages',
      fn: () => {
        const result = generateTagPages(published, { outputDir: CONFIG.outputDir, render, siteCtx });
        allTags = result.allTags;
        archiveYears = result.archiveYears;
        return result;
      },
      critical: false,
    },
    {
      name: 'posts',
      fn: () => generatePosts(allPosts, { outputDir: CONFIG.outputDir, render, siteCtx }),
      critical: false,
    },
    {
      name: 'index',
      fn: () => generateIndexPages(published, {
        outputDir: CONFIG.outputDir,
        render,
        siteCtx,
        allTags,
        archiveYears,
        postsPerPage: CONFIG.postsPerPage,
      }),
      critical: false,
    },
    {
      name: 'archive',
      fn: () => generateArchive(published, { outputDir: CONFIG.outputDir, render, siteCtx }),
      critical: false,
    },
    {
      name: 'rss',
      fn: () => {
        if (!CONFIG.siteUrl) {
          console.log('  Skipped RSS (SITE_URL not set).');
          return { failed: 0, skipped: true };
        }
        return generateRss(published, {
          outputDir: CONFIG.outputDir,
          siteUrl: CONFIG.siteUrl,
          title: CONFIG.title,
          description: CONFIG.description,
        });
      },
      critical: false,
    },
    {
      name: 'sitemap',
      fn: () => {
        if (!CONFIG.siteUrl) {
          console.log('  Skipped sitemap (SITE_URL not set).');
          return { failed: 0, skipped: true };
        }
        return generateSitemap(published, { outputDir: CONFIG.outputDir, siteUrl: CONFIG.siteUrl, allTags });
      },
      critical: false,
    },
    {
      name: 'robots',
      fn: () => {
        if (!CONFIG.siteUrl) {
          console.log('  Skipped robots.txt (SITE_URL not set).');
          return { failed: 0, skipped: true };
        }
        return generateRobots({ outputDir: CONFIG.outputDir, siteUrl: CONFIG.siteUrl });
      },
      critical: false,
    },
    {
      name: 'assets',
      fn: () => copyAssets({ outputDir: CONFIG.outputDir, assetsDir: CONFIG.assetsDir }),
      critical: false,
    },
  ];

  for (const gen of generators) {
    try {
      const result = gen.fn();
      if (result.skipped) {
        report.steps[gen.name] = { status: 'skipped', ...result };
        continue;
      }
      const hasFailures = result.failed > 0;
      report.steps[gen.name] = {
        status: hasFailures ? 'warning' : 'success',
        ...result,
      };
      if (hasFailures) {
        report.totalErrors += result.failed;
      }
    } catch (err) {
      report.steps[gen.name] = { status: 'failed', error: err.message };
      report.totalErrors++;
      console.error(`  ❌ ${gen.name} failed: ${err.message}`);
      if (gen.critical) {
        throw new BuildError(`Critical generator failed (${gen.name}): ${err.message}`, report);
      }
    }
  }

  // 6. Generate ads.txt for AdSense if configured
  try {
    const adsenseId = CONFIG.adsenseId;
    if (adsenseId) {
      const adsTxtContent = `google.com, pub-${adsenseId}, DIRECT, f08c47fec0942fa0\n`;
      fs.writeFileSync(path.join(CONFIG.outputDir, 'ads.txt'), adsTxtContent, 'utf-8');
      console.log('  Generated ads.txt.');
      report.steps.adsTxt = { status: 'success' };
    } else {
      report.steps.adsTxt = { status: 'skipped' };
    }
  } catch (err) {
    report.steps.adsTxt = { status: 'failed', error: err.message };
    report.totalWarnings++;
    console.warn(`  ⚠️ Failed to generate ads.txt: ${err.message}`);
  }

  // 7. Summary
  const duration = Date.now() - startTime;
  printBuildSummary(report, duration);

  if (report.totalErrors > 0) {
    throw new BuildError(`Build completed with ${report.totalErrors} errors`, report);
  }

  return report;
}

module.exports = { build, BuildError, printBuildSummary };

if (require.main === module) {
  // CLI
  const args = process.argv.slice(2);
  let isBuilding = false;
  let pendingBuild = false;

  async function runBuild() {
    if (isBuilding) {
      pendingBuild = true;
      return;
    }
    isBuilding = true;
    try {
      await build();
    } catch (err) {
      if (err instanceof BuildError && err.report) {
        printBuildSummary(err.report, Date.now() - (err.report._startTime || Date.now()));
      }
      console.error('\n❌ Build failed:', err.message);
      if (process.env.DEBUG) {
        console.error(err);
      }
    } finally {
      isBuilding = false;
      if (pendingBuild) {
        pendingBuild = false;
        runBuild();
      }
    }
  }

  if (args.includes('--watch')) {
    runBuild();
    const chokidar = require('chokidar');
    let debounceTimer;
    chokidar
      .watch([CONFIG.postsDir, CONFIG.templateDir, CONFIG.assetsDir], { ignoreInitial: true })
      .on('all', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => runBuild().catch(console.error), 150);
      });
  } else {
    build().catch(err => {
      if (err instanceof BuildError && err.report) {
        printBuildSummary(err.report, Date.now() - (err.report._startTime || Date.now()));
      }
      console.error('\n❌ Build failed:', err.message);
      process.exit(1);
    });
  }
}
