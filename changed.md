# 变更日志

## 2026-05-09

### 新增功能
- `574328b` feat: add AdSense auto-ads script
- `9ca2e7e` feat: add AdSense verification meta tag
- `803f179` feat: add about page, avatar, ads.txt
- `abadff9` feat: integrate Giscus (GitHub Discussions) comments
- `9651e11` feat(site): SEO 全面优化 + 构建脚本健壮性提升 (#6)
- `3274dbe` feat(site): SEO 全面优化 + 构建脚本健壮性提升

### 修复
- `e34678f` fix(posts): 简化 PowerShell 下载完整性检查，修复执行策略说明 (#4)
- `f7bb521` fix(posts): 简化 PowerShell 下载完整性检查，修复执行策略说明
- `f3cefd6` style: 恢复 kimi-cli-install-win.md 中被误删的段落换行行尾双空格
- `f7f54eb` style: 恢复引用块内用于换行的行尾双空格
- `83eb219` style: 统一分隔线、移除重复 H1、修复末尾连续分隔线与多余空行
- `ca37cdf` fix: 移除 UTF-8 BOM，将 CRLF 统一为 LF
- `6b5e1b4` fix: copy ads.txt to site root

### 文档
- `bec6895` docs: 更新 Windows 教程文档（兼容性实测 + 结构调整）
- `7d813c3` docs更新，内容追加，兼容性实测
- `b010cc4` docs(curl): append curl-fast.ps1 source code and changelog

### 优化
- `1b0f54f` chore: 移除误提交的 node_modules，补充 .gitignore

## 2026-05-08

### 新增功能
- `30871f7` feat: generate sitemap.xml and robots.txt during build
- `5dc3e08` feat: 悬挂 ICP 备案号
- `0ec7c25` feat: 添加文章目录(TOC)跳转、回到顶部按钮及移动端适配

### 修复
- `db60fc0` Fix tag link slugs and date fallback consistency (#2)
- `b94a2bc` fix: 移动端隐藏回到顶部按钮
- `69e10e0` fix: 移动端回到顶部按钮改用 div 避免默认样式干扰
- `ed5d5f1` fix: 修复移动端回到顶部按钮被系统导航栏遮挡
- `eb57f5f` 删除多余的，#Requires -Version 5.1

### 文档
- `69ac3e2` docs: sync project docs with current codebase
- `06a0eb7` 更新 LICENSE、添加 GitHub 导航链接及相关文档

### 优化
- `48e421b` refactor: split build.js into modules and fix code quality issues
- `a4c02d3` chore: remove dist/ from git and add to .gitignore

## 2026-05-06

### 修复
- `88c3f83` 删除多余的，#Requires -Version 5.1

### 文档
- `6d93fdd` docs update

## 2026-04-29

### 新增功能
- `f360619` new docs
- `05a601e` winget install for ps5.1
- `aaee4f9` Update winget installation guide for Windows

### 修复
- `43bc37a` fix(build): support content/posts path in pullContent()

### 文档
- `9826c0d` docs(install-bun-china): fix msiexec wait, detect existing Node.js, add nvm-windows support
- `d5935a4` docs update
- `be5a2dc` docs update

## 2026-04-28

### 文档
- `60a73dc` 文档更新

## 2026-04-23

### 新增功能
- `5bf6e95` feat: 整合 webuser-agent UI 增强 (#1)

## 2026-04-16

### 修复
- `202cb19` fix: 修复 RHEL 9 换源后 yum update 身份冲突问题

### 文档
- `4e638c5` docs: 添加醒目的不可逆操作警告

## 2026-04-15

### 新增功能
- `9298a4b` feat: add mermaid diagram for Microsoft Store python hijacking in win install post
- `90b372f` feat: vendor mermaid.min.js to avoid external CDN

## 2026-04-14

### 优化
- `553a08c` name yaml update

### 文档
- `2cf1715` win store update

## 2026-04-09

### 新增功能
- `e8a2edc` Add Mermaid diagram support
- `f5ff72b` Add SVG favicon
- `7faf9a8` feat: code block line numbers + copy, fix .md link resolution, add docs
- `7474f7a` new docs

### 修复
- `7566a48` Fix: use domestic CDN for mermaid, ensure main.js loads first
- `bc16719` fix: add cache-busting version to main.js

### 文档
- `4f8ab5c` doc update win kimicli

## 2026-04-08

### 新增功能
- `1456fe8` feat: apply old blog theme (Bulma-style layout)

### 修复
- `92d9476` fix: bust css cache with version query
- `86f73cc` fix: add code block for powershell script
- `77ea67c` fix: update frontmatter for kimi-cli-install-win

### 初始化
- `e56c01d` init: bogl static blog
