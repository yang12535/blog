# 变更日志

## 2026-05-11 更新（PR #12 — 移除硬编码配置，全面环境变量化）
- 移除所有硬编码 ID、备案号与域名，构建配置全面改为环境变量驱动 `fabaf62`
- `build.js` 重构：`CONFIG` 模块级常量改为 `loadConfig()` 函数，消除 `require` 时的副作用，校验警告仅在构建运行时输出 `fabaf62`
- 新增环境变量：`ADSENSE_ID`（自动去除 `ca-pub-`/`pub-` 前缀并验证纯数字）、`GITHUB_URL`（仅允许 `http`/`https`、拒绝含凭据 URL）、`AUTHOR_NAME` `fabaf62`
- 原有配置默认值清空：`SITE_URL`、`SITE_ICP`、`Giscus` 的 `repoId`/`categoryId` 默认改为空字符串，避免 fork 后携带个人标识 `fabaf62`
- 模板条件渲染：`canonical`、`og:url`、`JSON-LD`、`RSS link`、`AdSense` 脚本、`GitHub` 导航链接在对应配置缺失时自动省略，避免生成无效 SEO 元数据 `fabaf62`
- `ads.txt` 由静态复制改为构建时动态生成，未配置 `ADSENSE_ID` 时跳过 `fabaf62`
- 子模板 `canonical`/`og_url` block 增加 `site.url` 空值保护，避免未设置域名时求值为相对路径 `861bc87`
- `AUTHOR_NAME` / `SITE_ICP` / `SITE_PSB` 统一增加 `.trim()`，防止纯空白环境变量被误判为已设置 `1b625d3`
- CI workflow (`ci.yml`) 的 build 步骤注入环境变量，确保合并后 CI 构建结果与生产一致 `6ae8c2f`
- 测试覆盖：新增 RSS/sitemap/robots 跳过行为测试、ads.txt 生成与跳过测试、环境变量隔离恢复测试 `a4216bb`

## 2026-05-10 更新（PR #11 — 全面安全审计与代码质量提升）
- 全面安全审计：移除 URL 硬编码 Token 改用 `GIT_ASKPASS`、iframe 白名单限制（youtube/bilibili）、CSP/HSTS/Referrer-Policy/Permissions-Policy 响应头加固、Mermaid SVG DOMParser 二次清洗、修复 `check-links.js` 路径遍历漏洞 `ebf5e91`
- 新增 52 个测试用例（总计 108 个），覆盖率 32%→60%，补充 `generators.js` / `renderer.js` / `build.js` 完整测试及边界情况 `ebf5e91`
- 代码质量重构：降低 `main()` 圈复杂度 31→6、`pullContent()` 26→9，提取 scripts 公共逻辑到 `lib/utils.js`，删除自定义 `safe` filter 消除 XSS 风险，修复 watch 模式 Promise 漂浮与构建时间报告 `ebf5e91`
- 工程化完善：新增 ESLint、Prettier、Husky pre-commit、`.editorconfig`、Jest、GitHub Actions CI（Node 18/20/22 矩阵）、`CONTRIBUTING.md`、`npm ci` 替代 `npm install` `ebf5e91`
- 新增工具脚本：`check-links.js`（链接有效性检查）、`validate-frontmatter.js`（文章元数据校验）、`check-bom.js`（UTF-8 BOM 检测与自动修复）`ebf5e91`
- 修正 TypeScript 类型定义，补充 `pullContent` / `parsePosts` / `generators` 返回类型 `ebf5e91`

## 2026-05-10 更新（PR #10 — 构建正确性）
- 修复构建脚本多处正确性：Invalid Date 回退、pullContent 不删本地目录、`__dirname` 定位、sitemap 过滤 hidden、watch 防抖互斥 `8af8ecb`
- 使用 `sanitize-html` 替代手写正则过滤，自动为 `target="_blank"` 链接补全 `rel="noopener noreferrer"` `8af8ecb`
- `.gitignore` 补全环境变量、IDE、OS 文件、日志等忽略规则 `8af8ecb`

## 2026-05-09 更新
- SEO全面优化与构建脚本健壮性提升，模板增加结构化数据，`lib` 模块增加安全策略与 Nunjucks 过滤器 `9651e11`
- 集成 Google AdSense 自动广告、站点验证与 `ads.txt` 部署 `574328b`, `9ca2e7e`, `803f179`, `6b5e1b4`
- 集成 Giscus (GitHub Discussions) 评论系统 `abadff9`, `47ab61f`
- 修复构建脚本 `pullContent` 目录安全检测与 URL 尾部斜杠规范化，模板标题改为动态读取 `a42bc4a`
- 统一 UTF-8 无 BOM 编码与 LF 换行符规范 `ca37cdf`
- 清理误提交的 `node_modules` 并补充 `.gitignore` `8e4ad58`, `1b0f54f`

## 2026-05-08 更新
- 构建流程自动生成 `sitemap.xml` 与 `robots.txt` `30871f7`
- 模板页脚增加 ICP 备案号展示 `5dc3e08`
- 新增文章目录 (TOC) 自动生成、回到顶部按钮与移动端适配 `0ec7c25`
- 修复标签 slug 生成与中文标签链接 404 问题，日期 fallback 改为文件 mtime `db60fc0`
- 将 `build.js` 重构为 `lib` 模块化架构，修复 shell 注入风险与单文件错误隔离 `48e421b`
- 清理 `dist/` 构建产物移出版本控制 `a4c02d3`

## 2026-04-29 更新
- 修复 `pullContent` 路径检测逻辑，支持 `content/posts` 子目录 `43bc37a`

## 2026-04-23 更新
- 新增 webuser-agent 工具页面与构建生成逻辑 `5bf6e95`

## 2026-04-15 更新
- 将 Mermaid 图表库从 CDN 迁移为本地自托管，新增 `.gitattributes` 统一 LF 换行 `90b372f`

## 2026-04-09 更新
- 新增代码块行号显示、一键复制按钮、Markdown 相对链接自动转换，并新增 README/DEPLOY/FAQ/THEME/WRITING/CHANGELOG 项目文档 `7faf9a8`
- 新增 SVG 站点图标与构建自动复制逻辑 `f5ff72b`
- 新增 Mermaid 图表渲染支持，`main.js` 缓存版本提升至 `v3` `e8a2edc`
- 为 CSS 与 JS 添加缓存破坏版本查询参数强制刷新 `92d9476`, `bc16719`
- 将 Mermaid CDN 从国外切换为国内并确保加载顺序正确 `7566a48`

## 2026-04-08 更新
- 全面重构博客主题为 Bulma 风格三栏布局，引入 CSS 变量体系与响应式设计 `1456fe8`
- 初始化 Bogl 静态博客生成器项目，基于 Node.js + marked + nunjucks 构建引擎 `e56c01d`
