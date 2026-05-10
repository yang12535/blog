# 贡献指南

感谢你对 Bogl 项目的关注！本文档将帮助你快速了解如何参与开发。

## 开发环境搭建

### 前置要求

- [Node.js](https://nodejs.org/) 18+
- [Git](https://git-scm.com/)

### 安装步骤

```bash
# 克隆仓库
git clone <仓库地址>
cd bogl-html

# 安装依赖
npm install

# 本地开发（热重载模式）
npm run dev

# 构建
npm run build
```

## 代码规范

本项目使用 ESLint + Prettier 进行代码检查和格式化。

### ESLint 配置

项目根目录的 `eslint.config.js` 已配置好规则，主要包括：

- 使用 CommonJS 模块规范
- Node.js 全局变量
- 推荐规则（`no-unused-vars`、`prefer-const` 等）

### Prettier 配置

项目根目录的 `.prettierrc` 已配置好格式规则：

- 缩进：2 空格
- 单引号
- 行宽：100 字符
- 换行符：LF

### 运行检查

```bash
# 检查代码
npm run lint

# 格式化代码
npm run format
```

## 提交前检查

本项目已配置 `husky` + `lint-staged`，在 `git commit` 时会自动执行：

- **JS 文件**：自动运行 `eslint --fix`
- **Markdown / JSON 文件**：自动运行 `prettier --write`

如果格式化或检查失败，commit 会被阻止。请修复问题后重新提交。

> 首次安装依赖后，`prepare` 脚本会自动启用 husky hook。如未生效，可手动运行 `npm run prepare`。

## 分支策略

```
main          主分支，始终可部署
  │
  ├─ feat/xxx   功能分支
  ├─ fix/xxx    修复分支
  └─ docs/xxx   文档分支
```

- **main**：保护分支，只能通过 PR 合并，禁止直接 push
- **功能分支**：从 `main` 切出，命名格式 `feat/功能描述`
- **修复分支**：命名格式 `fix/问题描述`
- **文档分支**：命名格式 `docs/文档描述`

### 分支命名示例

```bash
git checkout -b feat/rss-support
git checkout -b fix/encoding-bug
git checkout -b docs/contributing-guide
```

## PR 流程

1. **Fork 仓库**（如果是外部贡献者）或直接创建分支
2. **创建功能分支**：`git checkout -b feat/xxx`
3. **开发并提交**：遵循 [提交信息规范](#提交信息规范)
4. **确保检查通过**：
   ```bash
   npm run lint
   npm run build
   ```
5. **推送到远程**：`git push origin feat/xxx`
6. **创建 Pull Request**：
   - 标题简洁描述变更
   - 正文说明改动原因和影响范围
   - 关联相关 Issue（如有）
7. **代码审查**：等待维护者审查，根据反馈修改
8. **合并**：审查通过后由维护者合并到 `main`

### 提交信息规范

推荐使用简洁的提交信息格式：

```
<类型>: <描述>

[可选的详细说明]
```

**类型**：

- `feat`：新功能
- `fix`：修复 bug
- `docs`：文档更新
- `style`：代码格式（不影响功能）
- `refactor`：重构
- `test`：测试相关
- `chore`：构建/工具相关

**示例**：

```
feat: 添加 RSS 订阅生成功能

- 在 build.js 中集成 rss 生成
- 添加 rss 模板
- 更新配置文档
```

## 文章写作规范

如果你要贡献文章内容，请遵循以下规范。

### 文件位置

所有文章放在 `content/posts/` 目录下，文件名即 URL slug。

```
content/posts/
├── hello-world.md
├── my-article.md
└── 2026-04-08-title.md
```

### Frontmatter 格式

每篇文章开头必须包含 YAML frontmatter：

```markdown
---
title: 文章标题
date: 2026-04-08
tags: [tag1, tag2]
---
```

**字段说明**：

| 字段    | 类型     | 必填 | 说明                                                      |
| ------- | -------- | ---- | --------------------------------------------------------- |
| `title` | string   | ✅   | 文章标题                                                  |
| `date`  | string   | ❌   | 发布日期，`YYYY-MM-DD` 格式；未填写时默认使用文件修改时间 |
| `tags`  | string[] | ❌   | 标签数组                                                  |
| `draft` | boolean  | ❌   | `true` 时不发布                                           |

**标签 slug 规则**：

- 转为小写
- 空格、下划线替换为 `-`
- 保留中文字符
- 移除其他特殊符号

例如：`深度学习` → `/tags/深度学习/`，`Node.js` → `/tags/node-js/`。

### Markdown 规范

支持标准 Markdown 及扩展：

````markdown
# 一级标题（文章内请勿使用，标题已在模板中）

## 二级标题

### 三级标题

**粗体** _斜体_ ~~删除线~~

- 无序列表
- 子项

1. 有序列表
2. 第二项

> 引用块

[链接文本](https://example.com)

![图片描述](https://example.com/image.png)

| 表格 | 列二 |
| ---- | ---- |
| A    | B    |

```代码块
支持围栏代码块
```
````

`````

**Mermaid 图表**：

````markdown
```mermaid
graph TD
  A[开始] --> B{判断}
  B -->|是| C[执行]
  B -->|否| D[结束]
`````

````

### 内部链接

链接到站内其他文章时，使用相对路径：

```markdown
[相关文章](./another-article.md)
```

构建时会自动转换为正确的文章 URL。

### 图片引用

**方式一：外部图床**

```markdown
![alt](https://cdn.example.com/image.png)
```

**方式二：仓库内图片**

将图片放入 `src/assets/images/`，使用绝对路径：

```markdown
![alt](/assets/images/photo.png)
```

### 编码与换行

- 文件编码：**UTF-8 无 BOM**
- 换行符：LF（构建脚本会自动将 CRLF 转为 LF）

### 发布前自查

提交文章前建议检查：

1. **技术准确性**：命令、版本号、参数是否经过验证
2. **代码可执行性**：示例代码能否直接复制运行
3. **链接有效性**：站内链接使用 `./xxx.md`，外部 URL 无截断
4. **构建验证**：运行 `npm run build` 确保无报错
5. **frontmatter 完整性**：标题是否填写，日期格式是否正确

## 其他注意事项

- 提交前请确保 `npm run build` 能正常执行
- 不要提交 `dist/` 目录（已在 `.gitignore` 中忽略）
- 不要提交敏感信息（密钥、密码等）
- 如有疑问，欢迎先创建 Issue 讨论

---

感谢你的贡献！
````
