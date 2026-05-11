# Bogl Blog 待办事项

> 由质量审查生成。风格不必模板化，重点修复技术错误和事实硬伤。

---

## ✅ 已修复（本轮 PR 中解决）

### `curl-download-slow-fix.md`

| # | 问题 | 位置 | 修复方式 |
|---|------|------|----------|
| 1 | **`--tcp-nodelay` 对 curl 7.55.1 完全无效** — curl 7.50.2+ 默认已启用 TCP_NODELAY | 参数说明表、Profile wrapper、curl-fast.ps1 | 删除该参数或改为说明"7.50.2+ 已默认启用，此处显式写出仅为兼容" |
| 2 | **aria2c 默认不校验文件完整性** — `--check-integrity` 默认是 `false`，对普通 HTTP(S) 无效 | FAQ Q6 | 改为"默认不做校验，如需校验用 `--checksum=...` 或手动比对" |
| 3 | **HTTP/2 描述过于绝对** — curl 7.55.1 `--help` 里有 `--http2`，只是未编译 nghttp2 | 问题现象表 | 改为"编译时未启用 HTTP/2，指定 `--http2` 会报 Unsupported protocol" |
| 4 | **`winget install curl` 可能装到非官方包** — 精确 ID 是 `curl.curl` | 方案四 | 改为 `winget install curl.curl` |
| 5 | **curl-fast.ps1 与 Profile 函数未做区分警告** — 直接复制到 `$PROFILE` 会导致 `-o` 二义性 | 附录源码 | 在源码前加说明：独立脚本用 `param()`，Profile 函数需去掉 `[CmdletBinding()]` |

### `virtualbox-powershell-download-stutter.md`

| # | 问题 | 位置 | 修复方式 |
|---|------|------|----------|
| 1 | **aria2c 示例 URL 含空格** — `https:// mirrors...` 会导致命令失败 | 方案五 | 删除空格 |
| 2 | **curl HTTPS 慢被错误关联到本文根因** — curl 的 stderr 进度条与 IWR 的 Write-Progress 本质不同 | 问题现象/关键观察 | 删除或修改该观察，明确 curl 不受此问题影响 |
| 3 | **"本质"论断过于绝对** — 脉冲可能是多种因素叠加，不能唯一归因于 TCP 反压 | 根因分析第三层 | 改为"这是最主要/最可能的解释" |
| 4 | **"重写"Write-Progress 表述不准确** — PS 7 是优化而非重写，且 7.0 基于 .NET Core 3.1 非 .NET 6 | 方案三 | 改为"PS 7 优化了渲染性能，开销远低于 5.1" |
| 5 | **RDP 防火墙规则中文硬编码** — 英文系统上 `"远程桌面"` 匹配失败 | 方案四 | 改用 `Enable-NetFirewallRule -Group "@FirewallAPI.dll,-28752"` 或加注释提示 |
| 6 | **帧率估计偏高** — 文本控制台刷新率远低于 30 FPS | 根因分析第二层 | 改为"刷新率远低于物理机直连" |

---

## 🟡 P1 — 链接/代码问题（本轮 PR 中已全部修复）

| 文章 | 问题 | 位置 |
|------|------|------|
| `virtualbox-powershell-download-stutter.md` | 参考链接中纯文本条目缺超链接 | 参考链接第 2 条 |
| `curl-download-slow-fix.md` | 同站文章使用外部域名（已改为相对路径） | 参考链接 |
| `install-bun-china.md` | PowerShell 代码缺少 `&` 运算符（已补全） | Q4 方案 C |
| `curl-download-slow-fix.md` | aria2c UA 不完整（已补全） | 方案四示例 |
| `virtualbox-powershell-download-stutter.md` | aria2c UA 不完整（已确认完整） | 方案五示例 |

---

## 🟢 P2 — 风格/排版（可选，不强制统一）

> 文章风格不必模板化。以下问题记录备查，不强制修复。

| 文章 | 问题 | 备注 |
|------|------|------|
| `virtualbox-powershell-download-stutter.md` | UTF-8 BOM | 部分解析器可能不兼容 |
| `virtualbox-powershell-download-stutter.md` | 缺少更新日志 | 可选补充 |
| `curl-download-slow-fix.md` | curl-fast.ps1 完整源码占正文 30% | 可选拆分为独立文件 |
| `curl-download-slow-fix.md` | 更新日志在参考链接之前 | 可选调换 |
| `install-bun-china.md` | 缺少参考链接章节 | 可选补充 |
| 三篇文章 | 表格分隔线长度不统一 | 纯视觉问题 |
| `install-bun-china.md` | `> **坑点：**` 整句加粗 | 与参考文章风格不一致，但可读性无影响 |

