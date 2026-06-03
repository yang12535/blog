---
title: 还原机房一条龙：PS7 + Git + Node.js + npm + Bun + Kimi Code 极速装机
date: 2026-06-03
tags: [windows, 还原机房, powershell, git, nodejs, npm, bun, kimi-code, 一条龙]
---

> 本文整合了一套完整的还原机房装机流程（PS7 + Git + Node.js + npm + Bun + Kimi Code），建议作为首选方案。
>
> 以下旧文仍可独立参考：
> - [~~Windows 一键安装 Kimi CLI~~](/posts/kimi-cli-install-win/)（`kimi-cli` 官方已迁移为 `kimi-code`，仍可用但不再维护）
> - [国内网络环境 Windows 安装 Bun](/posts/install-bun-china/)
> - [还原机房 PowerShell 7 + Windows Terminal 极速配置](/posts/win-terminal-setup/)
>
> 本文的 **统一 PATH 管理方案** 相比旧文更可靠，推荐直接使用本文脚本。

---

## 环境信息

| 项目 | 说明 |
|------|------|
| **系统** | Windows 10 / Windows 11（64 位） |
| **权限** | 管理员（用于安装 PS7 / Git / Node.js MSI） |
| **场景** | 学校/培训机构机房，OS-Easy 还原卡，重启还原 |
| **网络** | 国内校园网/机房，GitHub 直连不稳定 |
| **目标** | 一条脚本完成全套 JS 开发环境 + AI 编程助手，重启后只需重新运行一次 |

---

## 核心理念：统一 PATH 管理

还原机房最大的坑不是安装，而是 **PATH 丢失**。

| 问题 | 原因 |
|------|------|
| `npm install -g xxx` 后命令找不到 | MSI 安装程序写入注册表的 PATH，被还原卡还原 |
| `bun` 命令时有时无 | 同上一致 |
| `git` 在新终端找不到 | 安装程序改的系统 PATH，重启后失效 |

**本文的解决方案**：不依赖任何安装程序自动添加 PATH。在脚本中定义一个 **统一 PATH 管理函数**，所有组件安装完成后，由脚本**显式**把需要的目录同时写入：
1. 当前 PowerShell 会话（`$env:Path`）—— 立即生效
2. 用户注册表（`User` 作用域）—— 尽量持久化

这样即使还原卡把注册表还原了，至少当前会话不会出问题。把脚本保存到 D 盘或 U 盘，每次开机右键运行一次（约 1~2 分钟，已下载过的包会跳过），即可恢复完整环境。

---

## 一键脚本（管理员 PowerShell）

**右键点击 PowerShell 图标 → "以管理员身份运行"**，复制粘贴执行：

