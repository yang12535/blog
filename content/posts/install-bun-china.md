---
title: 国内网络环境 Windows 安装 Bun（TUNA + 阿里云）
date: 2026-05-06
tags: [bun, nodejs, windows, mirror, npm, 国内镜像]
---

> 在 Windows 上绕过 GitHub 访问限制，通过清华 TUNA 镜像安装 Node.js，再走阿里云 npm 源安装 Bun，全程无需翻墙。适用于机房、校园网、企业内网等受限环境。
>
> 复制脚本 → 粘贴 → 回车，获得一个带国内镜像加速的 Bun 运行时。

* * *

## 更新日志

- **2026-05-06** 增强健壮性，全面适配 Windows PowerShell 5.1：
  - 修复 `Restricted` 执行策略下 `npm.ps1` 被拦截的问题，全程显式调用 `npm.cmd`
  - 增加 Node.js MSI 下载大小校验与 `msiexec` 退出码检查
  - 扩充 Node.js / npm 路径回退，新增 `NVM_SYMLINK`、`NVM_HOME`、`Program Files (x86)` 等扫描目录
  - 增加 `bun.exe` 多级定位（常规路径 → `LOCALAPPDATA` → 递归搜索）
  - 扩大 `bun.ps1` / `bunx.ps1` wrapper 清理范围至 `LOCALAPPDATA`
  - 安装完成后即时追加 PATH 并执行 `bun --version` 验证

* * *

## 环境信息

| 项目 | 说明 |
| --- | --- |
| **系统** | Windows 10 / Windows 11（64 位） |
| **Shell** | Windows PowerShell 5.1（默认自带，无需额外安装） |
| **权限** | 需要管理员权限（Node.js MSI 安装到 `C:\Program Files`，修改系统 PATH） |
| **场景** | 校园网、机房、企业内网、无代理环境 |
| **目标** | Bun 1.x 可运行，且后续 `bun install` 走国内源 |
| **网络** | 无法稳定访问 GitHub，但可访问国内镜像站 |

* * *

## 一键脚本（复制即用）

**右键点击 PowerShell 图标 → "以管理员身份运行"**，然后复制粘贴以下脚本：

```powershell
#Requires -Version 5.1

# ==================== 0. 初始化 ====================
$temp = "$env:TEMP\bunsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Write-Info($msg)  { Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host ">>> $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host ">>> $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host ">>> $msg" -ForegroundColor Red }

function Refresh-EnvPath {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + `
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ==================== 1. 检测 / 安装 Node.js ====================
# 关键：显式查找 .cmd，避免 PowerShell 优先匹配到被策略拦截的 npm.ps1
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$npm  = Get-Command npm.cmd  -ErrorAction SilentlyContinue

if (-not $node -or -not $npm) {
    Write-Info "未检测到 Node.js，开始从清华 TUNA 镜像下载..."

    $nodeVer = "v22.14.0"
    $msiName = "node-$nodeVer-x64.msi"
    $nodeUrl = "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/$nodeVer/$msiName"
    $nodeOut = Join-Path $temp $msiName

    if (-not (Test-Path $nodeOut)) {
        Write-Info "下载 $msiName 中，请稍候..."
        try {
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeOut -UseBasicParsing -TimeoutSec 300
            if ((Get-Item $nodeOut).Length -lt 10MB) {
                throw "下载文件异常过小，可能已被拦截或损坏。"
            }
        } catch {
            Write-Fail "下载失败: $_"
            exit 1
        }
    }

    Write-Info "正在静默安装 Node.js（可能需要 1-2 分钟）..."
    $proc = Start-Process -FilePath "msiexec.exe" `
             -ArgumentList "/i `"$nodeOut`" /qn /norestart" `
             -Wait -PassThru

    if ($proc.ExitCode -ne 0) {
        Write-Fail "Node.js 安装失败，msiexec 退出码: $($proc.ExitCode)"
        exit 1
    }

    # 刷新当前会话的 PATH
    Refresh-EnvPath

    # 重新定位 npm.cmd
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
}

# 兜底：如果注册表刷新后仍找不到，扫描常见路径
if (-not $npm) {
    $fallbackPaths = @(
        "C:\Program Files\nodejs"
        "C:\Program Files (x86)\nodejs"
        "C:\nodejs"
        "$env:NVM_SYMLINK"
        "$env:NVM_HOME"
        "C:\nvm4w\nodejs"
    ) | Where-Object { $_ }

    foreach ($p in $fallbackPaths) {
        $cmdPath = Join-Path $p "npm.cmd"
        if (Test-Path $cmdPath) {
            $env:Path += ";$p"
            $npm = Get-Command $cmdPath
            break
        }
    }
}