---

## 🟡 项目规范缺陷（长期改进）

### 代码质量
- [x] 缺少 ESLint / Prettier 配置
- [x] 缺少 TypeScript 类型定义
- [x] 缺少测试框架
- [x] 缺少 `.editorconfig`
- [x] `build.js` 错误处理不完善

### 工程化
- [x] 缺少 CI/CD 配置
- [x] 缺少 pre-commit hook
- [x] `package.json` 缺少 `lint`、`test`、`format` 脚本
- [x] 缺少 `CONTRIBUTING.md`

### 文章规范
- [x] 无 frontmatter 校验规则
- [x] 无链接有效性检查
- [x] 无 UTF-8 BOM 自动检测

---

## ✅ 本轮修复（PR #11 — 全面安全审计与代码质量提升）

| # | 问题 | 文件 | 修复方式 |
|---|------|------|----------|
| 1 | **Token 硬编码在 URL 中** — `CONTENT_TOKEN` 直接嵌入 `https://x-access-token:...@github.com` | `lib/content.js` | 改用 `GIT_ASKPASS` 环境变量传递凭证，生成临时脚本 |
| 2 | **iframe 无白名单限制** — `sanitize-html` 默认允许任意 `src`，存在 XSS 嵌入风险 | `lib/content.js` | `allowedIframeHostnames` 限制为 `youtube.com` / `bilibili.com` |
| 3 | **Mermaid SVG 未清洗直接插入 DOM** — `wrapper.innerHTML = result.svg` 可能携带恶意脚本 | `src/assets/js/main.js` | `DOMParser` 解析后移除 `script`、`on*` 事件、危险 SVG 元素，并白名单校验 `href` |
| 4 | **CSP / HSTS / Referrer-Policy 缺失** — 仅 `X-Frame-Options` 和 `X-Content-Type-Options` | `edgeone.json` | 新增完整 CSP（含 giscus/AdSense/Fonts 放行）、HSTS、Referrer-Policy、Permissions-Policy |
| 5 | **`check-links.js` 路径遍历漏洞** — 未校验 `..` 跳转 | `scripts/check-links.js` | 添加路径边界检查，限制在项目根目录内 |
| 6 | **测试覆盖率仅 32%** — 核心模块无单元测试 | `tests/` | 新增 52 个用例，覆盖 `build.js`、`generators.js`、`renderer.js`、`content.js`、`utils.js` |
| 7 | **圈复杂度过高** — `main()` 31、`pullContent()` 26 | `build.js` / `lib/content.js` | 重构为生成器模式 + 错误报告，`pullContent` 拆分为独立函数，圈复杂度降至 6 / 9 |
| 8 | **自定义 `safe` filter 存在 XSS 风险** — `env.addFilter('safe', ...)` 直接输出原始 HTML | `lib/renderer.js` | 删除该 filter，依赖 `sanitize-html` 在内容层过滤 |
| 9 | **缺少工程化配置** — 无 ESLint、Prettier、Husky、CI、类型定义 | 根目录 | 新增 `.editorconfig`、ESLint、Prettier、Husky pre-commit、Jest、GitHub Actions CI、`types/` |
| 10 | **缺少文章规范检查工具** — 无 frontmatter / 链接 / BOM 校验 | `scripts/` | 新增 `validate-frontmatter.js`、`check-links.js`、`check-bom.js` |

## ✅ 本轮修复（PR #10 — 构建正确性）

