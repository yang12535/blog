---
title: Windows 10 / 11 安装 winget（无 Microsoft Store 方案）
date: 2026-05-06
tags: [winget, windows, powershell, github-proxy, 机房]
---

## 环境信息

- **系统**：Windows 10 19041+ / Windows 11（64 位）
- **权限**：普通用户即可（`Add-AppxPackage` 默认按用户安装，无需管理员提权）
- **前置要求**：系统需允许旁加载应用（Sideloading）。若为严格域控/企业环境，可能需要管理员在「设置 > 更新与安全 > 开发者选项」中开启
- **场景**：精简版系统、LTSC、 ghost 封装版、商店被移除、机房还原卡环境
- **目标**：安装 `winget` (Windows Package Manager)
- **网络**：走 GitHub Release，内置多级代理自动 fallback

---

## 中间的坑

| 坑 | 原因 |
| --- | --- |
| **Microsoft Store 被移除** | 精简版系统、LTSC、ghost 封装版默认没有商店，winget 随商店一起消失 |
| **AppX 依赖地狱** | msixbundle 安装需要 VCLibs + UWPDesktop + WindowsAppRuntime 三个框架包，缺一不可 |
| **依赖版本号漂移** | 不同 winget 版本对应的 VCLibs/Runtime 版本号不同，硬编码文件名会导致找不到依赖 |
| **解压目录未创建** | `tar.exe -C` 要求目标目录必须已存在，否则会直接报错 |
| **GitHub 下载慢/断** | Release 大文件（~200MB）在国内部分网络环境极不稳定 |
| **机房还原卡** | OS-Easy、冰点还原等重启后 C 盘还原，每次开机需重装 |

---

## 一键脚本（复制即用）

在 PowerShell 里复制粘贴执行（支持 Windows PowerShell 5.1）：

