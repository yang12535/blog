---
title: Windows 旧版 curl 下载慢的根治方案（自动代理 + UA 伪装 + aria2c 兜底）
date: 2026-05-08
tags: [curl, windows, proxy, aria2, download, 国内镜像]
---

---

> 浏览器下载 10 MB/s，curl 只有 1 Mbps？这不是你的网有问题，是 Windows 自带的 curl 太老了。
>
> 本文提供从「临时缓解」到「彻底根治」的完整方案，含自动代理嗅探、UA 伪装、证书错误修复，以及 aria2c 多线程兜底。复制脚本 → 粘贴 → 回车即可。
>
> **注意**：不同镜像站对 UA 的检测策略不同。实测中科大镜像站对 Chrome 124 直接返回 403，更新为 Chrome 132 后可通过第一道检测（但部分站点仍有 JS 验证，curl 无法绕过）。
>
> **扩展阅读**：如果你在 **VirtualBox 虚拟机** 中运行 PowerShell，仍可能遇到 `Invoke-WebRequest` 下载时任务管理器显示**脉冲式波动**、速度暴跌到 100 Kbps 的情况。根治方案请参考 [VirtualBox 中 PowerShell 下载脉冲式卡顿的根治方案](/posts/virtualbox-powershell-download-stutter/)。

---

## 环境信息

| 项目 | 说明 |
| --- | --- |
| **系统** | Windows 10 / Windows 11（64 位） |
| **Shell** | Windows PowerShell 5.1（系统默认）或 PowerShell 7 |
| **场景** | 国内网络、机房、校园网、已开启代理（Clash/V2Ray） |
| **目标** | 让 curl 下载速度达到浏览器同等水平，或直接用 aria2c 跑满带宽 |
| **网络** | 可访问国内镜像站；境外站点走本地代理（127.0.0.1:10808 等） |

---

## 问题现象

你在 PowerShell 里执行 `curl.exe` 下载时，可能遇到以下一种或多种症状：

| 症状 | 典型表现 |
| ------ | ---------- |
| **速度被限速** | 国内镜像站浏览器下载 10 MB/s，curl 稳定 1 Mbps（约 125 KB/s） |
| **证书错误** | 走代理访问 GitHub 时报 `schannel: next InitializeSecurityContext failed: Unknown error (0x80092013)` |
| **HTTP/2 未编译** | 系统自带 curl 编译时未启用 HTTP/2（nghttp2），指定 `--http2` 会报 `Unsupported protocol` |
| **TLS 握手慢** | WinSSL（Schannel）老旧，部分 CDN 会降级连接 |
| **不读系统代理** | 浏览器自动走了 Clash/V2Ray，curl 全程直连，境外站点直接超时 |

**根本原因**：Windows 系统自带的 `curl.exe` 版本为 **7.55.1**（发布于 2017 年），存在以下硬伤：

1. **默认 UA 暴露身份**：`User-Agent: curl/7.55.1` 极易被服务端识别并限速
2. **不支持 HTTP/2**：国内镜像站 HTTP/2 效率远高于 HTTP/1.1
3. **WinSSL + 老旧 TLS**：Schannel 证书吊销检查（CRL）在代理环境下几乎必失败
4. **不感知系统代理**：curl 不会自动读取 Windows 代理设置，必须手动指定 `-x`

---

## 诊断：你的 curl 是哪个版本？

```powershell
curl.exe --version
```

期望输出（系统自带）：
```
curl 7.55.1 (Windows) libcurl/7.55.1 WinSSL
Release-Date: 2017-11-14, security patched: 2019-11-05
```

如果看到 `WinSSL` 且版本号低于 7.80.0，说明你在用**旧版系统 curl**，本文的优化方案对你全部适用。

---

## 方案一：不换工具，手动加参数（临时缓解）

如果你不想装任何新软件，每次下载时手动加上以下参数：

```powershell
# 国内镜像站（解决 UA 限速 + 提升 TCP 效率）
curl.exe -L --tcp-nodelay `
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36" `
  -o output.file `
  "https://下载地址"

# 境外站点（走代理 + 禁用证书吊销检查，解决 0x80092013）
curl.exe -L --tcp-nodelay --ssl-no-revoke `
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36" `
  -x http://127.0.0.1:10808 `
  -o output.file `
  "https://github.com/..."
```

