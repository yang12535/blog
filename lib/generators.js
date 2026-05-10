const fs = require('fs');
const path = require('path');
const { ensureDir, copyRecursive, escapeXml, toSlug } = require('./utils');

function generatePosts(published, { outputDir, render, siteCtx }) {
  const errors = [];
  const postsOut = path.join(outputDir, 'posts');
  try {
    ensureDir(postsOut);
  } catch (err) {
    errors.push({ type: 'mkdir', target: postsOut, error: err.message });
    console.error(`  ❌ generatePosts: Failed to create directory ${postsOut}: ${err.message}`);
    return { success: 0, failed: published.length, errors };
  }

  for (const post of published) {
    try {
      const outDir = path.join(postsOut, post.slug);
      ensureDir(outDir);
      const html = render('post.html', { site: siteCtx, post }, '../../');
      fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
    } catch (err) {
      errors.push({ type: 'write', slug: post.slug, error: err.message });
      console.error(`  ❌ generatePosts: Failed to write post [${post.slug}]: ${err.message}`);
    }
  }

  const success = published.length - errors.length;
  console.log(`  Generated ${success}/${published.length} post pages.`);
  return { success, failed: errors.length, errors };
}

function generateIndexPages(published, { outputDir, render, siteCtx, allTags, archiveYears, postsPerPage }) {
  const errors = [];
  const totalPages = Math.max(1, Math.ceil(published.length / postsPerPage));

  for (let page = 1; page <= totalPages; page++) {
    try {
      const slice = published.slice((page - 1) * postsPerPage, page * postsPerPage);
      const ctx = {
        site: siteCtx,
        posts: slice,
        currentPage: page,
        totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        allTags,
        archiveYears,
      };
      const html = render('index.html', ctx, page === 1 ? '' : '../');
      if (page === 1) {
        fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
      } else {
        const pDir = path.join(outputDir, 'page', String(page));
        ensureDir(pDir);
        fs.writeFileSync(path.join(pDir, 'index.html'), html, 'utf-8');
      }
    } catch (err) {
      errors.push({ type: 'write', page, error: err.message });
      console.error(`  ❌ generateIndexPages: Failed to write page ${page}: ${err.message}`);
    }
  }

  const success = totalPages - errors.length;
  console.log(`  Generated ${success}/${totalPages} index pages.`);
  return { success, failed: errors.length, errors };
}

function generateTagPages(published, { outputDir, render, siteCtx }) {
  const errors = [];
  const tagMap = {};
  for (const post of published) {
    for (const tag of post.tags) {
      if (!tagMap[tag]) tagMap[tag] = { name: tag, slug: toSlug(tag), posts: [] };
      tagMap[tag].posts.push(post);
    }
  }

  const allTags = Object.values(tagMap)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .map(tag => ({ name: tag.name, slug: tag.slug, count: tag.posts.length }));

  const archiveYears = [...new Set(published.map(p => new Date(p.date).getFullYear()))].sort((a, b) => b - a);

  // Tag cloud page
  try {
    const tagsOut = path.join(outputDir, 'tags');
    ensureDir(tagsOut);
    fs.writeFileSync(
      path.join(tagsOut, 'index.html'),
      render('tags.html', { site: siteCtx, tags: allTags }, '../'),
      'utf-8'
    );
  } catch (err) {
    errors.push({ type: 'write', target: 'tags/index.html', error: err.message });
    console.error(`  ❌ generateTagPages: Failed to write tags index: ${err.message}`);
  }

  // Individual tag pages
  for (const tagData of Object.values(tagMap)) {
    try {
      const tDir = path.join(outputDir, 'tags', tagData.slug);
      ensureDir(tDir);
      fs.writeFileSync(
        path.join(tDir, 'index.html'),
        render('tag.html', { site: siteCtx, tag: tagData.name, tagSlug: tagData.slug, posts: tagData.posts }, '../../'),
        'utf-8'
      );
    } catch (err) {
      errors.push({ type: 'write', tag: tagData.name, error: err.message });
      console.error(`  ❌ generateTagPages: Failed to write tag [${tagData.name}]: ${err.message}`);
    }
  }

  const totalPages = allTags.length + 1;
  const success = totalPages - errors.length;
  console.log(`  Generated ${success}/${totalPages} tag pages.`);
  return { allTags, archiveYears, success, failed: errors.length, errors };
}