```powershell
# ==================== 0. 初始化 ====================
$ErrorActionPreference = "Stop"
$temp = "$env:TEMP\restore-workflow"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Write-Info($msg)  { Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host ">>> $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host ">>> $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host ">>> $msg" -ForegroundColor Red }

# --- 统一 PATH 管理函数 ---
# 所有组件安装完毕后统一调用一次，不依赖安装程序自动添加 PATH
function Add-ToPath {
    param([string]$Dir)
    # 标准化路径（去掉尾部反斜杠，统一大小写）用于精确比较
    $normDir = $Dir.TrimEnd('\').ToLower()
    # 当前会话：按 ; 拆分后精确匹配
    $sessionPaths = $env:Path -split ';' | ForEach-Object { $_.TrimEnd('\').ToLower() }
    if ($normDir -notin $sessionPaths) {
        $env:Path = "$Dir;$env:Path"
    }
    # 用户注册表
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath) {
        $userPaths = $userPath -split ';' | ForEach-Object { $_.TrimEnd('\').ToLower() }
        if ($normDir -notin $userPaths) {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$Dir", "User")
        }
    } else {
        # 用户 PATH 为空时直接写入，避免前导分号
        [Environment]::SetEnvironmentVariable("Path", $Dir, "User")
    }
}

# --- 代理下载函数（自动 fallback）---
# 通过文件头魔数校验避免代理返回 HTML 错误页/ captive portal 被误判为成功
function Get-WithProxy {
    param([string]$Url, [string]$OutFile)
    $oldProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try {
        $proxies = @(
            "https://v4.gh-proxy.org/"
            "https://gh-proxy.org/"
            "https://mirror.ghproxy.com/"
            "https://ghproxy.net/"
            "https://ghp.ci/"
        )
        foreach ($p in $proxies) {
            $proxyUrl = "$p$Url"
            Write-Host "Trying $proxyUrl ..." -ForegroundColor DarkGray
            try {
                Invoke-WebRequest -Uri $proxyUrl -OutFile $OutFile -UseBasicParsing -TimeoutSec 120 -ErrorAction Stop
                # 校验文件头魔数，避免代理返回 HTML 错误页/空文件
                $bytes = [System.IO.File]::ReadAllBytes($OutFile)
                if ($bytes.Length -lt 2) {
                    Write-Warn "下载文件为空（可能代理返回了空响应），继续尝试..."
                    continue
                }
                if (($bytes[0] -eq 0xD0 -and $bytes[1] -eq 0xCF) -or   # MSI (OLE)
                    ($bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) -or   # EXE (MZ)
                    ($bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B)) {    # ZIP (PK)
                    Write-Host "Success via $p" -ForegroundColor Green
                    return
                }
                Write-Warn "下载内容非安装包（文件头不匹配），继续尝试其他代理..."
            } catch { Write-Host "Failed via $p : $($_.Exception.Message)" -ForegroundColor Red }
        }
        Write-Host "Trying direct download..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 300 -ErrorAction Stop
    } finally {
        $ProgressPreference = $oldProgress
    }
}

# 检测管理员权限
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "请以管理员身份运行 PowerShell（右键 → 以管理员身份运行），否则 MSI/EXE 安装会失败。"
}

# ==================== 1. PowerShell 7 ====================
$ps7Dir = "C:\Program Files\PowerShell\7"
$ps7Exe = "$ps7Dir\pwsh.exe"
if (-not (Test-Path $ps7Exe)) {
    Write-Info "下载并安装 PowerShell 7.4..."
    $ps7Ver = "7.4.6"
    $ps7Url = "https://github.com/PowerShell/PowerShell/releases/download/v$ps7Ver/PowerShell-$ps7Ver-win-x64.msi"
    $ps7Out = "$temp\PowerShell-$ps7Ver-win-x64.msi"
    if (Test-Path $ps7Out) { Remove-Item $ps7Out -Force }
    Get-WithProxy -Url $ps7Url -OutFile $ps7Out
    $ps7Hash = "ed331a04679b83d4c013705282d1f3f8d8300485eb04c081f36e11eaf1148bd0"
    if ((Get-FileHash $ps7Out -Algorithm SHA256).Hash -ne $ps7Hash) {
        throw "PowerShell $ps7Ver SHA256 校验失败"
    }
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$ps7Out`"", "/qn", "ADD_EXPLORER_CONTEXT_MENU=1", "REBOOT=ReallySuppress" -Wait -PassThru
    if ($proc.ExitCode -notin @(0, 3010)) {
        throw "PowerShell 安装失败，退出码: $($proc.ExitCode)"
    }
    Write-Ok "PowerShell 7.4 安装完成"
} else {
    Write-Ok "PowerShell 7 已存在，跳过安装"
}

# ==================== 2. Git ====================
$gitDir = "C:\Program Files\Git\cmd"
$gitExe = "$gitDir\git.exe"
if (-not (Test-Path $gitExe)) {
    Write-Info "下载并安装 Git 2.54..."
    $gitVer = "2.54.0"
    $gitUrl = "https://github.com/git-for-windows/git/releases/download/v$gitVer.windows.1/Git-$gitVer-64-bit.exe"
    $gitOut = "$temp\Git-$gitVer-64-bit.exe"
    if (Test-Path $gitOut) { Remove-Item $gitOut -Force }
    Get-WithProxy -Url $gitUrl -OutFile $gitOut
    # Git 安装包 SHA256 校验
    $gitHash = "2b96e7854f0520f0f6b709c21041d9801b1be44d5e1a0d9fa621b2fbc40f1983"
    if ((Get-FileHash $gitOut -Algorithm SHA256).Hash -ne $gitHash) {
        throw "Git $gitVer SHA256 校验失败"
    }
    $proc = Start-Process -FilePath $gitOut -ArgumentList "/VERYSILENT", "/NORESTART", "/NOCANCEL", "/SP-", "/CLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS", "/COMPONENTS=icons,ext\reg\shellhere,assoc,assoc_sh" -Wait -PassThru
    if ($proc.ExitCode -ne 0) {
        throw "Git 安装失败，退出码: $($proc.ExitCode)"
    }
    Write-Ok "Git $gitVer 安装完成"
} else {
    Write-Ok "Git 已存在，跳过安装"
}