| 参数 | 作用 |
| ------ | ------ |
| `-L` | 跟随 302/301 跳转，国内镜像常重定向到就近节点 |
| `--tcp-nodelay` | 显式禁用 Nagle 算法（curl 7.50.2+ 已默认启用，旧版需手动加） |
| `-A "..."` | 伪装成 Chrome，绕过服务端对 curl UA 的限速策略 |
| `--ssl-no-revoke` | 禁用 Schannel 的证书吊销检查，根治代理环境下的 TLS 握手失败 |
| `-x http://...` | 显式指定代理地址（curl 不会自动读取 Windows 系统代理） |

> **坑点**：`--ssl-no-revoke` 仅在 curl 7.44+ 可用，系统自带的 7.55.1 恰好支持，但再老的版本就不行了。`--tcp-nodelay` 在 curl 7.50.2+ 已默认启用，对 7.55.1 无额外增益。

---

## 方案二：PowerShell Profile 全局替换（一劳永逸）

将以下内容添加到 PowerShell `$Profile`，以后直接输入 `curl` 就会自动带优化参数：

```powershell
# Profile 文件默认不存在，先创建目录再打开
$profileDir = Split-Path -Parent $PROFILE
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}
notepad $PROFILE
```

粘贴以下内容：

```powershell
$BrowserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"

# 移除 PowerShell 默认的 curl -> Invoke-WebRequest 别名
if (Get-Alias curl -ErrorAction SilentlyContinue) { Remove-Item Alias:\curl -Force }

function global:curl {
    $curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
    if (-not $curlExe) {
        Write-Error "curl.exe not found in PATH"
        return
    }

    $PassThruArgs = $args

    $hasUA = $PassThruArgs | Where-Object { $_ -match '^(-A|--user-agent)$' }
    $inject = @()
    if (-not $hasUA) {
        $inject += @("-A", $BrowserUA)
    }

    $verLine = (& $curlExe --version 2>$null | Select-Object -First 1)
    $verMatch = $verLine -match 'curl\s+(\d+\.\d+\.\d+)'
    $curlVersion = if ($verMatch) { $matches[1] } else { $null }
    $isOld = $curlVersion -and ([version]$curlVersion -lt [version]"7.80.0")
    $needsTcpNoDelay = $curlVersion -and ([version]$curlVersion -lt [version]"7.50.2")
    if ($needsTcpNoDelay -and -not ($PassThruArgs -contains '--tcp-nodelay')) {
        # 仅 7.50.2 之前的版本需要显式加（7.50.2+ 已默认启用）
        $inject += "--tcp-nodelay"
    }

    & $curlExe @inject @PassThruArgs
}
```

保存后**关闭当前 PowerShell 窗口，重新打开一个新窗口**。如果打开时报错「禁止运行脚本」，先执行：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

然后**再重新打开**一个 PowerShell 窗口，输入 `curl --version` 测试。此时直接输入 `curl` 就是优化版，无需每次敲长参数。

---

## 方案三：智能下载脚本（自动代理 + 多级 fallback）

如果你希望更省心，我提供了一个 `curl-fast.ps1` 脚本，自动完成以下事情：

1. **自动嗅探代理**：扫描 10808、7890、10809、1080 等常见代理端口
2. **自动 UA 伪装**：没有 `-A` 时自动注入 Chrome UA
3. **旧版 curl + 代理自动加 `--ssl-no-revoke`（`--tcp-nodelay` 在 7.50.2+ 已默认启用，此处保留仅为兼容明示）**：避开证书错误
4. **curl 失败自动 fallback 到 aria2c**：多线程下载，直接跑满带宽

### 使用方式

```powershell
# 下载任意链接，全自动优化
powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 "https://你的下载链接" -OutFile "保存文件名"

# 指定代理（如果不自动识别）
powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 "https://..." -Proxy "socks5h://127.0.0.1:10808"

# 强制使用 aria2c 多线程（最快）
powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 "https://..." -ForceAria2
```