```powershell
# ==================== 0. 初始化 ====================
$temp = "$env:TEMP\winget-setup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

function Write-Info($msg)  { Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "    $msg" -ForegroundColor Red }

# ==================== 1. 获取最新版本号 ====================
Write-Info "查询 winget 最新版本..."
$version = $null
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest" -TimeoutSec 30 -UseBasicParsing
    if ($release -and $release.tag_name) {
        $version = $release.tag_name
        Write-Ok "最新版本: $version"
    }
} catch {
    Write-Warn "GitHub API 查询失败"
}

if (-not $version) {
    $version = "v1.28.240"
    Write-Warn "使用 fallback 版本: $version"
}

# ==================== 2. 下载函数（多级代理 fallback）====================
function Download-WithRetry {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [Parameter(Mandatory=$true)][string]$OutFile,
        [int]$MinSizeBytes = 1024
    )
    $candidates = @(
        $Url
        "https://gh-proxy.org/$Url"
        "https://mirror.ghproxy.com/$Url"
        "https://ghproxy.net/$Url"
    )
    foreach ($uri in $candidates) {
        try {
            Write-Info "尝试下载..."
            Invoke-WebRequest -Uri $uri -OutFile $OutFile -UseBasicParsing -TimeoutSec 300
            if ((Test-Path $OutFile) -and ((Get-Item $OutFile).Length -ge $MinSizeBytes)) {
                Write-Ok "下载成功 ($( [math]::Round((Get-Item $OutFile).Length / 1MB, 2) ) MB)"
                return $true
            } else {
                Write-Warn "文件过小或为空，尝试下一个源..."
            }
        } catch {
            Write-Warn "失败: $($_.Exception.Message)"
        }
    }
    return $false
}

# ==================== 3. 下载主安装包 ====================
$msixUrl = "https://github.com/microsoft/winget-cli/releases/download/$version/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
$msixPath = "$temp\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"

if (Test-Path $msixPath) {
    Write-Warn "检测到旧的临时文件，删除后重新下载..."
    Remove-Item $msixPath -Force
}
Write-Info "下载 winget msixbundle..."
$ok = Download-WithRetry -Url $msixUrl -OutFile $msixPath -MinSizeBytes 50MB
if (-not $ok) {
    Write-Fail "主安装包下载失败，所有镜像源均不可用。"
    exit 1
}

# ==================== 4. 下载依赖包 ====================
$depZipUrl = "https://github.com/microsoft/winget-cli/releases/download/$version/DesktopAppInstaller_Dependencies.zip"
$depZipPath = "$temp\DesktopAppInstaller_Dependencies.zip"

if (Test-Path $depZipPath) {
    Write-Warn "检测到旧的临时文件，删除后重新下载..."
    Remove-Item $depZipPath -Force
}
Write-Info "下载依赖包..."
$ok = Download-WithRetry -Url $depZipUrl -OutFile $depZipPath -MinSizeBytes 1MB
if (-not $ok) {
    Write-Fail "依赖包下载失败，所有镜像源均不可用。"
    exit 1
}

# ==================== 5. 解压依赖 ====================
Write-Info "解压依赖包..."
$depExtractPath = "$temp\dependencies"
New-Item -ItemType Directory -Force -Path $depExtractPath | Out-Null

try {
    & tar.exe -xf "$depZipPath" -C "$depExtractPath" 2>$null
    if (-not $?) { throw "tar.exe 返回非零退出码" }
} catch {
    Write-Warn "tar 解压失败，尝试 Expand-Archive..."
    try {
        Expand-Archive -Path $depZipPath -DestinationPath $depExtractPath -Force
    } catch {
        Write-Fail "依赖包解压失败: $_"
        exit 1
    }
}

# ==================== 6. 定位并安装依赖 ====================
$arch = "x64"
$archPath = Join-Path $depExtractPath $arch

# 某些压缩包结构不同，若标准目录不存在，自动查找包含 .appx 的目录
if (-not (Test-Path $archPath)) {
    $foundDir = Get-ChildItem -Path $depExtractPath -Directory | Where-Object {
        (Get-ChildItem $_.FullName -Filter "*.appx" -ErrorAction SilentlyContinue).Count -gt 0
    } | Select-Object -First 1
    if ($foundDir) { $archPath = $foundDir.FullName }
}

if (-not (Test-Path $archPath)) {
    Write-Fail "未在依赖包中找到 $arch 架构的依赖。请检查下载的依赖包是否完整。"
    exit 1
}

# 用通配符匹配依赖，避免不同 release 版本号硬编码导致失效
$depPatterns = @(
    "Microsoft.VCLibs.140.00_*.appx",
    "Microsoft.VCLibs.140.00.UWPDesktop_*.appx",
    "Microsoft.WindowsAppRuntime.1.*_*.appx"
)

$installedDeps = 0
foreach ($pattern in $depPatterns) {
    $files = Get-ChildItem -Path $archPath -Filter $pattern -ErrorAction SilentlyContinue | Sort-Object Name
    if ($files.Count -eq 0) {
        Write-Warn "未找到匹配 $pattern 的依赖包"
        continue
    }
    # 取排序后的最后一个（通常版本号最大）
    $depFile = $files | Select-Object -Last 1
    Write-Info "安装依赖: $($depFile.Name)"
    try {
        Add-AppxPackage -Path $depFile.FullName -ErrorAction Stop
        Write-Ok "已安装"
        $installedDeps++
    } catch {
        $errMsg = $_.Exception.Message
        if ($errMsg -match "0x80073D06|already installed|更高版本|higher version") {
            Write-Ok "已存在更高或相同版本，跳过"
            $installedDeps++
        } else {
            Write-Warn "安装失败: $errMsg"
        }
    }
}

if ($installedDeps -eq 0) {
    Write-Fail "没有任何依赖安装成功，后续 winget 安装极有可能失败。"
    # 不直接退出，给用户查看主包安装错误信息的机会
}

# ==================== 7. 安装 winget ====================
Write-Info "安装 winget..."
try {
    Add-AppxPackage -Path $msixPath -ErrorAction Stop
    Write-Ok "winget 安装成功"
} catch {
    Write-Fail "winget 安装失败: $($_.Exception.Message)"
    Write-Warn "常见原因："
    Write-Warn "  1. 系统未开启'旁加载应用'（设置 > 更新与安全 > 开发者选项）"
    Write-Warn "  2. 依赖框架缺失（见上方依赖安装日志）"
    Write-Warn "  3. 系统版本过低（需要 Windows 10 19041+ / 21H1+）"
    exit 1
}

# ==================== 8. 验证 ====================
Write-Info "验证安装..."
# 刷新当前会话 PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# App Execution Alias 可能需要新会话，先尝试刷新后的 PATH
$wingetCmd = Get-Command winget.exe -ErrorAction SilentlyContinue
if (-not $wingetCmd) {
    # 兜底：直接扫描 WindowsApps 目录
    $wingetPaths = @(
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe"
        "C:\Program Files\WindowsApps\Microsoft.DesktopAppInstaller_*_*__8wekyb3d8bbwe\winget.exe"
    )
    foreach ($wp in $wingetPaths) {
        $resolved = Resolve-Path $wp -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved) {
            $env:Path += ";$(Split-Path $resolved.Path -Parent)"
            break
        }
    }
}

try {
    $wingetVer = winget.exe --version 2>$null
    if ($wingetVer) {
        Write-Ok "winget 版本: $wingetVer"
    } else {
        throw "返回为空"
    }
} catch {
    Write-Warn "当前会话无法直接调用 winget。"
    Write-Warn "请关闭此 PowerShell 窗口，重新打开后再执行: winget --version"
}

# ==================== 9. 清理 ====================
Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
Write-Info "完成!"
```

