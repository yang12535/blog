const fs = require('fs');
const path = require('path');
const { ensureDir, copyRecursive, escapeXml, toSlug } = require('./utils');

function generatePosts(published, { outputDir, render, siteCtx }) {
  const postsOut = path.join(outputDir, 'posts');
  for (const post of published) {
    const outDir = path.join(postsOut, post.slug);
    ensureDir(outDir);
    const html = render('post.html', { site: siteCtx, post }, '../../');
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');
  }
  console.log(`  Generated ${published.length} post pages.`);
}

function generateIndexPages(published, { outputDir, render, siteCtx, allTags, archiveYears, postsPerPage }) {
  const totalPages = Math.max(1, Math.ceil(published.length / postsPerPage));
  for (let page = 1; page <= totalPages; page++) {
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
  }
  console.log(`  Generated ${totalPages} index pages.`);
}

function generateTagPages(published, { outputDir, render, siteCtx }) {
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
  const tagsOut = path.join(outputDir, 'tags');
  ensureDir(tagsOut);
  fs.writeFileSync(
    path.join(tagsOut, 'index.html'),
    render('tags.html', { site: siteCtx, tags: allTags }, '../'),
    'utf-8'
  );

  // Individual tag pages
  for (const tagData of Object.values(tagMap)) {
    const tDir = path.join(tagsOut, tagData.slug);
    ensureDir(tDir);
    fs.writeFileSync(
      path.join(tDir, 'index.html'),
      render('tag.html', { site: siteCtx, tag: tagData.name, posts: tagData.posts }, '../../'),
      'utf-8'
    );
  }
  console.log(`  Generated ${allTags.length} tag pages.`);

  return { allTags, archiveYears };
}

function generateArchive(published, { outputDir, render, siteCtx }) {
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
}

function generateRss(published, { outputDir, siteUrl, title, description }) {
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
}

function copyAssets({ outputDir, assetsDir }) {
  const assetsOut = path.join(outputDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    copyRecursive(assetsDir, assetsOut);
    console.log('  Copied assets.');
  }
  const faviconSrc = path.join(assetsDir, 'favicon.svg');
  const faviconDest = path.join(outputDir, 'favicon.svg');
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, faviconDest);
    console.log('  Copied favicon.');
  }
}

function generateSitemap(published, { outputDir, siteUrl, allTags }) {
  const today = new Date().toISOString().slice(0, 10);
  let urls = [
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
}

function generateRobots({ outputDir, siteUrl }) {
  const content = `User-agent: *
Allow: /
Disallow: /assets/

Sitemap: ${siteUrl}/sitemap.xml
`;
  fs.writeFileSync(path.join(outputDir, 'robots.txt'), content, 'utf-8');
  console.log('  Generated robots.txt.');
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
