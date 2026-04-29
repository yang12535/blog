---
title: 国内网络环境 Windows 安装 Bun（TUNA + 阿里云）
date: 2026-04-29
tags: [bun, nodejs, windows, mirror, npm, 国内镜像]
---

> 在 Windows 上绕过 GitHub 访问限制，通过清华 TUNA 镜像安装 Node.js，再走阿里云 npm 源安装 Bun，全程无需翻墙。适用于机房、校园网、企业内网等受限环境。
>
> 复制脚本 → 粘贴 → 回车，获得一个带国内镜像加速的 Bun 运行时。

* * *

## 环境信息

| 项目 | 说明 |
| --- | --- |
| **系统** | Windows 10 / Windows 11（64 位） |
| **权限** | 普通用户即可（Node.js 安装会自动写 Program Files，若提示权限请右键 PowerShell 以管理员运行） |
| **场景** | 校园网、机房、企业内网、无代理环境 |
| **目标** | Bun 1.x 可运行，且后续 `bun install` 走国内源 |
| **网络** | 无法稳定访问 GitHub，但可访问国内镜像站 |

* * *

## 一键脚本（复制即用）

在 PowerShell 里复制粘贴执行（支持 Windows PowerShell 5.1 或 PowerShell 7）：

```powershell
# --- 0. 准备目录 ---
$temp = "$env:TEMP\bunsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# --- 1. 从清华 TUNA 镜像下载 Node.js LTS ---
$nodeUrl = "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v22.14.0/node-v22.14.0-x64.msi"
$nodeOut = "$temp\node-v22.14.0-x64.msi"
if (-not (Test-Path $nodeOut)) {
    Write-Host ">>> 从清华 TUNA 下载 Node.js v22.14.0..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeOut -UseBasicParsing
}

# --- 2. 静默安装 Node.js ---
Write-Host ">>> 安装 Node.js..." -ForegroundColor Cyan
msiexec /i "$nodeOut" /qn /norestart
Start-Sleep -Seconds 15

# --- 3. 刷新环境变量，让当前会话能识别 npm ---
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\nodejs"

# --- 4. npm 切到阿里云镜像 ---
Write-Host ">>> 配置 npm 国内源..." -ForegroundColor Cyan
& "C:\Program Files\nodejs\npm.cmd" config set registry https://registry.npmmirror.com/

# --- 5. 通过 npm 安装 Bun ---
Write-Host ">>> 通过 npm 安装 Bun..." -ForegroundColor Cyan
& "C:\Program Files\nodejs\npm.cmd" install -g bun

# --- 6. 验证安装 ---
$env:Path += ";C:\Users\$env:USERNAME\AppData\Roaming\npm"
$bunExe = "$env:APPDATA\npm\node_modules\bun\bin\bun.exe"
$bunVer = & $bunExe --version
Write-Host ">>> Bun 安装完成: $bunVer" -ForegroundColor Green

# --- 7. 写入 Bun 国内源配置 ---
$bunfig = @"
[install]
registry = "https://registry.npmmirror.com/"
"@
Set-Content -Path "$env:USERPROFILE\.bunfig.toml" -Value $bunfig -Encoding UTF8
Write-Host ">>> 已写入 ~/.bunfig.toml，bun install 将走阿里云镜像" -ForegroundColor Green

# --- 8. 删除 bun.ps1，避免 Windows PowerShell 5.1 执行策略拦截 ---
Remove-Item -Path "$env:APPDATA\npm\bun.ps1" -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\npm\bunx.ps1" -ErrorAction SilentlyContinue
Write-Host ">>> 已清理 bun.ps1 wrapper，Windows PowerShell 5.1 可直接使用 bun" -ForegroundColor Green

# --- 9. 把 Bun 全局安装目录加入 PATH ---
$bunGlobalBin = "$env:USERPROFILE\.bun\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$bunGlobalBin*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$bunGlobalBin", "User")
    Write-Host ">>> 已添加 Bun 全局目录到 PATH: $bunGlobalBin" -ForegroundColor Green
}
```

> **提示**：脚本运行期间请不要关闭窗口。TUNA 镜像下载速度通常在 5~20MB/s，若卡住超过 3 分钟请检查网络。

* * *

## 分步详解

### 1. 从清华 TUNA 镜像下载 Node.js

Bun 官方推荐通过 `curl -fsSL https://bun.sh/install | bash` 安装，但这需要从 GitHub Releases 下载二进制，国内基本连不上。

**曲线救国**：先装 Node.js，获得 npm，再通过 npm 装 Bun。npm 包本身托管在 registry 上，国内有完整镜像同步。

Node.js 官方二进制分发地址是 `https://nodejs.org/dist/`，清华 TUNA 做了完整镜像：

```
https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/
```