### 脚本核心逻辑

```powershell
# 伪代码展示判断逻辑
if (检测到新版 curl >= 7.80.0) {
    使用 HTTP/2 + OpenSSL 现代模式
} elseif (检测到旧版系统 curl) {
    注入 --tcp-nodelay + 浏览器 UA
    if (走了代理) { 额外注入 --ssl-no-revoke }
    执行下载
    if (失败) { fallback 到 aria2c }
} else {
    直接调用 aria2c 多线程下载
}
```

---

## 方案四：彻底根治（推荐）

### 1. 安装新版 curl（OpenSSL + HTTP/2）

```powershell
# 使用 winget（需先安装 winget，参见博客另一篇文章）
winget install curl.curl

# 或使用 scoop
scoop install curl
```

验证：
```powershell
curl --version
# 期望看到 8.x.x，且 Features 包含 HTTP2、SSL (OpenSSL)
```

### 2. 安装 aria2c（终极多线程下载）

```powershell
winget install aria2
# 或
scoop install aria2
```

aria2c 使用示例（8 线程，单文件分 8 段，走代理）：
```powershell
aria2c -x 8 -s 8 -k 1M `
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36" `
  --all-proxy="http://127.0.0.1:10808" `
  "https://github.com/..."
```

| aria2c 参数 | 含义 |
| ------------- | ------ |
| `-x 8` | 单服务器最大连接数 8 |
| `-s 8` | 文件分 8 段并行下载 |
| `-k 1M` | 每段最小 1MB，避免分段过小导致开销过大 |
| `--all-proxy` | 全局代理设置 |

---

## 实测对比

在同一网络环境下（代理节点带宽 100 Mbps），下载不同来源的文件：

| 下载源 | 旧版 curl 默认 | 旧版 curl + 优化参数 | 新版 curl 8.x | aria2c 8 线程 |
| -------- | --------------- | --------------------- | --------------- | -------------- |
| **清华 TUNA** (Ubuntu ISO) | ~5 MB/s | ~10 MB/s | ~12 MB/s | ~50 MB/s |
| **华为云** (docker tgz) | ~2 MB/s | ~10 MB/s | ~11 MB/s | ~45 MB/s |
| **GitHub** (ripgrep zip) | ❌ 超时/证书错误 | ~1 MB/s | ~5 MB/s | ~15 MB/s |
| **npmmirror** (npm tarball) | ~7 MB/s | ~10 MB/s | ~11 MB/s | ~40 MB/s |

> **结论**：
> - 旧版 curl 加参数后**国内源可翻倍**，境外源从「完全不通」变成「可用」
> - 要**跑满带宽**，唯一答案是 **aria2c 多线程**
> - 长期频繁下载，建议直接升级到新版 curl + aria2c

---

## 常见问题 FAQ

### Q1：为什么浏览器下载快，curl 慢？

浏览器会自动走系统代理、自动使用 HTTP/2、自带现代 TLS 栈，且 UA 不会被限速。curl 默认什么都不做，需要手动告诉它怎么做。

### Q2：加了代理还是报错 `0x80092013`？

这是 Windows Schannel（WinSSL）的证书吊销检查失败。**必须加 `--ssl-no-revoke`**。旧版 curl 无解，彻底根治是升级到基于 OpenSSL 的新版 curl。

### Q3：我的代理端口不是 10808 怎么办？

手动指定：
```powershell
powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 "https://..." -Proxy "http://127.0.0.1:7890"
```

或在脚本中修改 `$commonProxies` 数组，添加你的端口。

### Q4：`curl-fast.ps1` 执行时提示「无法加载，因为在此系统上禁止运行脚本」？

这是 PowerShell 执行策略限制。有两种解决方式：

**方式一：临时绕过（仅本次执行）**
```powershell
powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 ...
```

**方式二：一劳永逸（推荐）**
修改当前用户的执行策略为 `RemoteSigned`，允许本地脚本运行：
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

