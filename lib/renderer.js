const nunjucks = require('nunjucks');

/**
 * Creates a Nunjucks renderer configured for the blog templates.
 * @param {string} templateDir - Directory containing Nunjucks templates
 * @returns {import('../types/lib/renderer').RenderFunction}
 */
function createRenderer(templateDir) {
  const env = nunjucks.configure(templateDir, { autoescape: true });
  env.addFilter('striptags', str => str.replace(/<[^>]+>/g, ''));
  env.addFilter('truncate', (str, len) => (str.length > len ? str.slice(0, len) + '…' : str));
  env.addFilter('slice', (str, start, end) => str.slice(start, end));
  env.addFilter('json', obj => new nunjucks.runtime.SafeString(JSON.stringify(obj).replace(/</g, '\\u003c')));
  env.addFilter('withAuthor', (obj, authorName) => {
    if (authorName) {
      return { ...obj, author: { '@type': 'Person', name: authorName } };
    }
    return obj;
  });

  return function render(tpl, ctx, rootPath = '/') {
    return env.render(tpl, {
      ...ctx,
      site: { ...ctx.site, year: new Date().getFullYear() },
      root: rootPath,
    });
  };
}

module.exports = { createRenderer };