| 镜像站 | 地址 | 说明 |
| --- | --- | --- |
| **清华 TUNA** | `https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/` | 全版本同步，推荐 |
| **华为云** | `https://repo.huaweicloud.com/nodejs/` | 全版本同步，备用 |
| **阿里云** | `https://npm.taobao.org/mirrors/node/` | 旧地址，会跳转到新域名 |

脚本中固定了 `v22.14.0`（LTS 长期支持版），如需其他版本，去镜像站目录里挑对应的 `node-vXX.XX.XX-x64.msi` 改 URL 即可。

### 2. 静默安装 Node.js

```powershell
msiexec /i "node-v22.14.0-x64.msi" /qn /norestart
```

| 参数 | 含义 |
| --- | --- |
| `/i` | 安装模式 |
| `/qn` | 静默安装，无弹窗 |
| `/norestart` | 禁止自动重启 |

安装后本体位于 `C:\Program Files\nodejs\`，与系统互不冲突。

### 3. 刷新环境变量

Node.js 安装程序会修改系统 PATH，但**当前已打开的 PowerShell 窗口不会自动感知**。脚本里通过读取注册表重新拼接 Path 来解决：

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\nodejs"
```

> **坑点：装完 node 后当前窗口仍提示找不到 npm**
>
> 如果不刷新 Path，你会看到 `npm : 无法将 npm 识别为 cmdlet...`。新开一个 PowerShell 窗口也能解决，但脚本里直接刷新更方便。

### 4. npm 切到阿里云镜像

npm 官方源 `https://registry.npmjs.org/` 在国内访问缓慢且经常丢包。阿里云镜像（原淘宝 npm 域名）是目前最稳的国内源：

```powershell
npm config set registry https://registry.npmmirror.com/
```

> **坑点：淘宝源旧域名已废弃**
>
> 以前常用的 `https://registry.npm.taobao.org/` 虽然还能跳转，但官方已迁移到 `https://registry.npmmirror.com/`。建议直接写新域名，避免未来 301 失效。

### 5. 通过 npm 安装 Bun

```powershell
npm install -g bun
```

npm 全局安装时，会把 Bun 的二进制文件下载到 `%APPDATA%\npm\node_modules\bun\bin\bun.exe`。整个流程走的都是阿里云镜像，无需访问 GitHub。

### 6. Bun 国内源配置

Bun 作为包管理器时，默认读取 npm 的配置，但为了确保万无一失，脚本额外写了一个 `~/.bunfig.toml`：

```toml
[install]
registry = "https://registry.npmmirror.com/"
```

这样 `bun install` 会明确指向阿里云镜像。你也可以在项目根目录下放一个不带点的 `bunfig.toml` 来覆盖全局配置。

* * *

## 常见问题 FAQ

### Q1：为什么非要装 Node.js？不能直接装 Bun 吗？

**原因**：Bun 官方安装脚本需要从 GitHub Releases 下载二进制，国内访问 GitHub 受限。

**解决**：本文走的是 "Node.js → npm → Bun" 的曲线救国路线。如果你不想装 Node.js，请看文末附录的 **ghproxy 直装方案**（直接从 GitHub 代理下载官方安装脚本）。

### Q2：执行时提示 "无法将 npm 识别为 cmdlet..."？

**原因**：Node.js 安装后 Path 未刷新，当前 PowerShell 会话找不到 npm。

**解决**：
- 方案 A：关闭当前 PowerShell，重新开一个窗口再试。
- 方案 B：运行脚本里的 Path 刷新命令（见分步详解第 3 节）。
- 方案 C：直接用完整路径调用：`C:\Program Files\nodejs\npm.cmd config get registry`

### Q3：执行 `bun` 时提示 "无法加载 bun.ps1，因为在此系统上禁止运行脚本"？

**原因**：Windows 默认 PowerShell 执行策略为 `Restricted`，禁止运行 `.ps1` 脚本。npm 安装时生成了 `bun.ps1` 作为包装器，被系统拦截。

**解决四选一**：

**方案 A（推荐，零副作用）**：删掉 npm 生成的 `bun.ps1`，让 PowerShell fallback 到 `bun.cmd`
```powershell
Remove-Item -Path "$env:APPDATA\npm\bun.ps1" -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\npm\bunx.ps1" -ErrorAction SilentlyContinue
```
PowerShell 找不到 `.ps1` 后，会按 `PATHEXT` 优先级匹配 `.CMD`，而 `.cmd` 不受执行策略限制。不改任何系统策略，一键脚本已内置此步骤。

**方案 B（不改全局策略）**：用 cmd 调用
```powershell
cmd /c bun --version
cmd /c bun install
```

**方案 C（直接调 exe）**：
```powershell
$env:APPDATA\npm\node_modules\bun\bin\bun.exe --version
```

