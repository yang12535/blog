const path = require('path');
const nunjucks = require('nunjucks');

function createRenderer(templateDir) {
  const env = nunjucks.configure(templateDir, { autoescape: true });
  env.addFilter('safe', str => new nunjucks.runtime.SafeString(str));
  env.addFilter('striptags', str => str.replace(/<[^>]+>/g, ''));
  env.addFilter('truncate', (str, len) => (str.length > len ? str.slice(0, len) + '…' : str));

  return function render(tpl, ctx, rootPath = '/') {
    return env.render(tpl, {
      ...ctx,
      site: { ...ctx.site, year: new Date().getFullYear() },
      root: rootPath,
    });
  };
}

module.exports = { createRenderer };