if (-not $npm) {
    Write-Fail "未能定位 npm.cmd。请确认 Node.js 已正确安装，或手动将其目录加入 PATH。"
    exit 1
}

$nodeVerStr = & node.exe --version 2>$null
$npmVerStr  = & $npm.Source --version 2>$null
Write-Ok "环境就绪: Node.js $nodeVerStr | npm $npmVerStr"

# ==================== 2. 配置 npm 国内源 ====================
Write-Info "配置 npm 使用阿里云镜像..."
& $npm.Source config set registry https://registry.npmmirror.com/ 2>$null
if (-not $?) { Write-Warn "npm 源配置命令返回异常，继续执行..." }

# ==================== 3. 通过 npm 安装 Bun ====================
Write-Info "正在通过 npm 全局安装 Bun..."
& $npm.Source install -g bun 2>$null
if (-not $?) {
    Write-Fail "npm 安装 bun 失败，请检查网络或 npm 日志。"
    exit 1
}

# ==================== 4. 定位 bun.exe ====================
Refresh-EnvPath
$env:Path += ";$env:APPDATA\npm"

$bunCandidates = @(
    "$env:APPDATA\npm\node_modules\bun\bin\bun.exe"
    "$env:LOCALAPPDATA\npm\node_modules\bun\bin\bun.exe"
    "$env:USERPROFILE\.bun\bin\bun.exe"
)

$bunExe = $null
foreach ($c in $bunCandidates) {
    if (Test-Path $c) {
        $bunExe = $c
        break
    }
}

# 终极兜底：在常见父目录递归搜索（限制深度，避免过慢）
if (-not $bunExe) {
    Write-Warn "常规路径未找到 bun.exe，执行搜索..."
    $found = Get-ChildItem -Path @(
        "$env:APPDATA\npm"
        "$env:LOCALAPPDATA\npm"
        "$env:USERPROFILE\.bun"
    ) -Filter "bun.exe" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($found) { $bunExe = $found.FullName }
}

if ($bunExe) {
    $bunVer = & $bunExe --version 2>$null
    Write-Ok "Bun 安装完成: $bunVer"
} else {
    Write-Warn "未找到 bun.exe，但 npm 安装未报错。请尝试重新打开 PowerShell 窗口后再运行一次。"
}

# ==================== 5. 清理 .ps1 wrapper（关键：避免 PowerShell 执行策略拦截） ====================
$wrappers = @(
    "$env:APPDATA\npm\bun.ps1"
    "$env:APPDATA\npm\bunx.ps1"
    "$env:LOCALAPPDATA\npm\bun.ps1"
    "$env:LOCALAPPDATA\npm\bunx.ps1"
)
foreach ($w in $wrappers) {
    if (Test-Path $w) {
        Remove-Item -Path $w -Force -ErrorAction SilentlyContinue
    }
}
Write-Ok "已清理 bun.ps1 wrapper，PowerShell 将回退到 bun.cmd"

# ==================== 6. 写入 Bun 国内源配置 ====================
$bunfig = @"
[install]
registry = "https://registry.npmmirror.com/"
"@
Set-Content -Path "$env:USERPROFILE\.bunfig.toml" -Value $bunfig -Encoding UTF8 -Force
Write-Ok "已写入 ~/.bunfig.toml，bun install 将默认走阿里云镜像"

# ==================== 7. 将 Bun 加入用户 PATH ====================
$bunGlobalBin = "$env:USERPROFILE\.bun\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$bunGlobalBin*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$bunGlobalBin", "User")
    Write-Ok "已将 Bun 目录加入用户 PATH: $bunGlobalBin"
}

# ==================== 8. 最终验证 ====================
Write-Info "执行最终验证..."
if ($bunExe) {
    $bunDir = Split-Path $bunExe -Parent
    if ($env:Path -notlike "*$bunDir*") { $env:Path += ";$bunDir" }
}