> **提示**：脚本运行期间请不要关闭窗口。msixbundle 约 200MB，若下载卡住超过 5 分钟请检查网络。

---

## 分步详解

### 1. 查询最新版本

```powershell
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest" -TimeoutSec 30 -UseBasicParsing
$version = $release.tag_name
```

调用 GitHub API 获取 `latest` release 的版本号，避免硬编码导致 404。API 返回 JSON 很小，通常不会被墙；若失败则自动回退到内置的 fallback 版本 `v1.28.240`。

### 2. 下载主安装包与依赖包

msixbundle 是 winget 的 AppX 分发包（约 200MB），依赖包是一个 zip（约 90MB）。脚本内置了**多级代理自动 fallback**：

| 优先级 | 地址 | 说明 |
| --- | --- | --- |
| 1 | GitHub 直链 | 网络通畅时速度最快 |
| 2 | `gh-proxy.org` | 国内常用代理 |
| 3 | `mirror.ghproxy.com` | 备用代理 |
| 4 | `ghproxy.net` | 再备用 |

下载完成后会进行**大小校验**，如果文件过小（如被 CDN 返回了 HTML 错误页）会自动尝试下一个源。

### 3. 解压依赖包

```powershell
$depExtractPath = "$temp\dependencies"
New-Item -ItemType Directory -Force -Path $depExtractPath | Out-Null
& tar.exe -xf "$depZipPath" -C "$depExtractPath"
```

**坑点**：`tar.exe -C` 要求目标目录**必须已存在**。原始脚本缺少 `New-Item`，导致 `could not chdir to ...` 报错，依赖完全没有解压，后续安装必然失败。

若 `tar.exe` 不可用（极旧的 Windows 版本），脚本会自动 fallback 到 `Expand-Archive`。

### 4. 用通配符匹配依赖（解决版本号漂移）

不同 winget Release 对应的 VCLibs / WindowsAppRuntime **版本号不同**。例如：

- `v1.28.240` 对应 `Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx`
- 下一个版本可能是 `...1.9_9000.xxx.xxx_x64.appx`

**硬编码完整文件名**的脚本在新版本 release 发布后立即失效。正确做法是用**通配符匹配**：

```powershell
$depPatterns = @(
    "Microsoft.VCLibs.140.00_*.appx",
    "Microsoft.VCLibs.140.00.UWPDesktop_*.appx",
    "Microsoft.WindowsAppRuntime.1.*_*.appx"
)
$files = Get-ChildItem -Path $archPath -Filter $pattern | Sort-Object Name
$depFile = $files | Select-Object -Last 1   # 取版本号最大的
```

这样无论微软怎么更新版本号，脚本都能自动找到正确的依赖包。

### 5. 安装依赖和主包

```powershell
Add-AppxPackage -Path $depFile.FullName
Add-AppxPackage -Path $msixPath
```

**顺序很重要**：先装 VCLibs → UWPDesktop → WindowsAppRuntime → 最后 msixbundle。

依赖已存在时会抛出异常（如 `0x80073D06` 已安装更高版本），脚本会捕获这类错误并标记为"跳过"，不会中断流程。

### 6. 验证安装

