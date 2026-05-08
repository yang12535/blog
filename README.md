# Bogl Blog

轻量静态博客生成器，专为 [Tencent EdgeOne Pages](https://pages.edgeone.ai/) 优化。

## 特性

- **纯静态输出**：无服务端依赖，部署简单
- **自动编码转换**：GBK / GB2312 自动识别并转为 UTF-8
- **换行规范化**：CRLF 自动转为 LF
- **Markdown 支持**：YAML Frontmatter + 标准 Markdown 语法
- **Mermaid 图表**：支持 `mermaid` 代码块渲染流程图等
- **多页面生成**：首页、文章页、标签页、归档页、RSS
- **文章目录**：自动生成 TOC 侧边栏导航
- **主题系统**：基于 Nunjucks 模板引擎，易于定制

## 目录结构

```
.
├── build.js              # 构建入口
├── edgeone.json          # EdgeOne Pages 配置
├── package.json          # 项目依赖
├── lib/                  # 核心构建模块
│   ├── content.js        # 内容拉取与 Markdown 解析
│   ├── renderer.js       # Nunjucks 模板渲染
│   ├── generators.js     # 页面生成器
│   └── utils.js          # 工具函数
├── src/
│   ├── templates/        # Nunjucks 模板
│   │   ├── base.html
│   │   ├── index.html
│   │   ├── post.html
│   │   ├── tag.html
│   │   ├── tags.html
│   │   └── archive.html
│   └── assets/
│       ├── css/style.css
│       ├── js/main.js
│       └── vendor/mermaid.min.js
├── content/
│   └── posts/            # Markdown 文章存放处
└── dist/                 # 构建输出（部署目录）
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run build        # 构建到 dist/
npm run dev          # 监听模式，文件变更自动重建
npm run clean        # 清理 dist/
```

本地预览：

```bash
cd dist && python -m http.server 8080
```

访问 http://localhost:8080

### 写作

在 `content/posts/` 目录下新建 `.md` 文件：

```markdown
---
title: 文章标题
date: 2026-04-08
tags: [标签1, 标签2]
---

正文内容，支持 Markdown 语法。
```

### Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 文章标题 |
| `date` | 否 | 发布日期，默认文件修改时间 |
| `tags` | 否 | 标签数组 |
| `draft` | 否 | 设为 `true` 则不发布 |

## 部署到 EdgeOne Pages

### 方式一：Git 部署（推荐）

1. Fork/Clone 本项目到 GitHub 私有仓库
2. 在 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages) 创建项目
3. 选择 GitHub 仓库，授权访问
4. 配置自动构建：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
5. 保存并部署

后续每次 `git push` 都会自动触发重新构建和部署。

### 方式二：CLI 部署

```bash
npx edgeone pages deploy
```

## 自定义配置

### 站点信息

编辑 `build.js` 顶部的 `CONFIG`：

```javascript
const CONFIG = {
  title: '你的博客标题',
  description: '博客描述',
  postsPerPage: 10,
  siteUrl: process.env.SITE_URL || 'https://your-domain.com',
  icp: process.env.SITE_ICP || '',
  psb: process.env.SITE_PSB || '',
};
```

或通过环境变量覆盖：`SITE_URL`、`SITE_ICP`、`SITE_PSB`。

### 主题样式

修改 `src/assets/css/style.css` 即可自定义主题。

模板文件位于 `src/templates/`，使用 [Nunjucks](https://mozilla.github.io/nunjucks/) 语法。

### 缓存与安全

`edgeone.json` 中已预配置：

- 静态资源长期缓存：`/assets/*`（`max-age=31536000, immutable`）
- 安全响应头：`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`
- 边缘缓存策略：文章页 1 天，RSS 0 秒

如需更新 CSS/JS 并强制浏览器刷新，修改模板中引用路径的版本号：

```html
<link rel="stylesheet" href="assets/css/style.css?v=6">
```

## 内容分离部署（可选）

如果希望文章仓库与生成器仓库分离，可设置环境变量：

| 环境变量 | 说明 |
|----------|------|
| `CONTENT_REPO` | 内容仓库，如 `owner/posts-repo` |
| `CONTENT_BRANCH` | 内容分支，默认 `main` |
| `GITHUB_TOKEN` | GitHub 访问令牌（私有仓库必填） |

在 EdgeOne Pages 控制台 → 项目设置 → 环境变量 中添加即可。

## 限制说明

- EdgeOne Pages 为 **Clean Build** 环境，每次构建都是全新的，不支持增量构建
- 单项目文件数上限：20,000
- 单文件大小上限：25 MB
- 账户总存储上限：5 GB

## License

- **代码**（build.js、lib/、模板、样式、脚本等）：[MIT License](LICENSE)
- **文章/内容**（`content/` 目录下）：采用 [CC BY 4.0](content/LICENSE) 许可，转载需署名并附上原作者 GitHub 链接（https://github.com/yang12535）