**方案 D（永久放宽策略）**：
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
之后就可以直接使用 `bun` 命令。

### Q4：TUNA 镜像站有 Bun 的镜像吗？

**没有**。TUNA 只提供了 npm registry 镜像（用来加速下载 JS 包），但 **Bun 本身是一个预编译二进制文件**，通过 GitHub Releases 分发，TUNA 没有同步 GitHub Releases 二进制文件。

所以安装 Bun 本体只能通过：
- npm 安装（本文方案）
- 或 GitHub 代理直链下载（附录方案）

### Q5：重启后 npm 或 Bun 找不到了？

**原因**：Path 环境变量在用户级已写入，但部分还原卡/域控环境会在重启后还原注册表。

**解决**：
- 检查 Path 是否包含 `C:\Program Files\nodejs` 和 `%APPDATA%\npm`。
- 若被还原，把一键脚本保存为 `.ps1` 文件，每次开机后右键"使用 PowerShell 运行"一遍（约 30 秒，若已下载过安装包则更快）。

### Q6：如何升级 Bun？

```powershell
npm update -g bun
```

走 npm 升级会自动使用已配置的阿里云镜像。

> **注意**：不要用 `bun upgrade`，这会尝试从 GitHub 官方源下载，国内可能失败或极慢。

### Q7：安装完成后 `bun install` 还是走的官方源？

**原因**：`~/.bunfig.toml` 未生效，或项目目录下有其他配置覆盖。

**解决**：

1. 检查全局配置是否存在：
```powershell
Get-Content "$env:USERPROFILE\.bunfig.toml"
```

2. 检查项目根目录是否有 `bunfig.toml`（不带点），它的优先级高于全局配置。

3. 临时指定源验证：
```powershell
$env:npm_config_registry = "https://registry.npmmirror.com"
bun install
```

### Q8：`bun add -g xxx` 装成功了，但命令找不到？

**原因**：Bun 的全局安装目录和 npm 不一样。npm 放在 `%APPDATA%\npm`，Bun 放在 `%USERPROFILE%\.bun\bin`，后者默认不在系统 PATH 里。

**解决**：把 Bun 的全局目录加入 PATH：
```powershell
$bunGlobalBin = "$env:USERPROFILE\.bun\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$bunGlobalBin", "User")
```

或新开一个 PowerShell 窗口（环境变量刷新后生效），一键脚本已内置此步骤。

* * *

## 附录：无 Node.js 方案（ghproxy 直装）

如果你**不想装 Node.js**，可以直接通过 GitHub 代理安装官方 Bun。内置代理自动 fallback，走不通就换下一个。

```powershell
# 自动 fallback 下载函数
function Get-WithProxy {
    param([string]$Url, [string]$OutFile)
    $proxies = @(
        "https://gh-proxy.org/",
        "https://mirror.ghproxy.com/",
        "https://ghproxy.net/",
        "https://ghp.ci/"
    )
    foreach ($p in $proxies) {
        $proxyUrl = "$p$Url"
        Write-Host "Trying $proxyUrl ..." -ForegroundColor DarkGray
        try {
            Invoke-WebRequest -Uri $proxyUrl -OutFile $OutFile -UseBasicParsing -TimeoutSec 120
            if ((Get-Item $OutFile).Length -gt 1024) {
                Write-Host "Success via $p" -ForegroundColor Green
                return
            }
        } catch { Write-Host "Failed via $p" -ForegroundColor Red }
    }
    Write-Host "Trying direct download..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

# 下载官方安装脚本
$temp = "$env:TEMP\bunsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null
$installPs1 = "$temp\install.ps1"
Get-WithProxy -Url "https://github.com/oven-sh/bun/releases/latest/download/install.ps1" -OutFile $installPs1

# 执行安装（设置 GITHUB 环境变量让脚本走代理下载二进制）
$env:GITHUB = "https://gh-proxy.org/https://github.com"
& $installPs1

# 写入 Bun 国内源配置
$bunfig = @"
[install]
registry = "https://registry.npmmirror.com/"
"@
Set-Content -Path "$env:USERPROFILE\.bunfig.toml" -Value $bunfig -Encoding UTF8
Write-Host ">>> 完成！Bun 已安装且配置了国内源。" -ForegroundColor Green
```

> **代理站优先级**：默认先走 `gh-proxy.org`，失败自动切 `mirror.ghproxy.com` → `ghproxy.net` → `ghp.ci`，全部挂掉才走 GitHub 直连。
>
> 该方案**不依赖 Node.js**，但需要从 GitHub 下载安装脚本和二进制，如果代理站全部失效会安装失败。相比之下，主文的 "Node.js → npm" 方案更稳定可靠。