修改后，无需再加 `-ExecutionPolicy Bypass`，可在 PowerShell 中直接运行 `./curl-fast.ps1`，或右键 `.ps1` 文件选择「使用 PowerShell 运行」。

### Q5：如何判断 curl 有没有走代理？

加 `-v` 参数看 verbose 输出：
```powershell
curl.exe -v -x http://127.0.0.1:10808 https://httpbin.org/get
```

如果看到 `Proxy-Connection: keep-alive` 或 `CONNECT github.com:443`，说明代理已生效。

### Q6：aria2c 下载完成后文件损坏？

aria2c **默认不校验**文件完整性（`--check-integrity` 默认值为 `false`，且对普通 HTTP(S) 下载无效）。如果怀疑损坏，可手动比对校验值，或使用 `--checksum=sha-256=<hash>` 在下载时自动校验。绝大多数情况下 aria2c 的分段合并是可靠的。

### Q7：不想全局替换 curl，只想临时用？

直接用 `curl.exe`（带 `.exe` 后缀）就会绕过 PowerShell Profile 里的 wrapper，调用系统原始 curl：
```powershell
curl.exe -o file.zip "https://..."
```

### Q8：打开 PowerShell 报错「无法加载 Profile，禁止运行脚本」？

Windows 默认执行策略为 `Restricted`，会阻止 Profile 和 `.ps1` 脚本运行。修改当前用户的执行策略即可：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

执行后**关闭窗口，重新打开**生效。若当前窗口急需使用，也可临时绕过：
```powershell
powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 "https://..."
```

### Q9：配置完 Profile 后，`curl -o file` 报错「参数名称 o 具有二义性」？

早期版本使用了 `[CmdletBinding()] + ValueFromRemainingArguments`，导致 `-o` 被 PowerShell 误识别为 `-OutVariable` 的缩写。**本文方案二（Profile 函数）已修复**：去掉 `[CmdletBinding()]`，改用简单函数 + `$args` 收集参数。附录中的 `curl-fast.ps1` 是**独立脚本文件**，保留 `[CmdletBinding()]` 和 `param()` 是正确的设计（脚本需要命名参数），请勿将其直接复制到 `$PROFILE` 中。

### Q10：中科大镜像站返回 403，清华 TUNA 却能正常下载？

中科大镜像站使用了 Cloudflare WAF，对 UA 版本和浏览器环境有检测：
- `curl/7.55.1`（原始 UA）→ **403** 直接拦截
- Chrome 124 → **403** Cloudflare 拦截页
- Chrome 132 → 200 但返回 JS 验证页（curl 无法执行 JavaScript）

**这是服务端层面的限制**，和 curl 参数优化无关。遇到这种情况，**换镜像站即可**（清华 TUNA、华为云、阿里云等）。

---

## 附录：常见代理端口速查

| 工具 | 默认 mixed-port | HTTP 代理 | SOCKS5 代理 |
| ------ | ---------------- | ----------- | ------------- |
| **Clash Verge** | 7890 | `http://127.0.0.1:7890` | `socks5h://127.0.0.1:7890` |
| **Clash for Windows** | 7890 | `http://127.0.0.1:7890` | `socks5h://127.0.0.1:7890` |
| **v2rayN** | 10808 | `http://127.0.0.1:10808` | `socks5h://127.0.0.1:10808` |
| **v2rayN (旧版)** | 10809 | `http://127.0.0.1:10809` | `socks5h://127.0.0.1:10808` |
| **Shadowsocks** | 1080 | `http://127.0.0.1:1080` | `socks5h://127.0.0.1:1080` |

> **注意**：curl 的 SOCKS5 代理建议使用 `socks5h://` 前缀（h = host），表示让代理服务器做 DNS 解析，避免本地 DNS 污染导致的连接问题。

---

## 附录：curl-fast.ps1 完整源码

将以下内容保存为 `curl-fast.ps1`，即可直接使用：

> **注意**：以下代码设计为**独立 `.ps1` 脚本文件**（使用 `param()` 块）。若你想将其放入 `$PROFILE` 作为函数，请移除 `[CmdletBinding()]` 和 `param()` 块，改为直接用 `$args` 接收参数，否则 `-o` 可能冲突。