winget 通过 **App Execution Alias** 暴露命令，它的实际路径通常在：

```
%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe
```

这个目录理论上已经在用户 PATH 中，但 Alias 注册可能需要**新会话**才能被 PowerShell 识别。脚本在验证阶段会：

1. 刷新当前会话的 `$env:Path`
2. 尝试 `Get-Command winget.exe`
3. 若仍找不到，直接扫描 `WindowsApps` 目录兜底
4. 最后如果还是不行，提示用户**关闭窗口重新打开**

---

## 常见问题

### Q: 执行脚本时报 "Add-AppxPackage : 部署失败，HRESULT: 0x80073CF3"？

**原因**：缺少框架依赖，或系统未允许旁加载应用。

**解决**：
1. 先确认脚本第 6 步的依赖是否全部安装成功（看日志中的"已安装"或"跳过"）。
2. 若依赖都已安装仍报错，检查系统是否开启了**旁加载应用**：
   - 快捷键 `Win + I` → 更新与安全 → 开发者选项 → 选择「旁加载应用」或「开发人员模式」。
   - 若为企业域控环境，请联系管理员开启。

### Q: 执行脚本时报 "Add-AppxPackage : 拒绝访问"？

**原因**：当前 PowerShell 执行策略限制了脚本运行。

**解决**：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
然后重新粘贴脚本执行。

### Q: `winget` 命令安装成功但提示找不到？

**原因**：App Execution Alias 未在当前 PowerShell 会话中刷新。

**解决**：**关闭当前 PowerShell 窗口，重新打开新窗口**，再执行 `winget --version`。

### Q: 安装依赖时报 "已安装更高版本"？

**原因**：系统中已有更新的 VCLibs 或 WindowsAppRuntime。

**解决**：这是正常提示，脚本会自动跳过并继续，无需处理。

### Q: 系统是 32 位或 ARM64？

**解决**：修改脚本中的 `$arch` 变量：

```powershell
$arch = "x86"    # 或 "arm64"
```

msixbundle 本身是通用包，会自动匹配架构；但依赖 zip 中需要选择对应架构的 `.appx`。

### Q: 重启后 winget 又没了？

**原因**：机房还原卡（OS-Easy、冰点还原等）会在重启后还原 C 盘。

**解决**：当前开机 session 内正常使用；如需永久保留，找管理员在还原卡设置中「保存数据」或「创建还原点」。

### Q: winget 怎么用？

```powershell
winget search vscode                              # 搜索
winget install Microsoft.VisualStudioCode         # 安装
winget upgrade Microsoft.VisualStudioCode         # 升级
winget list                                       # 查看已安装
winget uninstall Microsoft.VisualStudioCode       # 卸载
```

---

## 参考链接

- winget 官方仓库：[https://github.com/microsoft/winget-cli](https://github.com/microsoft/winget-cli)
- gh-proxy.org（GitHub 代理）：[https://gh-proxy.org](https://gh-proxy.org)
- Microsoft 文档 - 安装 winget：[https://learn.microsoft.com/zh-cn/windows/package-manager/winget/](https://learn.microsoft.com/zh-cn/windows/package-manager/winget/)

---

## 更新日志

- **2026-05-08** 修复断点续传导致的安装失败：
  - 增加 msixbundle / 依赖包 zip 的临时文件大小校验，不完整时自动删除重下
  - 解决「执行到一半退出，再次运行时报文件损坏 / 0x80073CF3 部署失败」的问题

- **2026-05-06** 增强健壮性，修复依赖安装失败问题：
  - 修复 `tar.exe -C` 解压失败（缺少目标目录），增加 `New-Item -Force` 预创建
  - 依赖包改用通配符匹配（`Microsoft.VCLibs.140.00_*.appx` 等），避免版本号漂移导致硬编码失效
  - 增加多级代理下载 fallback（`gh-proxy.org` → `mirror.ghproxy.com` → `ghproxy.net`）
  - 增加下载文件大小校验，防止 CDN 返回错误页面导致安装包损坏
  - `tar` 解压失败时自动 fallback 到 `Expand-Archive`
  - 完善 `Add-AppxPackage` 错误捕获，区分"已安装更高版本"与真正安装失败
  - 验证阶段增加 `WindowsApps` 绝对路径兜底扫描

---
