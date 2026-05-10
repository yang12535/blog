const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { getAllMdFiles, log, COLORS } = require('../lib/utils');

const POSTS_DIR = path.join(__dirname, '..', 'content', 'posts');

function isValidDate(val) {
  if (!val) return true; // 可选
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val !== 'string') return false;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const d = new Date(val);
    return !isNaN(d.getTime());
  }
  // ISO 8601
  const d = new Date(val);
  return !isNaN(d.getTime());
}

function validateFile(filePath) {
  const rel = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  let parsed;
  try {
    parsed = matter(content);
  } catch (e) {
    return { file: rel, errors: [`Frontmatter 解析失败: ${e.message}`] };
  }

  const errors = [];
  const fm = parsed.data || {};

  // title 必填
  if (!fm.title || typeof fm.title !== 'string' || fm.title.trim() === '') {
    errors.push('缺少必填字段 title 或 title 为空');
  }

  // date 格式
  if ('date' in fm && !isValidDate(fm.date)) {
    errors.push(`date 格式无效: "${fm.date}"（应为 YYYY-MM-DD 或 ISO 日期）`);
  }

  // tags 格式
  if ('tags' in fm) {
    if (!Array.isArray(fm.tags)) {
      errors.push(`tags 必须是数组，当前类型: ${typeof fm.tags}`);
    } else {
      const nonString = fm.tags.filter(t => typeof t !== 'string');
      if (nonString.length > 0) {
        errors.push(`tags 数组中包含非字符串元素: ${JSON.stringify(nonString)}`);
      }
    }
  }

  // draft 和 hidden 应该是布尔值（可选，只做警告）
  if ('draft' in fm && typeof fm.draft !== 'boolean') {
    errors.push(`draft 应为布尔值，当前类型: ${typeof fm.draft}`);
  }
  if ('hidden' in fm && typeof fm.hidden !== 'boolean') {
    errors.push(`hidden 应为布尔值，当前类型: ${typeof fm.hidden}`);
  }

  return { file: rel, errors };
}

function main() {
  log(`${COLORS.cyan}🔍 Frontmatter 检查工具${COLORS.reset}`);
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

  log(`${COLORS.cyan}📄 找到 ${files.length} 个 Markdown 文件${COLORS.reset}`);
  log('');

  const passed = [];
  const failed = [];

  for (const file of files) {
    const result = validateFile(file);
    if (result.errors.length === 0) {
      passed.push(result.file);
    } else {
      failed.push(result);
    }
  }

  // 输出通过的文件
  if (passed.length > 0) {
    log(`${COLORS.green}✅ 通过 (${passed.length}/${files.length})${COLORS.reset}`);
    for (const f of passed) {
      log(`   ${COLORS.green}✔${COLORS.reset}  ${f}`);
    }
    log('');
  }

  // 输出失败的文件
  if (failed.length > 0) {
    log(`${COLORS.red}❌ 失败 (${failed.length}/${files.length})${COLORS.reset}`);
    for (const result of failed) {
      log(`   ${COLORS.red}✖${COLORS.reset}  ${result.file}`);
      for (const err of result.errors) {
        log(`      ${COLORS.red}→${COLORS.reset} ${err}`);
      }
    }
    log('');
  }

  // 汇总
  log(`${COLORS.cyan}📊 汇总${COLORS.reset}`);
  log(`   总数:   ${files.length}`);
  log(`   ${COLORS.green}通过:   ${passed.length}${COLORS.reset}`);
  log(`   ${COLORS.red}失败:   ${failed.length}${COLORS.reset}`);
  log('');

  if (failed.length > 0) {
    log(`${COLORS.red}❌ 检查未通过，请修复上述问题${COLORS.reset}`);
    process.exit(1);
  } else {
    log(`${COLORS.green}🎉 所有文件检查通过！${COLORS.reset}`);
    process.exit(0);
  }
}

main();
