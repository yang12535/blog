const fs = require('fs');
const path = require('path');
const { getAllMdFiles, log, COLORS } = require('../lib/utils');

const POSTS_DIR = path.join(__dirname, '..', 'content', 'posts');

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

function hasBOM(filePath) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(3);
  const bytesRead = fs.readSync(fd, buf, 0, 3, 0);
  fs.closeSync(fd);
  if (bytesRead < 3) return false;
  return buf[0] === BOM[0] && buf[1] === BOM[1] && buf[2] === BOM[2];
}

function removeBOM(filePath) {
  const content = fs.readFileSync(filePath);
  if (content.length < 3) return false;
  if (content[0] === BOM[0] && content[1] === BOM[1] && content[2] === BOM[2]) {
    fs.writeFileSync(filePath, content.slice(3));
    return true;
  }
  return false;
}

function main() {
  const shouldFix = process.argv.includes('--fix');

  log(`${COLORS.cyan}📄 UTF-8 BOM 检查工具${COLORS.reset}`);
  if (shouldFix) {
    log(`${COLORS.yellow}⚡ 自动修复模式已启用${COLORS.reset}`);
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

  log(`${COLORS.cyan}🔍 扫描了 ${files.length} 个 Markdown 文件${COLORS.reset}`);
  log('');

  const withBOM = [];
  const withoutBOM = [];

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    if (hasBOM(file)) {
      withBOM.push({ file, rel });
    } else {
      withoutBOM.push(rel);
    }
  }

  // 输出结果
  if (withoutBOM.length > 0) {
    log(`${COLORS.green}✅ 无 BOM (${withoutBOM.length}/${files.length})${COLORS.reset}`);
    for (const f of withoutBOM) {
      log(`   ${COLORS.green}✔${COLORS.reset}  ${f}`);
    }
    log('');
  }

  if (withBOM.length > 0) {
    log(`${COLORS.red}❌ 包含 BOM (${withBOM.length}/${files.length})${COLORS.reset}`);
    for (const { rel } of withBOM) {
      log(`   ${COLORS.red}✖${COLORS.reset}  ${rel}`);
    }
    log('');

    if (shouldFix) {
      log(`${COLORS.yellow}⚡ 正在移除 BOM...${COLORS.reset}`);
      let fixed = 0;
      for (const { file, rel } of withBOM) {
        if (removeBOM(file)) {
          log(`   ${COLORS.green}✔${COLORS.reset}  已修复: ${rel}`);
          fixed++;
        }
      }
      log('');
      log(`${COLORS.green}🎉 已移除 ${fixed} 个文件的 BOM${COLORS.reset}`);
      process.exit(0);
    } else {
      log(`${COLORS.yellow}💡 提示: 运行 "node scripts/check-bom.js --fix" 可自动移除 BOM${COLORS.reset}`);
      process.exit(1);
    }
  } else {
    log(`${COLORS.green}🎉 所有文件均无 UTF-8 BOM！${COLORS.reset}`);
    process.exit(0);
  }
}

main();
