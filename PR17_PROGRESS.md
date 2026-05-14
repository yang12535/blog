# PR #17 处理进度：refactor: 极速精简终端配置指南

## 基本信息

- **PR**: https://github.com/yang12535/blog/pull/17
- **分支**: `refactor/slim-terminal-guide`
- **文件**: `content/posts/win-terminal-setup.md`
- **目标**: 还原机房 PowerShell 7 + Windows Terminal 极速配置（conhost + PS5.1）

---

## 迭代记录

### Round 1 — 已有修复（前序 commit）

| # | 问题 | 状态 |
|---|---|---|
| 3238355152 | "Unpackaged，无需管理员" 表述误导 | ✅ 已移除 |
| 3238355175 | msiexec /qn 失败不报错 | ✅ `$LASTEXITCODE` 检查（0/3010/1641） |
| 3238355185 | ENABLE_PSREMOTING=1 额外暴露面 | ✅ 已移除 |
| 3238432347 | 代理版 `$LASTEXITCODE -ne 0` 误判 | ✅ 同步修复 |
| 3238432358 | 缺少管理员运行提示 | ✅ 增加 ⚠️ 提示 |
| 3238432372 | REGISTER_MANIFEST=1 参数表缺失 | ✅ 从示例中移除 |

### Round 2 — commit `2b4ccda`

| # | 问题 | 修复方式 |
|---|---|---|
| 3238478870 | Profile/settings.json 直接覆盖 | 写入前自动备份到 `.backup.时间戳` |
| 3238478891 | 多处硬编码版本号 | 提取 `$ps7Ver` / `$wtVer` 变量 |
| 3238478908 | Invoke-WebRequest 无超时/错误处理 | 统一加 `-ErrorAction Stop -TimeoutSec 300` |
| 3238478930 | `$ProgressPreference` 副作用外泄 | `Get-WithProxy` 用 `try/finally` 恢复旧值 |

### Round 3 — commit `f93bfbf`

| # | 问题 | 修复方式 |
|---|---|---|
| 3240714045 | "升级时只需改这里" 文案误导 | 改为"版本号与 SHA256（升级时需同步更新）" |
| 3240714077 | 文档路径硬编码版本号 | 配置速查表与 FAQ 改为变量/占位符形式 |
| 3240714101 | `-UseBasicParsing` 在 PS7 不支持 | **未修改** — 脚本明确在 PS5.1 运行，该参数在 PS5.1 是**必需**的 |

### Round 4 — commit `7bd3989`

| # | 问题 | 修复方式 |
|---|---|---|
| 3240816916 | FAQ 用了 `$wtVer` 变量，单独复制会失败 | 改回写死版本号 `terminal-1.21.3231.0` |
| 3240816948 | `$env:USERPROFILE\Desktop` 在重定向/域策略下失效 | 改为 `[Environment]::GetFolderPath('Desktop')` |
| 3240816973 | 提示文案写死"PowerShell 7.4…" | 改为 `$ps7Ver` / `$wtVer` 变量 |

### Round 5 — commit `8dbabc8`

| # | 问题 | 修复方式 |
|---|---|---|
| — | 异常/提示文案仍硬编码 "7.4" | `throw` / `Write-Host` 全部改为 `$ps7Ver` |
| — | FAQ 写死版本号与配置速查表不一致 | 改为 `terminal-<版本>` 占位符，并提示替换 |

### Round 6 — commit `b66dfa2`

| # | 问题 | 修复方式 |
|---|---|---|
| — | msiexec 未禁用自动重启，还原卡会丢配置 | 增加 `REBOOT=ReallySuppress`，仅接受 0/3010 |
| — | 快捷方式创建前未校验 wtExe 是否存在 | 增加 `Test-Path $wtExe`，不存在则 `throw` |
| — | 分步详解示例命令写死版本号 | 改为 `PowerShell-<版本>-win-x64.msi` |

### Round 7 — commit `8d4b0df`

| # | 问题 | 修复方式 |
|---|---|---|
| — | 代理版快捷方式前未校验 `$wtExe` | 代理版增加 `Test-Path` 校验 |
| — | 代理版缺少管理员检测 | 直连版 + 代理版均增加管理员权限检测 |

---

## 当前待处理

- [ ] 等待 Copilot 下一轮 review
- [ ] CI 状态确认（`build (18)` 曾因 npm ECONNRESET 失败，已重跑）
- [ ] 用户确认后合并

---

## 测试验证记录

| 测试项 | 结果 |
|---|---|
| 变量展开（`$ps7Ver` / `$wtVer`） | ✅ PASS |
| `Invoke-WebRequest` 下载 WT zip | ✅ PASS |
| `Expand-Archive` 解压 | ✅ PASS |
| Profile 备份 + 写入 | ✅ PASS |
| settings.json 备份 + 写入 | ✅ PASS |
| 桌面快捷方式创建 | ✅ PASS |
| `$LASTEXITCODE` 语义（0 / 3010） | ✅ PASS |
| 管理员权限检测 | ✅ PASS |
| PS5.1 脚本解析（UTF-8 BOM） | ✅ PASS |

---

## 关键设计决策

1. **`-UseBasicParsing` 保留**：脚本目标运行环境为 **PS5.1**，`-UseBasicParsing` 在 PS5.1 是必需参数（否则依赖 IE 引擎，机房环境会报错）。PS7 中该参数虽被弃用但无影响。
2. **不合并 PR**：按用户要求，未执行 `gh pr merge`。
