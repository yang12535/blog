# 更新日志

## 2026-05-08

### 重构

- `build.js` 拆分为 `lib/` 模块：`content.js`、`renderer.js`、`generators.js`、`utils.js`

### 新增

- 文章目录（TOC）自动生成与侧边栏导航
- 回到顶部按钮及移动端适配
- Mermaid 图表支持
- ICP / 公网安备号配置（`SITE_ICP`、`SITE_PSB` 环境变量）

### 变更

- `edgeone.json` 更新：新增安全响应头（`X-Frame-Options`、`X-Content-Type-Options`）、边缘缓存策略
- 标签 slug 行为统一：中文保留，空格/特殊符号转为 `-`
- date fallback 统一使用文件修改时间（mtime）
- `dist/` 移出版本控制，加入 `.gitignore`

### 修复

- 移动端回到顶部按钮被系统导航栏遮挡

---

## 2026-04-08

### 新增

- 全新 Bulma 风格主题（顶部导航 + 左侧边栏 + 卡片式文章列表）
- 代码块增强：左侧行号、自动换行、一键复制按钮
- Markdown `.md` 内部链接自动转换为文章 URL
- 支持从外部仓库拉取内容（`CONTENT_REPO` 环境变量）
- 完整的 README / DEPLOY / WRITING 文档

### 变更

- 重写 CSS 为旧仓库 Bulma 风格配色
- 模板结构调整为三栏布局
- `edgeone.json` 字段修正（适配 EdgeOne Pages 官方规范）

### 修复

- 移除无效的增量构建逻辑（Clean Build 环境不支持）
- 修复 `marked` ESM 导入问题
- 修复 CSS 缓存问题（添加版本查询参数）

---

## 早期版本

- 初始项目骨架
- 基础 Markdown 渲染 + Nunjucks 模板
- GBK/GB2312 自动编码转换
- CRLF → LF 自动换行规范化
