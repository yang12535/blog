# 变更日志

## 2026-05-10 更新
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