| # | 问题 | 文件 | 修复方式 |
|---|------|------|----------|
| 1 | **Invalid Date 导致文章静默丢弃** — frontmatter 日期格式错误时 `toISOString()` 抛 `RangeError`，被 catch 吞掉 | `lib/content.js` | 增加 `isNaN(d.getTime())` 回退到文件 mtime |
| 2 | **pullContent() 永久删除本地 postsDir** — 只要设了 `CONTENT_REPO` 就先 `rmSync` 本地文章，拉取失败则永久丢失 | `lib/content.js` | 改为 `mkdirSync` + 覆盖复制，保留本地原有文件 |
| 3 | **process.cwd() 导致临时目录乱飞** — 从项目外执行构建时 `.content-tmp` 创建在当前目录 | `lib/content.js` | 改为 `path.join(__dirname, '..', '.content-tmp')` |
| 4 | **sitemap.xml 收录 hidden 文章** — `generateSitemap` 传入 `allPosts` 而非 `published` | `build.js` | 改为传入 `published` 过滤 hidden |
| 5 | **watch 模式并发构建互相删 dist** — 编辑器保存触发多次 `all` 事件，多个 `build()` 并发运行 | `build.js` | 增加 `debounce(150ms)` + `isBuilding` 互斥锁 |
| 6 | **sanitizeHtml 手写正则易被绕过** — 无引号事件处理器、HTML 实体编码、危险标签均无法拦截 | `lib/content.js` | 引入 `sanitize-html` 替换手写正则 |
| 7 | **target="_blank" 缺 rel="noopener"** — `sanitize-html` 默认允许 `a.target`，存在 tabnabbing 风险 | `lib/content.js` | `transformTags` 自动为 `_blank` 链接补 `rel="noopener noreferrer"` |
| 8 | **.gitignore 严重不完整** — 仅 `dist/` 和 `node_modules/`，缺 `.env`、IDE、OS 文件、日志 | `.gitignore` | 补全 14 项忽略规则 |

---

## ✅ 本轮修复（PR #12 — 移除硬编码配置）

| # | 问题 | 文件 | 修复方式 |
|---|------|------|----------|
| 1 | **硬编码域名与备案号** — `SITE_URL` 默认 `bash.yang125.fun`，`SITE_ICP` 默认 `皖ICP备...` | `build.js` | 默认值改为空字符串，改为从环境变量读取 |
| 2 | **硬编码 AdSense ID** — `ca-pub-4120379355917420` 直接写在 `base.html` 与 `src/assets/ads.txt` | `build.js` / `base.html` | 改为从 `ADSENSE_ID` 环境变量读取，动态生成 `ads.txt` |
| 3 | **硬编码 GitHub 仓库链接** — `https://github.com/yang12535/blog` 写在导航栏 | `base.html` | 改为从 `GITHUB_URL` 环境变量读取，条件渲染 |
| 4 | **硬编码 Giscus 评论配置** — `repoId` / `categoryId` 有默认值 | `build.js` | 默认值改为空字符串，未配置时跳过 Giscus 脚本 |
| 5 | **CONFIG 模块加载副作用** — `require('build.js')` 时立即校验环境变量并输出 `console.warn` | `build.js` | 重构为 `loadConfig()` 函数，仅在 `build()` 调用时执行 |
| 6 | **SITE_URL 未校验** — 无 scheme 检查、无凭据检查、无 trim | `build.js` | 增加 `URL` 解析校验，仅允许 `http`/`https`，拒绝含用户名密码的 URL |
| 7 | **未设置 SITE_URL 时仍生成无效 SEO 文件** — RSS / sitemap / robots 使用相对路径 `/posts/...` | `build.js` / 模板 | 未设置时标记为 `skipped`，模板中 `canonical` / `og:url` / `JSON-LD` 条件省略 |
| 8 | **子模板 block 依赖父模板守卫** — `canonical` / `og_url` block 在 `site.url` 为空时求值为相对路径 | `post.html` / `archive.html` / `tag.html` / `tags.html` | block 内部增加 `{% if site.url %}` 保护 |
| 9 | **环境变量未 trim** — `SITE_ICP` / `SITE_PSB` / `AUTHOR_NAME` 含空白时被误判为已设置 | `build.js` | 统一增加 `.trim()`，空值视为未设置 |
| 10 | **CI 构建缺少环境变量** — 合并后 CI 中所有配置为空，生成纯净版博客 | `.github/workflows/ci.yml` | build 步骤注入环境变量，优先读取 `vars`/`secrets`，未配置时回退到原默认值 |

## ✅ 已完成的审查任务

- [x] 链接与交叉引用审查（发现 6 处问题）
- [x] 行文结构与风格一致性审查（发现 20+ 处问题，风格类不强制修复）
- [x] 技术准确性审查（发现 11 处问题，含 5 处严重错误）
- [x] 生成 `changed.md`（133 行，43 条 commit）
- [x] 代码可执行性审查（PR #10 完成首轮修复，共 8 处）
- [x] 硬编码配置清理（PR #12 完成，共 10 处）

---

> 生成时间：2026-05-10
> 原则：风格不必模板化，重点修技术错误。
