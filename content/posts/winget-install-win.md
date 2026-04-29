---
title: Windows 10 / 11 无管理员权限安装 winget
date: 2026-04-29
tags: [winget, windows, powershell, github-proxy, 机房]
---

# Windows 10 / 11 无管理员权限安装 winget

> 对应 CentOS 版：[CentOS Stream 9 / RHEL 9 无订阅版安装 Kimi CLI](https://bash.yang125.fun/posts/kimi-cli-install-centos9/)

## 环境信息

- **系统**：Windows 10 19041+ / Windows 11（64 位）
- **权限**：普通用户即可（无需管理员，全程 0 弹窗）
- **场景**：机房、OS-Easy 还原卡、精简版系统、商店被移除、域控锁死环境
- **目标**：安装 `winget` (Windows Package Manager)
- **网络**：能访问 GitHub 即可（Release 直链，附 gh-proxy.org 代理加速）

---

## 中间的坑

| 坑 | 原因 |
|---|---|
| **Microsoft Store 被移除** | 精简版系统、LTSC、ghost 封装版默认没有商店，winget 随商店一起消失 |
| **AppX 依赖地狱** | msixbundle 安装需要 VCLibs + UWPDesktop + WindowsAppRuntime 三个框架包 |
| **机房还原卡** | OS-Easy、冰点还原等重启后 C 盘还原，每次开机需重装 |
| **GitHub 下载慢** | Release 大文件（200MB+）在国内部分网络环境极不稳定 |
| **版本号漂移** | 微软更新频繁，硬编码版本号的教程容易 404 |

---

## 一键脚本（复制即用）

在 PowerShell 里复制粘贴执行（支持 PowerShell 5.1 老窗口）：

```powershell
# 创建临时目录
$temp = "$env:TEMP\winget-setup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# --- 1. 获取最新版本号 ---
Write-Host ">>> 查询 winget 最新版本..." -ForegroundColor Cyan
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest" -TimeoutSec 30 -UseBasicParsing
    $version = $release.tag_name
    Write-Host "    最新版本: $version" -ForegroundColor Green
} catch {
    Write-Host "    查询失败，使用 fallback 版本 v1.28.240" -ForegroundColor Yellow
    $version = "v1.28.240"
}

# --- 2. 下载主安装包 ---
$msixUrl = "https://github.com/microsoft/winget-cli/releases/download/$version/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
$msixPath = "$temp\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"

if (-not (Test-Path $msixPath)) {
    Write-Host ">>> 下载 winget msixbundle..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $msixUrl -OutFile $msixPath -UseBasicParsing -TimeoutSec 300
    } catch {
        Write-Host "    直链失败，切换 gh-proxy.org..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://gh-proxy.org/$msixUrl" -OutFile $msixPath -UseBasicParsing -TimeoutSec 300
    }
}

# --- 3. 下载依赖包 ---
$depZipUrl = "https://github.com/microsoft/winget-cli/releases/download/$version/DesktopAppInstaller_Dependencies.zip"
$depZipPath = "$temp\DesktopAppInstaller_Dependencies.zip"

if (-not (Test-Path $depZipPath)) {
    Write-Host ">>> 下载依赖包..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $depZipUrl -OutFile $depZipPath -UseBasicParsing -TimeoutSec 300
    } catch {
        Write-Host "    直链失败，切换 gh-proxy.org..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://gh-proxy.org/$depZipUrl" -OutFile $depZipPath -UseBasicParsing -TimeoutSec 300
    }
}

# --- 4. 解压依赖 ---
Write-Host ">>> 解压依赖包..." -ForegroundColor Cyan
$depExtractPath = "$temp\dependencies"
tar -xf "$depZipPath" -C "$depExtractPath" 2>$null
if (-not $?) { Start-Sleep -Seconds 3; tar -xf "$depZipPath" -C "$depExtractPath" }

# --- 5. 安装依赖（x64）---
$arch = "x64"
$deps = @(
    "$depExtractPath\$arch\Microsoft.VCLibs.140.00_14.0.33519.0_${arch}.appx",
    "$depExtractPath\$arch\Microsoft.VCLibs.140.00.UWPDesktop_14.0.33728.0_${arch}.appx",
    "$depExtractPath\$arch\Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_${arch}.appx"
)
foreach ($dep in $deps) {
    if (Test-Path $dep) {
        Write-Host ">>> 安装依赖: $(Split-Path $dep -Leaf)" -ForegroundColor Cyan
        try { Add-AppxPackage -Path $dep -ErrorAction Stop; Write-Host "    OK" -ForegroundColor Green }
        catch { Write-Host "    已安装或跳过" -ForegroundColor DarkGray }
    }
}

# --- 6. 安装 winget ---
Write-Host ">>> 安装 winget..." -ForegroundColor Cyan
Add-AppxPackage -Path $msixPath -ErrorAction Stop
Write-Host "    winget 安装成功!" -ForegroundColor Green

# --- 7. 验证 ---
Write-Host ">>> 验证安装..." -ForegroundColor Cyan
$wingetVer = winget --version 2>$null
if ($wingetVer) { Write-Host "    winget 版本: $wingetVer" -ForegroundColor Green }
else { Write-Host "    请重新打开 PowerShell 窗口后执行 winget --version" -ForegroundColor Yellow }

# --- 8. 清理 ---
Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ">>> 完成!" -ForegroundColor Green
```

---

## 分步详解

如果你想知道上面脚本到底干了什么，以下是逐段拆解：

### 1. 查询最新版本

```powershell
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest" -TimeoutSec 30
$version = $release.tag_name
```

调用 GitHub API 获取 `latest` release 的版本号，避免硬编码导致 404。

> ⚠️ **注意**：API 查询不走代理（JSON 很小），如果网络极差可手动指定 `$version = "v1.28.240"`。

### 2. 下载主安装包 (msixbundle)

```powershell
$msixUrl = "https://github.com/microsoft/winget-cli/releases/download/$version/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle"
Invoke-WebRequest -Uri $msixUrl -OutFile $msixPath -UseBasicParsing -TimeoutSec 300
```

msixbundle 是 winget 的 AppX 分发包，包含多架构二进制。由于体积较大（约 200MB），脚本内置了 **直链失败自动 fallback 到 gh-proxy.org** 的逻辑。

| 下载方式 | 适用场景 |
|---|---|
| **GitHub 直链** | 网络通畅时速度最快 |
| **gh-proxy.org** | 国内环境加速，Cloudflare 代理 |
| **mirror.ghproxy.com** | gh-proxy.org 失效时可手动替换 |

### 3. 下载并解压依赖包

winget 需要三个框架依赖：

| 依赖 | 文件名示例 | 作用 |
|---|---|---|
| **VCLibs** | `Microsoft.VCLibs.140.00_14.0.33519.0_x64.appx` | Visual C++ UWP 运行时 |
| **UWPDesktop** | `Microsoft.VCLibs.140.00.UWPDesktop_14.0.33728.0_x64.appx` | UWP 桌面桥运行时 |
| **WindowsAppRuntime** | `Microsoft.WindowsAppRuntime.1.8_8000.616.304.0_x64.appx` | Windows 应用 SDK 运行时 |

> ⚠️ **注意解压方式**：用 `tar.exe`（Windows 10 1803+ 自带）而非 `Expand-Archive`，避免 PowerShell 文件流锁定问题。若 `tar` 不可用，可用 .NET `ZipFile` 并先复制 zip 释放句柄。

### 4. 安装依赖和主包

```powershell
Add-AppxPackage -Path $depPath   # 逐个安装依赖
Add-AppxPackage -Path $msixPath  # 最后安装 winget
```

**顺序很重要**：先装 VCLibs → UWPDesktop → WindowsAppRuntime → 最后 msixbundle。依赖已存在时会报错 "已安装更高版本"，可安全忽略。

### 5. 验证安装

```powershell
winget --version
```

若提示找不到命令，**关闭当前窗口重新打开**（App Execution Alias 需要新会话刷新 PATH）。

---

## 常见问题

### Q: 执行脚本时报 "Add-AppxPackage : 拒绝访问"？

A: PowerShell 执行策略限制了脚本。运行以下命令后重新粘贴：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q: `winget` 命令安装成功但提示找不到？

A: App Execution Alias 未在当前会话刷新。**关闭 PowerShell，重新打开新窗口** 再执行 `winget --version`。

### Q: 安装依赖时报 "已安装更高版本"？

A: 正常提示，说明系统已有更新的 VCLibs 或 WindowsAppRuntime，继续执行即可。

### Q: 系统是 32 位或 ARM64？

A: 修改脚本中的 `$arch` 变量：

```powershell
$arch = "x86"    # 或 "arm64"
```

msixbundle 本身是通用包，会自动匹配架构。

### Q: 重启后 winget 又没了？

A: 机房还原卡（OS-Easy、冰点还原）会还原 C 盘。当前开机 session 内正常使用；如需永久保留，找管理员在还原卡设置「保存数据」。

### Q: winget 怎么用？

A: 常用命令示例：

```powershell
winget search vscode                    # 搜索
winget install Microsoft.VisualStudioCode   # 安装
winget upgrade Microsoft.VisualStudioCode   # 升级
winget list                             # 查看已安装
winget uninstall Microsoft.VisualStudioCode # 卸载
```

---

## 参考链接

- Kimi CLI 官方文档：[https://www.kimi.com/code](https://www.kimi.com/code)
- winget 官方仓库：[https://github.com/microsoft/winget-cli](https://github.com/microsoft/winget-cli)
- gh-proxy.org（GitHub 代理）：[https://gh-proxy.org](https://gh-proxy.org)