function generateArchive(published, { outputDir, render, siteCtx }) {
  try {
    const yearMap = {};
    for (const post of published) {
      const y = new Date(post.date).getFullYear();
      if (!yearMap[y]) yearMap[y] = [];
      yearMap[y].push(post);
    }
    const archive = Object.keys(yearMap)
      .sort((a, b) => b - a)
      .map(year => ({ year, posts: yearMap[year] }));

    const archDir = path.join(outputDir, 'archive');
    ensureDir(archDir);
    fs.writeFileSync(
      path.join(archDir, 'index.html'),
      render('archive.html', { site: siteCtx, archive }, '../'),
      'utf-8'
    );
    console.log('  Generated archive page.');
    return { success: 1, failed: 0, errors: [] };
  } catch (err) {
    console.error(`  ❌ generateArchive: Failed to write archive: ${err.message}`);
    return { success: 0, failed: 1, errors: [{ type: 'write', target: 'archive/index.html', error: err.message }] };
  }
}

function generateRss(published, { outputDir, siteUrl, title, description }) {
  try {
    const latest10 = published.slice(0, 10);
    const rssItems = latest10
      .map(p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${siteUrl}/posts/${p.slug}/</link>
      <guid>${siteUrl}/posts/${p.slug}/</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
    </item>`)
      .join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}/</link>
    <description>${escapeXml(description)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <language>zh-CN</language>
    ${rssItems}
  </channel>
</rss>`;

    fs.writeFileSync(path.join(outputDir, 'feed.xml'), rss, 'utf-8');
    console.log('  Generated RSS feed.');
    return { success: 1, failed: 0, errors: [] };
  } catch (err) {
    console.error(`  ❌ generateRss: Failed to write feed.xml: ${err.message}`);
    return { success: 0, failed: 1, errors: [{ type: 'write', target: 'feed.xml', error: err.message }] };
  }
}

function copyAssets({ outputDir, assetsDir }) {
  const errors = [];
  const assetsOut = path.join(outputDir, 'assets');

  if (fs.existsSync(assetsDir)) {
    try {
      copyRecursive(assetsDir, assetsOut);
      console.log('  Copied assets.');
    } catch (err) {
      errors.push({ type: 'copy', target: assetsDir, error: err.message });
      console.error(`  ❌ copyAssets: Failed to copy assets: ${err.message}`);
    }
  }

  try {
    const faviconSrc = path.join(assetsDir, 'favicon.svg');
    const faviconDest = path.join(outputDir, 'favicon.svg');
    if (fs.existsSync(faviconSrc)) {
      fs.copyFileSync(faviconSrc, faviconDest);
      console.log('  Copied favicon.');
    }
  } catch (err) {
    errors.push({ type: 'copy', target: 'favicon.svg', error: err.message });
    console.error(`  ❌ copyAssets: Failed to copy favicon: ${err.message}`);
  }

  const success = errors.length === 0 ? 2 : 1;
  const failed = errors.length;
  return { success, failed, errors };
}

function generateSitemap(published, { outputDir, siteUrl, allTags }) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      `<url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${siteUrl}/archive/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
      `<url><loc>${siteUrl}/tags/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
    ];

    for (const post of published) {
      const lastmod = post.date.slice(0, 10);
      urls.push(`<url><loc>${siteUrl}/posts/${post.slug}/</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
    }

    for (const tag of allTags) {
      urls.push(`<url><loc>${siteUrl}/tags/${tag.slug}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.4</priority></url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), xml, 'utf-8');
    console.log('  Generated sitemap.xml.');
    return { success: 1, failed: 0, errors: [] };
  } catch (err) {
    console.error(`  ❌ generateSitemap: Failed to write sitemap.xml: ${err.message}`);
    return { success: 0, failed: 1, errors: [{ type: 'write', target: 'sitemap.xml', error: err.message }] };
  }
}

function generateRobots({ outputDir, siteUrl }) {
  try {
    const content = `User-agent: *
Allow: /
Disallow: /assets/

Sitemap: ${siteUrl}/sitemap.xml
`;
    fs.writeFileSync(path.join(outputDir, 'robots.txt'), content, 'utf-8');
    console.log('  Generated robots.txt.');
    return { success: 1, failed: 0, errors: [] };
  } catch (err) {
    console.error(`  ❌ generateRobots: Failed to write robots.txt: ${err.message}`);
    return { success: 0, failed: 1, errors: [{ type: 'write', target: 'robots.txt', error: err.message }] };
  }
}

module.exports = {
  generatePosts,
  generateIndexPages,
  generateTagPages,
  generateArchive,
  generateRss,
  generateSitemap,
  generateRobots,
  copyAssets,
};
