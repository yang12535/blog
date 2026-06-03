# 部署指南

## EdgeOne Pages（推荐）

### 1. 创建项目

登录 [EdgeOne Pages 控制台](https://console.cloud.tencent.com/edgeone/pages)，点击「创建项目」，选择 GitHub 授权并选择 `blog` 仓库。

### 2. 构建设置

首次部署时填写：

| 配置项 | 值 |
|--------|-----|
| 框架预设 | Other |
| 根目录 | `./` |
| 输出目录 | `dist` |
| 构建命令 | `npm run build` |
| 安装命令 | `npm install` |
| Node 版本 | 20.x 或更高 |

> 框架预设、构建命令等可通过 `edgeone.json` 自动识别；环境变量需在 EdgeOne Pages 控制台手动配置。

### 环境变量（可选）

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SITE_URL` | 站点 URL，用于 RSS feed | `https://blog.example.com` |
| `SITE_ICP` | ICP 备案号，留空则不显示 | `京ICP备12345678号-1` |
| `SITE_PSB` | 公网安备号，留空则不显示 | `京公网安备11010502012345号` |
| `CONTENT_REPO` | 外部内容仓库（内容分离部署） | `owner/posts-repo` |
| `CONTENT_BRANCH` | 内容分支 | `main` |
| `GITHUB_TOKEN` | GitHub 访问令牌（私有仓库必填） | `ghp_xxx` |

### 3. 自定义域名（可选）

控制台 → 域名管理 → 添加自定义域名：

1. 输入你的域名（如 `blog.example.com`）
2. 按提示添加 CNAME 记录到你的 DNS 服务商
3. 等待解析生效（通常 1-5 分钟）
4. 自动下发 HTTPS 证书

如需强制 HTTPS 跳转，在域名管理里开启「强制 HTTPS」。

### 4. 后续更新

每次 `git push` 到 main 分支，EdgeOne Pages 会自动重新构建并部署。

---

## CLI 部署

安装 EdgeOne CLI：

```bash
npm i -g edgeone
edgeone login
```

在项目根目录执行：

```bash
edgeone pages deploy
```

---

## 预览部署

在 Pull Request 中会自动生成预览链接，用于审核修改效果。