$bunCmd = Get-Command bun.cmd -ErrorAction SilentlyContinue
if ($bunCmd -or $bunExe) {
    $ver = if ($bunCmd) { & bun.cmd --version } else { & $bunExe --version }
    Write-Ok "全部完成！Bun $ver 已就绪。"
    Write-Host "`n提示：请重新打开 PowerShell 窗口，以确保 PATH 完全生效。" -ForegroundColor Green
} else {
    Write-Warn "安装可能已完成，但当前会话无法调用 bun。请重新打开 PowerShell 窗口后再试。"
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

### 2. 静默安装 Node.js 并校验结果

```powershell
# 错误：msiexec 默认异步返回，脚本会继续执行但安装还没完成
msiexec /i "node-v22.14.0-x64.msi" /qn /norestart
Start-Sleep -Seconds 15   # 瞎等 15 秒，不靠谱

# 正确：用 Start-Process -Wait 阻塞到安装真正结束，并检查退出码
$proc = Start-Process -FilePath "msiexec" -ArgumentList "/i `"...`" /qn /norestart" -Wait -PassThru
if ($proc.ExitCode -ne 0) { throw "安装失败" }
```

| 参数 | 含义 |
| --- | --- |
| `/i` | 安装模式 |
| `/qn` | 静默安装，无弹窗 |
| `/norestart` | 禁止自动重启 |

**坑点**：`msiexec` 在 PowerShell 里直接调用会**立即返回**（后台异步），导致后面找 `npm` 时文件还没释放。必须用 `Start-Process -Wait` 等待安装完成，并用 `-PassThru` 获取退出码来判断是否真正成功。

安装后本体通常位于 `C:\Program Files\nodejs\`，但如果你装了 **nvm-windows**，实际路径可能是 `C:\nvm4w\nodejs` 或 `C:\nodejs`，脚本里通过 `Get-Command` + 兜底路径自动检测，不再硬编码。

### 3. 刷新环境变量

Node.js 安装程序会修改系统 PATH，但**当前已打开的 PowerShell 窗口不会自动感知**。脚本里通过读取注册表重新拼接 Path 来解决：

```powershell
function Refresh-EnvPath {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + `
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}
```

如果刷新后仍找不到 npm（比如你之前装了 nvm-windows 或其他版本），脚本还会自动检测以下兜底路径：
- `C:\Program Files\nodejs`
- `C:\Program Files (x86)\nodejs`
- `C:\nodejs`
- `$env:NVM_SYMLINK`
- `$env:NVM_HOME`
- `C:\nvm4w\nodejs`

> **坑点：装完 node 后当前窗口仍提示找不到 npm**
>
> 如果不刷新 Path，你会看到 `npm : 无法将 npm 识别为 cmdlet...`。新开一个 PowerShell 窗口也能解决，但脚本里直接刷新更方便。

### 4. 用 `npm.cmd` 绕过执行策略（Windows PowerShell 5.1 关键适配）

Windows PowerShell 5.1 默认执行策略为 `Restricted`，会禁止运行任何 `.ps1` 脚本。npm 安装时会同时生成 `npm.cmd` 和 `npm.ps1`，而 `Get-Command npm` 在 PS 5.1 中**优先匹配到 `npm.ps1`**，导致后续调用被系统拦截：

```powershell
# 错误：在 Restricted 策略下会报错 "无法加载 npm.ps1"
$npm = Get-Command npm
& $npm.Source config set registry ...   # ❌ 失败

# 正确：显式指定 .cmd，彻底绕过执行策略限制
$npm = Get-Command npm.cmd
& $npm.Source config set registry ...   # ✅ 成功
```

脚本中**所有 npm 调用均通过 `npm.cmd` 完成**，无需用户修改系统执行策略，零副作用。

### 5. npm 切到阿里云镜像

npm 官方源 `https://registry.npmjs.org/` 在国内访问缓慢且经常丢包。阿里云镜像（原淘宝 npm 域名）是目前最稳的国内源：

```powershell
npm.cmd config set registry https://registry.npmmirror.com/
```

> **坑点：淘宝源旧域名已废弃**
>
> 以前常用的 `https://registry.npm.taobao.org/` 虽然还能跳转，但官方已迁移到 `https://registry.npmmirror.com/`。建议直接写新域名，避免未来 301 失效。

### 6. 通过 npm 安装 Bun

```powershell
npm.cmd install -g bun
```

npm 全局安装时，会把 Bun 的二进制文件下载到 `%APPDATA%\npm\node_modules\bun\bin\bun.exe`。整个流程走的都是阿里云镜像，无需访问 GitHub。

### 7. 定位 bun.exe 的多级回退

不同版本的 npm 或不同安装方式，bun.exe 的实际落盘位置可能不同。脚本内置了三级查找：

1. **常规路径**：`%APPDATA%\npm\node_modules\bun\bin\bun.exe`
2. **备用路径**：`%LOCALAPPDATA%\npm\...` 和 `%USERPROFILE%\.bun\bin\bun.exe`
3. **递归搜索**：在以上父目录下递归搜索（限制深度 3 层，避免过慢）

### 8. 清理 `.ps1` wrapper（关键！）

npm 全局安装包时，会为每个命令生成 `.cmd` 和 `.ps1` 两个 wrapper。在 PS 5.1 默认策略下，`.ps1` 会被拦截，但 PowerShell 又优先解析 `.ps1`，导致用户直接输入 `bun` 时报错。

脚本在安装完成后主动删除：

```powershell
Remove-Item -Path "$env:APPDATA\npm\bun.ps1"  -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\npm\bunx.ps1" -ErrorAction SilentlyContinue
```

删除后，PowerShell 会按 `PATHEXT` 优先级回退到 `.cmd`，而 `.cmd` 不受执行策略限制。

### 9. Bun 国内源配置

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

### Q2：我已有 Node.js（或 nvm-windows），脚本会重复安装吗？

**不会**。脚本开头用 `Get-Command node.exe` 和 `Get-Command npm.cmd` 检测当前环境，如果已经能找到 `npm.cmd`，就会**跳过 Node.js 下载和安装**，直接走后续配置和装 Bun 的步骤。

> 如果你通过 **nvm-windows** 管理 Node.js，npm 路径可能在 `C:\nvm4w\nodejs` 或 `C:\nodejs`。脚本在检测不到 npm 时会自动扫描这些常见路径，确保能正确调用。

### Q3：执行时提示 "无法将 npm 识别为 cmdlet..."？

**原因**：Node.js 安装后 Path 未刷新，当前 PowerShell 会话找不到 npm。

**解决**：
- 方案 A：关闭当前 PowerShell，重新开一个窗口再试。
- 方案 B：运行脚本里的 Path 刷新命令（见分步详解第 3 节）。
- 方案 C：直接用完整路径调用：先确认你的 npm 实际在哪，例如 `C:\nvm4w\nodejs\npm.cmd config get registry`

### Q4：执行 `bun` 时提示 "无法加载 bun.ps1，因为在此系统上禁止运行脚本"？

**原因**：Windows PowerShell 5.1 默认执行策略为 `Restricted`，禁止运行 `.ps1` 脚本。npm 安装时生成了 `bun.ps1` 作为包装器，被系统拦截。

**解决**：

本文脚本已内置**双重防护**：
1. 安装完成后自动删除 `bun.ps1` / `bunx.ps1` wrapper
2. 验证阶段显式查找 `bun.cmd`

正常情况下你不会遇到此问题。如果你是在**脚本之外**手动遇到了这个报错，四选一解决：

**方案 A（推荐，零副作用）**：删掉 npm 生成的 `bun.ps1`，让 PowerShell fallback 到 `bun.cmd`
```powershell
Remove-Item -Path "$env:APPDATA\npm\bun.ps1" -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\npm\bunx.ps1" -ErrorAction SilentlyContinue
```

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

### Q5：TUNA 镜像站有 Bun 的镜像吗？

**没有**。TUNA 只提供了 npm registry 镜像（用来加速下载 JS 包），但 **Bun 本身是一个预编译二进制文件**，通过 GitHub Releases 分发，TUNA 没有同步 GitHub Releases 二进制文件。

所以安装 Bun 本体只能通过：
- npm 安装（本文方案）
- 或 GitHub 代理直链下载（附录方案）

### Q6：重启后 npm 或 Bun 找不到了？

**原因**：Path 环境变量在用户级已写入，但部分还原卡/域控环境会在重启后还原注册表。

**解决**：
- 检查 Path 是否包含 `C:\Program Files\nodejs` 和 `%APPDATA%\npm`。
- 若被还原，把一键脚本保存为 `.ps1` 文件，每次开机后右键"使用 PowerShell 运行"一遍（约 30 秒，若已下载过安装包则更快）。

### Q7：如何升级 Bun？

```powershell
npm.cmd update -g bun
```

走 npm 升级会自动使用已配置的阿里云镜像。

> **注意**：不要用 `bun upgrade`，这会尝试从 GitHub 官方源下载，国内可能失败或极慢。

### Q8：安装完成后 `bun install` 还是走的官方源？

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

### Q9：`bun add -g xxx` 装成功了，但命令找不到？

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