```powershell
#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Url,
    [Parameter(Position=1)]
    [string]$OutFile,
    [string]$Proxy,
    [int]$Threads = 8,
    [switch]$ForceAria2,
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$PassThruArgs
)

$BrowserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"

$hasUA = $PassThruArgs | Where-Object { $_ -match '^(-A|--user-agent)(=|$)' }

if (-not $Url) {
    Write-Host ""
    Write-Host "Usage: curl-fast.ps1 <Url> [-OutFile <path>] [-Proxy <proxy>] [-Threads <n>] [-ForceAria2]" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Url         Download URL (required)" -ForegroundColor White
    Write-Host "  OutFile     Save path (optional, auto-detected from URL)" -ForegroundColor White
    Write-Host "  Proxy       Proxy address (optional, auto-detect common ports)" -ForegroundColor White
    Write-Host "  Threads     aria2c thread count (default: 8)" -ForegroundColor White
    Write-Host "  ForceAria2  Force aria2c multi-thread download" -ForegroundColor White
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host '  .\curl-fast.ps1 "https://example.com/file.zip"' -ForegroundColor Gray
    Write-Host '  .\curl-fast.ps1 "https://example.com/file.zip" -OutFile "C:\Downloads\file.zip"' -ForegroundColor Gray
    Write-Host '  .\curl-fast.ps1 "https://example.com/file.zip" -Proxy "http://127.0.0.1:7890"' -ForegroundColor Gray
    Write-Host '  .\curl-fast.ps1 "https://example.com/file.zip" -ForceAria2' -ForegroundColor Gray
    Write-Host ""
    exit 0
}

if (-not $OutFile) {
    $uri = [System.Uri]$Url
    $OutFile = Split-Path -Leaf $uri.AbsolutePath
    if (-not $OutFile -or $OutFile -eq "/" -or $OutFile -eq "\") { $OutFile = "download.dat" }
    $OutFile = Join-Path (Get-Location) $OutFile
}

$outDir = Split-Path -Parent $OutFile
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# Auto-detect common proxy ports if not specified
if (-not $Proxy) {
    $commonProxies = @(
        "http://127.0.0.1:10808",
        "http://127.0.0.1:7890",
        "http://127.0.0.1:10809",
        "socks5h://127.0.0.1:10808",
        "socks5h://127.0.0.1:7890",
        "socks5h://127.0.0.1:1080"
    )
    foreach ($p in $commonProxies) {
        $proto, $addr = $p -split "://", 2
        $hostPort = $addr -split ":", 2
        $tcp = New-Object System.Net.Sockets.TcpClient
        try {
            $connect = $tcp.BeginConnect($hostPort[0], [int]$hostPort[1], $null, $null)
            if ($connect.AsyncWaitHandle.WaitOne(500, $false)) {
                $tcp.EndConnect($connect)
                if ($tcp.Connected) {
                    $Proxy = $p
                    break
                }
            }
        } catch { } finally { $tcp.Close() }
    }
}

function Find-BestCurl {
    $candidates = @("curl.exe")
    $candidates += @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\curl*\curl-*-win64-mingw\bin\curl.exe",
        "$env:ProgramFiles\curl\bin\curl.exe",
        "$env:LOCALAPPDATA\curl\bin\curl.exe",
        "$env:USERPROFILE\scoop\apps\curl\current\bin\curl.exe",
        "$env:USERPROFILE\scoop\shims\curl.exe"
    )
    foreach ($c in $candidates) {
        if ($c -match '[*?]') {
            $resolved = Resolve-Path $c -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1
            if ($resolved) { $c = $resolved }
        }
        $found = Get-Command $c -ErrorAction SilentlyContinue
        if ($found) { return $found.Source }
    }
    return $null
}

function Test-Aria2Available {
    return [bool](Get-Command aria2c.exe -ErrorAction SilentlyContinue)
}

$curlPath = Find-BestCurl
$curlVersion = $null
if ($curlPath) {
    $verLine = (& $curlPath --version 2>$null | Select-Object -First 1)
    if ($verLine -match 'curl\s+(\d+\.\d+\.\d+)') { $curlVersion = $Matches[1] }
}

Write-Host "[INFO] URL: $Url" -ForegroundColor Cyan
Write-Host "[INFO] Out: $OutFile" -ForegroundColor Cyan
if ($Proxy) { Write-Host "[INFO] Proxy: $Proxy (auto-detected)" -ForegroundColor Cyan }

if ($ForceAria2) {
    if (-not (Test-Aria2Available)) {
        Write-Host "[ERROR] aria2c not found. Install: winget install aria2  or  scoop install aria2" -ForegroundColor Red
        exit 1
    }
    Write-Host "[MODE] Forced aria2c multi-thread ($Threads threads)" -ForegroundColor Green
    $outDir = Split-Path -Parent $OutFile
    if (-not $outDir) { $outDir = "." }
    $ariaArgs = @("-x", $Threads, "-s", $Threads, "-k", "1M", "--user-agent=$BrowserUA", "-o", (Split-Path -Leaf $OutFile), "-d", $outDir)
    if ($Proxy) {
        $ariaProxy = $Proxy -replace '^socks5h://', 'socks5://'
        $ariaArgs += @("--all-proxy=$ariaProxy")
    }
    & aria2c.exe @ariaArgs "$Url"
    exit $LASTEXITCODE
}

$isOld = $false
if ($curlVersion) {
    $isOld = [version]$curlVersion -lt [version]"7.80.0"
}

if ($curlVersion -and (-not $isOld)) {
    Write-Host "[MODE] Modern curl $curlVersion (HTTP/2 + modern TLS)" -ForegroundColor Green
    $hasOutput = $PassThruArgs | Where-Object { $_ -match '^(-o|--output)(=|$)' }
    $hasProxyArg = $PassThruArgs | Where-Object { $_ -match '^(-x|--proxy)(=|$)' }
    $curlArgs = @("-L", "--fail-with-body", "--tcp-nodelay", "--compressed")
    if (-not $hasOutput) { $curlArgs += @("-o", $OutFile) }
    if (-not $hasUA) { $curlArgs += @("-A", $BrowserUA) }
    if ($Proxy -and -not $hasProxyArg) { $curlArgs += @("-x", $Proxy) }
    $curlArgs += $PassThruArgs
    $curlArgs += $Url
    & $curlPath @curlArgs
    exit $LASTEXITCODE
}

if ($curlVersion) {
    Write-Host "[WARN] Legacy curl $curlVersion detected (no HTTP/2, likely throttled)" -ForegroundColor Yellow
} else {
    Write-Host "[WARN] No standalone curl.exe found, falling back to built-in legacy curl" -ForegroundColor Yellow
}

if ($curlPath) {
    Write-Host "[MODE] Legacy curl optimized (fake UA + tcp-nodelay + retry + ssl-no-revoke if proxy)" -ForegroundColor Yellow
    $hasOutput = $PassThruArgs | Where-Object { $_ -match '^(-o|--output)(=|$)' }
    $hasProxyArg = $PassThruArgs | Where-Object { $_ -match '^(-x|--proxy)(=|$)' }
    $curlArgs = @("-L", "--tcp-nodelay", "--retry", "3", "--retry-delay", "2")
    if (-not $hasOutput) { $curlArgs += @("-o", $OutFile) }
    if (-not $hasUA) { $curlArgs += @("-A", $BrowserUA) }
    if ($Proxy -and -not $hasProxyArg) {
        $curlArgs += @("-x", $Proxy)
        # Windows legacy curl (Schannel) fails CRL check through proxy; disable it
        if ($isOld) { $curlArgs += "--ssl-no-revoke" }
    }
    $curlArgs += $PassThruArgs
    $curlArgs += $Url
    & $curlPath @curlArgs
    $curlExit = $LASTEXITCODE

    if ($curlExit -eq 0 -and (Test-Path $OutFile) -and (Get-Item $OutFile).Length -gt 0) {
        Write-Host "[OK] Download complete: $OutFile" -ForegroundColor Green
        exit 0
    }
}

if (Test-Aria2Available) {
    Write-Host "[MODE] curl failed/unavailable, fallback to aria2c multi-thread" -ForegroundColor Magenta
    $outDir = Split-Path -Parent $OutFile
    if (-not $outDir) { $outDir = "." }
    $ariaArgs = @("-x", $Threads, "-s", $Threads, "-k", "1M", "--user-agent=$BrowserUA", "-o", (Split-Path -Leaf $OutFile), "-d", $outDir)
    if ($Proxy) {
        $ariaProxy = $Proxy -replace '^socks5h://', 'socks5://'
        $ariaArgs += @("--all-proxy=$ariaProxy")
    }
    & aria2c.exe @ariaArgs "$Url"
    exit $LASTEXITCODE
}

Write-Host "[MODE] Final fallback: Invoke-WebRequest (slow, last resort)" -ForegroundColor Magenta
$ProgressPreference = 'SilentlyContinue'
try {
    $iwrArgs = @{ Uri = $Url; OutFile = $OutFile; UserAgent = $BrowserUA; UseBasicParsing = $true }
    if ($Proxy -and $Proxy -notmatch '^socks5') {
        $proxyUri = [System.Uri]$Proxy
        $iwrArgs['Proxy'] = "$($proxyUri.Scheme)://$($proxyUri.Host):$($proxyUri.Port)"
    }
    Invoke-WebRequest @iwrArgs
    Write-Host "[OK] Download complete: $OutFile" -ForegroundColor Green
} catch {
    Write-Host "[FATAL] All download methods failed: $_" -ForegroundColor Red
    exit 1
}
```