# ==================== 3. Node.js（清华 TUNA 镜像）====================
$nodeDir = "C:\Program Files\nodejs"
$nodeExe = "$nodeDir\node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Info "从清华 TUNA 镜像下载并安装 Node.js..."
    $nodeVer = "v22.16.0"
    $msiName = "node-$nodeVer-x64.msi"
    $nodeUrl = "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/$nodeVer/$msiName"
    $nodeOut = "$temp\$msiName"
    if (Test-Path $nodeOut) { Remove-Item $nodeOut -Force }
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeOut -UseBasicParsing -TimeoutSec 300
    $nodeHash = "e2f2802202513e1bf41f7c00307635f6c6fe31c0275c1e03d269d45a76e5fc2e"
    if ((Get-FileHash $nodeOut -Algorithm SHA256).Hash -ne $nodeHash) {
        throw "Node.js MSI SHA256 校验失败"
    }
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$nodeOut`"", "/qn", "/norestart" -Wait -PassThru
    if ($proc.ExitCode -notin @(0, 3010)) {
        throw "Node.js 安装失败，退出码: $($proc.ExitCode)"
    }
    Write-Ok "Node.js $nodeVer 安装完成"
} else {
    Write-Ok "Node.js 已存在，跳过安装"
}

# 显式定位 npm.cmd（绕过 PS5.1 Restricted 执行策略）
$npmCmd = Get-Command "$nodeDir\npm.cmd" -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    # 兜底：在 PATH 中搜索
    $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
}
if (-not $npmCmd) {
    throw "npm.cmd 定位失败。请确认 Node.js 已正确安装。"
}
Write-Ok "npm 定位成功: $($npmCmd.Source)"

# ==================== 4. npm 国内镜像 + 清理 ps1 wrapper ====================
Write-Info "配置 npm 使用 npmmirror（阿里云）..."
& $npmCmd.Source config set registry https://registry.npmmirror.com/ 2>$null
Write-Ok "npm registry 已设置为 https://registry.npmmirror.com/"

# 删除 npm/bun 的 ps1 wrapper，防止 PS5.1 Restricted 策略拦截
# 注意：Node.js MSI 也会在 $nodeDir 生成 npm.ps1/npx.ps1，需一并清理
$wrappers = @(
    "$env:APPDATA\npm\npm.ps1"
    "$env:APPDATA\npm\npx.ps1"
    "$env:LOCALAPPDATA\npm\npm.ps1"
    "$env:LOCALAPPDATA\npm\npx.ps1"
    "$nodeDir\npm.ps1"
    "$nodeDir\npx.ps1"
)
foreach ($w in $wrappers) {
    if (Test-Path $w) {
        Remove-Item -Path $w -Force -ErrorAction SilentlyContinue
        Write-Warn "已清理 wrapper: $w"
    }
}

# ==================== 5. Bun（通过 npm 安装）====================
$bunExe = "$env:APPDATA\npm\node_modules\bun\bin\bun.exe"
if (-not (Test-Path $bunExe)) {
    Write-Info "通过 npm 全局安装 Bun..."
    & $npmCmd.Source install -g bun
    if (-not $?) {
        throw "npm 安装 bun 失败"
    }
    Write-Ok "Bun 安装完成"
} else {
    Write-Ok "Bun 已存在，跳过安装"
}

# 写入 Bun 国内源配置
$bunfig = @'
[install]
registry = "https://registry.npmmirror.com/"
'@
$bunfigPath = "$env:USERPROFILE\.bunfig.toml"
[System.IO.File]::WriteAllText($bunfigPath, $bunfig, [System.Text.UTF8Encoding]::new($false))
Write-Ok "已写入 ~/.bunfig.toml"

# 清理 bun.ps1 / bunx.ps1 wrapper
$bunWrappers = @(
    "$env:APPDATA\npm\bun.ps1"
    "$env:APPDATA\npm\bunx.ps1"
    "$env:LOCALAPPDATA\npm\bun.ps1"
    "$env:LOCALAPPDATA\npm\bunx.ps1"
)
foreach ($w in $bunWrappers) {
    if (Test-Path $w) { Remove-Item -Path $w -Force -ErrorAction SilentlyContinue }
}

# ==================== 6. Kimi Code（新版，替代 kimi-cli）====================
# 包名：@moonshot-ai/kimi-code
# 安装方式：通过 Bun 全局安装（bun add -g）
# 可执行文件：~/.bun/bin/kimi.exe
$kimiExe = "$env:USERPROFILE\.bun\bin\kimi.exe"
if (-not (Test-Path $kimiExe)) {
    Write-Info "安装 Kimi Code（@moonshot-ai/kimi-code）..."
    # Bun 本身通过 npm 全局安装，其 bun.cmd 位于 %APPDATA%\npm，该目录已在 PATH 中
    # 若 bun 命令在当前会话不可用，直接使用 bun.exe 的已知路径
    $bunCmd = Get-Command "bun" -ErrorAction SilentlyContinue
    if (-not $bunCmd -and (Test-Path "$env:APPDATA\npm\bun.cmd")) {
        $bunCmd = Get-Command "$env:APPDATA\npm\bun.cmd" -ErrorAction SilentlyContinue
    }
    if (-not $bunCmd) {
        throw "bun 命令不可用，无法安装 Kimi Code。请确认第 5 步 Bun 安装已成功。"
    }
    & $bunCmd.Source add -g @moonshot-ai/kimi-code
    if (-not $?) {
        throw "bun 安装 @moonshot-ai/kimi-code 失败"
    }
    Write-Ok "Kimi Code 安装完成"
} else {
    Write-Ok "Kimi Code 已存在，跳过安装"
}

# ==================== 7. 统一 PATH 管理（核心！）====================
Write-Info "执行统一 PATH 管理..."

# 定义所有需要加入 PATH 的目录（按优先级排序）
$pathList = @(
    $ps7Dir                              # PowerShell 7
    $nodeDir                             # Node.js
    "$env:APPDATA\npm"                   # npm 全局包（关键！MSI 安装不可靠，脚本显式补）
    "$env:USERPROFILE\.bun\bin"          # Bun 全局包（含 kimi 等 bun 全局工具）
    $gitDir                              # Git
)

# 反向遍历以保持前插优先级（Add-ToPath 前插，先遍历的会被后遍历的推到后面）
[array]::Reverse($pathList)
foreach ($dir in $pathList) {
    if (Test-Path $dir) {
        Add-ToPath -Dir $dir
    } else {
        Write-Warn "PATH 目录不存在，跳过: $dir"
    }
}

Write-Ok "PATH 统一配置完成"

# ==================== 8. 最终验证 ====================
Write-Info "执行最终验证..."

# PS5.1 兼容性注意：
# 1. pwsh -Command 用单引号，防止外层 PS5.1 提前解析 $PSVersionTable
# 2. 命令输出先做 $null 检查，再调用 .Split() 或 .ToString()，避免 PS5.1 抛异常
$ps7Out   = & "$ps7Dir\pwsh.exe" -Command '$PSVersionTable.PSVersion.ToString()' 2>$null
$verPs7   = if ($ps7Out) { $ps7Out.ToString().Trim() } else { "FAIL" }

$gitOut   = & "$gitDir\git.exe" --version 2>$null
$verGit   = if ($gitOut) { $gitOut.Split()[2] } else { "FAIL" }

$verNode  = & "$nodeDir\node.exe" --version 2>$null
if (-not $verNode) { $verNode = "FAIL" }

$verNpm   = & "$nodeDir\npm.cmd" --version 2>$null
if (-not $verNpm) { $verNpm = "FAIL" }

# Bun 本体通过 npm 全局安装，实际路径在 %APPDATA%\npm\node_modules\bun\bin\bun.exe
# .bun\bin 下只有 bun 全局安装的链接（如 kimi.exe），不含 bun.exe 本体
$bunCmd = Get-Command "bun" -ErrorAction SilentlyContinue
if (-not $bunCmd -and (Test-Path "$env:APPDATA\npm\node_modules\bun\bin\bun.exe")) {
    $bunCmd = Get-Command "$env:APPDATA\npm\node_modules\bun\bin\bun.exe" -ErrorAction SilentlyContinue
}
if ($bunCmd) {
    $verBun = & $bunCmd.Source --version 2>$null
    if (-not $verBun) { $verBun = "FAIL" }
} else {
    $verBun = "FAIL"
}

$kimiCmd  = Get-Command "$env:USERPROFILE\.bun\bin\kimi.exe" -ErrorAction SilentlyContinue
if ($kimiCmd) {
    $kimiOut = & $kimiCmd.Source --version 2>$null
    $verKimi = if ($kimiOut) { $kimiOut.ToString() } else { "FAIL" }
} else {
    $verKimi = "未找到"
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         还原机房环境验证报告              ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║ PowerShell 7 : $verPs7" -ForegroundColor Green
Write-Host "║ Git          : $verGit" -ForegroundColor Green
Write-Host "║ Node.js      : $verNode" -ForegroundColor Green
Write-Host "║ npm          : $verNpm" -ForegroundColor Green
Write-Host "║ Bun          : $verBun" -ForegroundColor Green
Write-Host "║ Kimi Code    : $verKimi" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Ok "全部完成！请重新打开 PowerShell 7 窗口以确保环境完全生效。"
Write-Warn "还原卡环境：重启后需重新运行本脚本。建议保存到 D 盘或 U 盘。"
```