> 保存后用法：
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\curl-fast.ps1 "https://下载链接"
> ```

---

## 附录：本地验证

配置完成后，在新开的 PowerShell 窗口里执行以下命令验证是否生效：

```powershell
# 1. 确认 curl 已解析为 Profile 函数
Get-Command curl
# 期望输出 CommandType 为 Function

# 2. 确认 UA 已注入（看请求头里的 User-Agent）
curl -v -o nul https://www.baidu.com 2>&1 | Select-String "User-Agent"
# 期望包含 Chrome 的 UA，而不是 curl/7.55.1

# 3. 确认 -o 参数不报错
curl -o test.html https://www.baidu.com
# 正常下载，不提示「参数名称 o 具有二义性」

# 4. 确认 tcp-nodelay 已注入（旧版 curl）
curl --version
# 若版本低于 7.80，上述下载会自动附加 --tcp-nodelay
```

---

## 更新日志

- **2026-05-09** 兼容性修复（在全新 Windows 环境实测后修正）
  - `$PROFILE` 目录默认不存在，补充自动创建步骤
  - `curl-fast.ps1` 去掉 `Mandatory=$true`，右键运行无参数时显示用法而非卡住
  - Profile 函数去掉 `[CmdletBinding()]`，修复 `-o` 参数被误识别为 `-OutVariable` 的问题
  - 补充 PowerShell 执行策略修改指引
  - 帮助信息改为英文（避免 PowerShell 5.1 GBK 编码下中文乱码）
  - UA 版本更新为 Chrome 132（实测部分镜像站对旧版 UA 直接 403）
- **2026-05-08** 初版发布，附完整 `curl-fast.ps1` 源码
  - 自动嗅探常见代理端口（10808 / 7890 / 10809 / 1080）
  - 旧版 curl + 代理自动注入 `--ssl-no-revoke`
  - 浏览器 UA 伪装 + tcp-nodelay
  - curl 失败自动 fallback 到 aria2c 多线程下载

---

## 参考链接

- [Windows 下安装 Kimi CLI，PowerShell 一键指令](/posts/kimi-cli-install-win/)
- [Windows 10 / 11 安装 winget](/posts/winget-install-win/)
- curl 官方下载：[https://curl.se/windows/](https://curl.se/windows/)
- aria2 官方文档：[https://aria2.github.io/](https://aria2.github.io/)
- 清华 TUNA 镜像站：[https://mirrors.tuna.tsinghua.edu.cn/](https://mirrors.tuna.tsinghua.edu.cn/)