> **提示**：脚本运行期间请不要关闭窗口。首次运行约 1~2 分钟（需要下载安装包），后续运行约 30 秒（已安装的组件会自动跳过）。

---

## 分步详解

### 1. 为什么必须管理员？

PowerShell 7 和 Node.js 使用 MSI 安装程序，默认安装到 `C:\Program Files\`，需要管理员权限。Git 的 `/VERYSILENT` 安装同样需要管理员。

如果机房环境**完全无法获得管理员权限**，则需要改用：
- Node.js 便携版（zip 解压到用户目录）
- Git 便携版（PortableGit）
- PowerShell 7 也有 zip 版

但本文假设可以右键"以管理员身份运行"PowerShell，这是机房最常见的场景。

### 2. 代理下载自动 fallback

```powershell
$proxies = @(
    "https://v4.gh-proxy.org/"
    "https://gh-proxy.org/"
    "https://mirror.ghproxy.com/"
    "https://ghproxy.net/"
    "https://ghp.ci/"
)
```

GitHub Release 文件下载会依次尝试以上代理站，全部失败后才走直连。`v4.gh-proxy.org` 目前最稳定（支持文件流完整传输），排第一位。

### 3. Node.js 从清华 TUNA 镜像下载

```
https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v22.16.0/node-v22.16.0-x64.msi
```

TUNA 同步了完整的 Node.js 发布目录，国内下载速度通常在 5~20MB/s。如需其他版本，直接去镜像站目录里挑对应 MSI 改 URL 即可。

### 4. npm 国内镜像：npmmirror

```powershell
npm.cmd config set registry https://registry.npmmirror.com/
```

阿里云 `npmmirror` 是原淘宝 npm 镜像的新域名，同步频率高、带宽大。**不要使用旧域名 `registry.npm.taobao.org`**，虽然会 301 跳转，但未来可能失效。

### 5. 关键：统一 PATH 管理函数

这是本文与旧文最大的区别。

```powershell
function Add-ToPath {
    param([string]$Dir)
    $normDir = $Dir.TrimEnd('\').ToLower()
    # 当前会话：按 ; 拆分后精确匹配
    $sessionPaths = $env:Path -split ';' | ForEach-Object { $_.TrimEnd('\').ToLower() }
    if ($normDir -notin $sessionPaths) {
        $env:Path = "$Dir;$env:Path"
    }
    # 用户注册表
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath) {
        $userPaths = $userPath -split ';' | ForEach-Object { $_.TrimEnd('\').ToLower() }
        if ($normDir -notin $userPaths) {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$Dir", "User")
        }
    } else {
        [Environment]::SetEnvironmentVariable("Path", $Dir, "User")
    }
}
```

**为什么必须这样做？**

| 组件 | MSI/安装程序的行为 | 还原机房的问题 |
|------|-------------------|---------------|
| Node.js | 把 `C:\Program Files\nodejs` 加入系统 PATH | 注册表还原后丢失 |
| npm 全局包 | 把 `%APPDATA%\npm` 加入用户 PATH | 注册表还原后丢失 |
| Git | 把 `C:\Program Files\Git\cmd` 加入系统 PATH | 注册表还原后丢失 |
| Bun | 安装脚本把 `.bun\bin` 加入用户 PATH | 注册表还原后丢失 |

安装程序写入的是**注册表**，而还原卡保护的是**磁盘**+**注册表**。所以依赖安装程序自动添加 PATH 是不可靠的。

本文的方案是：不管安装程序有没有成功添加 PATH，脚本最后统一调用 `Add-ToPath`，**双保险**确保所有目录同时生效于当前会话和用户注册表。

### 6. 清理 `.ps1` wrapper（Windows PowerShell 5.1 适配）

Windows 自带的 PowerShell 5.1 默认执行策略为 `Restricted`，会禁止运行 `.ps1` 脚本。npm 全局安装时会同时生成 `.cmd` 和 `.ps1` 两个 wrapper，而 PowerShell 又**优先解析 `.ps1`**，导致输入 `npm` 或 `bun` 时报错：

```
无法加载 xxx.ps1，因为在此系统上禁止运行脚本
```

解决方式不是改执行策略（还原卡下改了也没用），而是**直接删掉 `.ps1` wrapper**，让 PowerShell 按 `PATHEXT` 优先级回退到 `.cmd`，而 `.cmd` 不受执行策略限制。

本文脚本已内置对 `npm.ps1`、`npx.ps1`、`bun.ps1`、`bunx.ps1` 的自动清理。

### 7. Bun 国内源配置

写入 `~/.bunfig.toml`：

```toml
[install]
registry = "https://registry.npmmirror.com/"
```

Bun 作为包管理器时默认读取 npm 配置，但显式写 `bunfig.toml` 可以确保万无一失。你也可以在项目根目录下放一个不带点的 `bunfig.toml` 来覆盖全局配置。

### 8. Kimi Code 安装

`kimi-cli` 已品牌迁移为 `kimi-code`，包名为 **`@moonshot-ai/kimi-code`**，通过 **Bun 全局安装**：

```powershell
bun add -g @moonshot-ai/kimi-code
```

**为什么用 Bun 而不是 npm？**

实测发现 Kimi Code 官方通过 npm 发布的包名并非 `kimi-code`，而是 scoped 包 `@moonshot-ai/kimi-code`。Bun 对该包的支持更好，且安装后自动把 `kimi.exe` 链接到 `.bun\bin`，无需额外配置 PATH。

**安装位置**：
- 包本体：`~/.bun/install/global/node_modules/@moonshot-ai/kimi-code/`
- 可执行文件：`~/.bun/bin/kimi.exe`
- 配置目录：`~/.kimi-code/`（含 `config.toml`、API Key 等）

**配置迁移**：
- 旧版 `~/.kimi-code/config.toml` 继续兼容，无需重新配置 API Key。
- 还原卡环境下，每次重启后 `~/.kimi-code/` 会被清空，需要重新运行脚本安装 Kimi Code，或把 `config.toml` 备份到 D 盘/U 盘，每次开机后复制回去。

---

## 常见问题 FAQ

### Q1：重启后所有配置都消失了？

**正常**。还原卡环境，关机后 C 盘自动还原。

**解决**：把一键脚本保存为 `.ps1` 文件，放到 **D 盘或 U 盘**。每次开机后**右键 PowerShell 图标 → "以管理员身份运行"**，然后在管理员窗口中运行该脚本（约 30 秒，已下载的组件会自动跳过）。

### Q2：脚本运行后在新终端里输入 `npm` 提示找不到命令？

**原因**：虽然脚本已把 `%APPDATA%\npm` 加入注册表 PATH，但还原卡可能拦截了注册表写入，或者新窗口的 PATH 缓存未刷新。

**解决**：
- 方案 A：重新运行一遍脚本（脚本会检测已安装并跳过，只补 PATH）。
- 方案 B：在当前窗口手动执行：
  ```powershell
  $env:Path = "$env:APPDATA\npm;$env:Path"
  ```

### Q3：执行 `bun` 时提示 "无法加载 bun.ps1"？

脚本已自动清理 `.ps1` wrapper，但如果你有其他 npm 全局安装的包也遇到同样问题，统一清理：

```powershell
Get-ChildItem "$env:APPDATA\npm" -Filter "*.ps1" | Remove-Item -Force
```

### Q4：如何升级 Bun？

```powershell
npm.cmd update -g bun
```

走 npm 升级会自动使用已配置的阿里云镜像。**不要用 `bun upgrade`**，这会尝试从 GitHub 官方源下载，国内可能失败。

### Q5：如何升级 Node.js？

修改脚本中的版本号，重新运行即可。旧版本会被新版本覆盖安装。

### Q6：机房网络连不上 TUNA 镜像？

如果清华 TUNA 也被墙/限速，替换为其他镜像：

| 镜像站 | Node.js 地址 |
|--------|-------------|
| 清华 TUNA | `https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/` |
| 华为云 | `https://repo.huaweicloud.com/nodejs/` |
| 阿里云 | `https://cdn.npmmirror.com/binaries/node/` |

---

## 装完后，文件都在哪？

| 组件 | 实际路径 | 说明 |
|------|---------|------|
| **PowerShell 7** | `C:\Program Files\PowerShell\7\pwsh.exe` | MSI 安装，与系统 5.1 共存 |
| **Git** | `C:\Program Files\Git\cmd\git.exe` | 静默安装 |
| **Node.js** | `C:\Program Files\nodejs\node.exe` | MSI 安装 |
| **npm 全局包** | `C:\Users\<user>\AppData\Roaming\npm` | npm install -g 的落地位置 |
| **Bun** | `C:\Users\<user>\AppData\Roaming\npm\node_modules\bun\bin\bun.exe` | 本体位置 |
| **Bun 全局包** | `C:\Users\<user>\.bun\bin` | bun add -g 的落地位置（含 kimi 等工具） |
| **Kimi Code 包** | `C:\Users\<user>\.bun\install\global\node_modules\@moonshot-ai\kimi-code\` | Bun 全局安装 |
| **Kimi Code 配置** | `C:\Users\<user>\.kimi-code\` | 含 config.toml、API Key、session 等 |

---

## 附录：无管理员权限版（便携模式）

如果机房完全无法获得管理员权限，使用以下便携版方案。所有组件解压到用户目录，不需要写 `C:\Program Files\`。

```powershell
# 创建便携目录
$portable = "$env:USERPROFILE\PortableDev"
New-Item -ItemType Directory -Force -Path $portable | Out-Null

# --- Node.js 便携版 ---
$nodeZip = "$portable\node-v22.16.0-win-x64.zip"
Invoke-WebRequest -Uri "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/v22.16.0/node-v22.16.0-win-x64.zip" -OutFile $nodeZip
Expand-Archive -Path $nodeZip -DestinationPath $portable -Force
$nodeDir = "$portable\node-v22.16.0-win-x64"

# --- Git 便携版（PortableGit）---
$gitZip = "$portable\PortableGit-2.54.0-64-bit.7z.exe"
# 下载后自解压...

# --- 统一 PATH ---
Add-ToPath -Dir "$nodeDir"
Add-ToPath -Dir "$portable\PortableGit\cmd"
# ...
```

便携版详细方案待补充，有需求可开新文。

---

## 更新日志

- **2026-06-03** 初版发布：
  - 整合 PS7 + Git + Node.js + npm + Bun + Kimi Code 为一条龙脚本
  - 引入**统一 PATH 管理函数**，根治还原机房 PATH 丢失问题
  - 修复 npm 全局包目录在还原机房下 PATH 不生效的问题
  - 清理所有 `.ps1` wrapper，全面适配 Windows PowerShell 5.1 `Restricted` 策略
  - 代理下载自动 fallback，优先 `v4.gh-proxy.org`
  - **已实测**：Kimi Code 包名为 `@moonshot-ai/kimi-code`，通过 `bun add -g` 安装，可执行文件在 `.bun\bin\kimi.exe`

- **2026-06-03** 修正：
  - 旧文弃用范围修正：仅标记 `kimi-cli-install-win.md` 为弃用（带新文链接），`kimi-cli-install-centos9.md` 改为迁移提醒
  - `install-bun-china.md` 与 `win-terminal-setup.md` 恢复为独立教程，不标记弃用
  - 修正脚本执行环境说明：明确在 **Windows PowerShell 5.1** 中运行（非 PS7）
  - 修正 Bun 可执行文件路径：本体在 `%APPDATA%\npm\node_modules\bun\bin\bun.exe`，`.bun\bin` 只有全局包链接
  - 修正 PS7 版本获取：pwsh `-Command` 改用单引号防止外层 PS5.1 提前解析变量
  - 修正 PS5.1 null 安全：`($out).ToString()` 改为 `if ($out) { $out.ToString() }`

---

> 还原机房一键装机：PowerShell 7 + Git + Node.js + npm（国内镜像）+ Bun + Kimi Code。
>
> 复制脚本 → 管理员 PowerShell 粘贴 → 回车，等 1~2 分钟获得完整 JS 开发环境 + AI 编程助手。
>
> 重启后只需重新运行一次脚本，所有环境立即恢复。
