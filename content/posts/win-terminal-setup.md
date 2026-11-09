---
title: 还原机房 PowerShell 7 + Windows Terminal 极速配置
date: 2026-04-29
tags: [windows, terminal, powershell, utf-8, github-proxy, 还原机房]
---

## 环境信息

| 项目     | 说明                                                  |
| -------- | ----------------------------------------------------- |
| **系统** | Windows 10 / 11（64 位）                              |
| **权限** | 管理员（还原卡环境，重启还原）                        |
| **场景** | 机房、OS-Easy 还原卡                                  |
| **目标** | PowerShell 7 + Windows Terminal + 强制 UTF-8          |
| **网络** | 教育网镜像优先；Windows Terminal 使用 GitHub 代理回退 |

---

## 一键脚本（复制即用）

> ⚠️ **必须以管理员身份运行 PowerShell**（右键 → 以管理员身份运行），否则 PS7 MSI 安装会失败。

在 PowerShell 里复制粘贴执行（支持 PowerShell 5.1 老窗口）：

```powershell
$ErrorActionPreference = "Stop"

function Get-VerifiedFile {
    param(
        [string[]]$Urls,
        [string]$OutFile,
        [string]$Sha256
    )

    if (Test-Path $OutFile) {
        if ((Get-FileHash $OutFile -Algorithm SHA256).Hash -ieq $Sha256) {
            Write-Host ">>> 已存在校验通过的安装包：$OutFile" -ForegroundColor Green
            return
        }
        Remove-Item $OutFile -Force
    }

    $part = "$OutFile.part"
    $curlHelp = & curl.exe --help all 2>$null | Out-String
    $revokeFallback = if ($curlHelp -match '--ssl-revoke-best-effort') {
        '--ssl-revoke-best-effort'
    } else {
        '--ssl-no-revoke'
    }
    foreach ($downloadUrl in $Urls) {
        Remove-Item $part -Force -ErrorAction SilentlyContinue
        Write-Host "Trying $downloadUrl ..." -ForegroundColor DarkGray
        & curl.exe --fail --location --silent --show-error --connect-timeout 10 --max-time 300 --retry 1 --output $part $downloadUrl
        if ($LASTEXITCODE -eq 60) {
            Write-Host ">>> curl 证书验证失败，使用 $revokeFallback 重试（仍校验 CA、域名和有效期）。" -ForegroundColor Yellow
            & curl.exe --fail --location --silent --show-error --connect-timeout 10 --max-time 300 --retry 1 $revokeFallback --output $part $downloadUrl
        }
        if ($LASTEXITCODE -eq 0 -and (Test-Path $part)) {
            $actualHash = (Get-FileHash $part -Algorithm SHA256).Hash
            if ($actualHash -ieq $Sha256) {
                Move-Item $part $OutFile -Force
                Write-Host ">>> 下载及 SHA256 校验成功。" -ForegroundColor Green
                return
            }
            Write-Host "SHA256 不匹配：$actualHash" -ForegroundColor Red
        }
    }

    Remove-Item $part -Force -ErrorAction SilentlyContinue
    throw "所有下载源均失败或校验不通过：$OutFile"
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "请以管理员身份运行 PowerShell（右键 → 以管理员身份运行），否则 MSI 安装会失败。"
}

$temp = "$env:TEMP\termsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# --- 1. PowerShell 7：CERNET 清单节点优先 ---
$ps7Dir = "C:\Program Files\PowerShell\7"
$ps7Exe = "$ps7Dir\pwsh.exe"
$ps7Ver = "7.6.9"
$ps7Hash = "50D33C7494AAF82B987CFD4DE3F232D04F91FDD4C0DEECA8A669CCED3E7CF8F9"

if (-not (Test-Path $ps7Exe)) {
    $ps7Out = "$temp\PowerShell-$ps7Ver-win-x64.msi"
    $ps7Urls = @(
        "https://mirrors.sdu.edu.cn/github-release/PowerShell_PowerShell/v$ps7Ver/PowerShell-$ps7Ver-win-x64.msi",
        "https://mirror.nju.edu.cn/github-release/PowerShell/PowerShell/v$ps7Ver%20Release%20of%20PowerShell/PowerShell-$ps7Ver-win-x64.msi",
        "https://v4.gh-proxy.org/https://github.com/PowerShell/PowerShell/releases/download/v$ps7Ver/PowerShell-$ps7Ver-win-x64.msi"
    )
    Write-Host ">>> 下载并安装 PowerShell $ps7Ver..." -ForegroundColor Cyan
    Get-VerifiedFile -Urls $ps7Urls -OutFile $ps7Out -Sha256 $ps7Hash
    $proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$ps7Out`"", "/qn", "ADD_EXPLORER_CONTEXT_MENU=1", "REBOOT=ReallySuppress" -Wait -PassThru
    if ($proc.ExitCode -notin @(0, 3010)) {
        throw "PowerShell $ps7Ver 安装失败，退出码：$($proc.ExitCode)"
    }
} else {
    Write-Host ">>> PowerShell 7 已存在，跳过安装。" -ForegroundColor Green
}

[Environment]::SetEnvironmentVariable('POWERSHELL_UPDATECHECK', 'Off', 'Machine')

# --- 2. Windows Terminal：代理回退，逐源校验 SHA256 ---
$wtVer = "1.21.3231.0"
$wtZip = "$temp\WindowsTerminal_x64.zip"
$wtHash = "8FB268B93C9B99D6CF553709C2C58BF1B2FF4B364199152E09221DFB2A44BBF5"
$wtGitHubUrl = "https://github.com/microsoft/terminal/releases/download/v$wtVer/Microsoft.WindowsTerminal_$($wtVer)_x64.zip"
$wtUrls = @(
    "https://v4.gh-proxy.org/$wtGitHubUrl",
    "https://gh-proxy.org/$wtGitHubUrl",
    "https://ghfast.top/$wtGitHubUrl",
    $wtGitHubUrl
)

Write-Host ">>> 下载 Windows Terminal $wtVer..." -ForegroundColor Cyan
Get-VerifiedFile -Urls $wtUrls -OutFile $wtZip -Sha256 $wtHash
$wtDest = "$env:LOCALAPPDATA\WindowsTerminal"
Expand-Archive -Path $wtZip -DestinationPath $wtDest -Force

# --- 3. 写 PowerShell 7 Profile（强制 UTF-8）---
$ps7ProfileDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) "PowerShell"
New-Item -ItemType Directory -Force -Path $ps7ProfileDir | Out-Null
$profilePath = "$ps7ProfileDir\Microsoft.PowerShell_profile.ps1"
if (Test-Path $profilePath) {
    $backup = "$profilePath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $profilePath $backup -Force
    Write-Host ">>> 已备份原 Profile 到 $backup" -ForegroundColor Yellow
}
$profileContent = @"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
`$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
"@
Set-Content -Path $profilePath -Value $profileContent -Encoding UTF8

# --- 4. 写 Windows Terminal settings.json ---
$wtSettingsDir = "$env:LOCALAPPDATA\Microsoft\Windows Terminal"
New-Item -ItemType Directory -Force -Path $wtSettingsDir | Out-Null
$wtSettingsPath = "$wtSettingsDir\settings.json"
if (Test-Path $wtSettingsPath) {
    $backup = "$wtSettingsPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $wtSettingsPath $backup -Force
    Write-Host ">>> 已备份原 settings.json 到 $backup" -ForegroundColor Yellow
}
$settingsJson = @'
{
  "$help": "https://aka.ms/terminal-documentation",
  "$schema": "https://aka.ms/terminal-profiles-schema",
  "actions": [
    { "command": { "action": "copy", "singleLine": false }, "keys": "ctrl+c" },
    { "command": "paste", "keys": "ctrl+v" },
    { "command": "find", "keys": "ctrl+shift+f" }
  ],
  "copyFormatting": "none",
  "defaultProfile": "{574e775e-4f2a-5b96-ac1e-a2962a402336}",
  "profiles": {
    "defaults": {
      "colorScheme": "One Half Dark",
      "opacity": 90,
      "useAcrylic": true,
      "startingDirectory": "%USERPROFILE%"
    },
    "list": [
      {
        "guid": "{574e775e-4f2a-5b96-ac1e-a2962a402336}",
        "hidden": false,
        "name": "PowerShell 7",
        "source": "Windows.Terminal.PowershellCore"
      },
      {
        "guid": "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}",
        "name": "Windows PowerShell"
      },
      {
        "guid": "{0caa0dad-35be-5f56-a8ff-afceeeaa6101}",
        "name": "Command Prompt",
        "commandline": "cmd.exe"
      }
    ]
  }
}
'@
Set-Content -Path $wtSettingsPath -Value $settingsJson -Encoding UTF8

# --- 5. 创建桌面快捷方式 ---
$wtExe = "$wtDest\terminal-$wtVer\WindowsTerminal.exe"
if (-not (Test-Path $wtExe)) {
    throw "WindowsTerminal.exe 未找到：$wtExe，请检查解压目录内容。"
}
$WshShell = New-Object -ComObject WScript.Shell
$SC = $WshShell.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Terminal.lnk")
$SC.TargetPath = $wtExe
$SC.WorkingDirectory = "$wtDest\terminal-$wtVer"
$SC.IconLocation = $wtExe
$SC.Save()

Write-Host ">>> 完成！双击桌面的 'Terminal' 快捷方式即可使用。" -ForegroundColor Green
```

> **提示**：脚本运行期间请不要关闭窗口。某个下载源失败时会自动切换；所有安装包均需通过 SHA256 校验后才会安装。

---

## 分步详解

### 1. 安装 PowerShell 7（全新安装为 7.6.9）

Windows 自带的 PowerShell 5.1 默认编码是 GBK，Unicode 支持差、很多新语法不支持。主脚本首选 CERNET github-release（`https://mirrors.cernet.edu.cn/github-release/`）清单中的 SDU 节点，失败后切换 NJU 或 `v4.gh-proxy.org`；检测到任意已有 PowerShell 7 时会跳过安装。

如果 Schannel 因证书吊销列表不可达而使 `curl` 返回 60，下载函数会自动使用 `--ssl-revoke-best-effort` 重试；旧版 `curl` 不支持该参数时退到 `--ssl-no-revoke`。CA、域名、有效期和安装包 SHA256 校验始终保留，不安装额外根证书，也不使用 `--insecure`。

```powershell
msiexec /i "PowerShell-<版本>-win-x64.msi" /qn ADD_EXPLORER_CONTEXT_MENU=1
```

| 参数                          | 含义                                  |
| ----------------------------- | ------------------------------------- |
| `/qn`                         | 静默安装，无弹窗                      |
| `ADD_EXPLORER_CONTEXT_MENU=1` | 右键菜单添加"在此处打开 PowerShell 7" |

安装后本体位于 `C:\Program Files\PowerShell\7\pwsh.exe`，与系统自带的 5.1 互不冲突。

脚本还会设置系统环境变量 `POWERSHELL_UPDATECHECK=Off`，关掉启动时的"有新版本"提示：还原机房升级留不住，而且部分版本（实测 7.6.6）画这个提示框时会直接崩溃。

### 2. 安装 Windows Terminal（Unpackaged）

Windows Terminal 是微软官方的现代终端，支持多标签页、GPU 加速、背景毛玻璃。

Unpackaged 版是绿色免安装，解压后直接 `WindowsTerminal.exe` 启动，**不依赖 AppX 框架**，还原机房最稳妥。

### 3. 强制 UTF-8，根治 GBK 乱码

Windows 中文版默认代码页是 **GBK (936)**，这会导致：

- `git log` 中文乱码
- `python`、`npm`、`cargo` 等现代工具输出异常
- 复制粘贴到剪贴板的内容编码错乱

在 PowerShell 7 Profile 顶部加入：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
```

这样每个新开的 Terminal 标签页内部都是 UTF-8，不影响系统其他程序。

### 4. 配置文件位置速查

| 配置项                    | 路径                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| **Windows Terminal 设置** | `%LOCALAPPDATA%\Microsoft\Windows Terminal\settings.json`             |
| **PowerShell 7 Profile**  | `%USERPROFILE%\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` |
| **Unpackaged Terminal**   | `%LOCALAPPDATA%\WindowsTerminal\terminal-<版本>\WindowsTerminal.exe`  |

---

## 常见问题 FAQ

### Q1：双击桌面 Terminal 没反应？

直接运行（将 `<版本>` 替换为实际目录名）：

```powershell
& "$env:LOCALAPPDATA\WindowsTerminal\terminal-<版本>\WindowsTerminal.exe"
```

### Q2：PowerShell 7 里中文还是乱码？

检查 Profile 是否已加载。在 Terminal 里执行：

```powershell
[Console]::OutputEncoding
```

应输出 `System.Text.UTF8Encoding`。如果不是，检查文件路径：

```
%USERPROFILE%\Documents\PowerShell\Microsoft.PowerShell_profile.ps1
```

### Q3：重启后所有配置都消失了？

还原卡环境，关机后 C 盘自动还原。**每次开机后重新运行一遍一键脚本**（约 1 分钟）即可。

### Q4：PowerShell 7 一打开就崩，报 `totalWidth ('-17') must be a non-negative value`？

这是 PowerShell 自身的 bug：检测到新版本后画更新提示框时宽度算成负数（实测 7.6.6 有新版 7.6.8 时触发）。用 Windows PowerShell 5.1（管理员）执行：

```powershell
[Environment]::SetEnvironmentVariable('POWERSHELL_UPDATECHECK', 'Off', 'Machine')
Remove-Item "$env:LOCALAPPDATA\Microsoft\PowerShell\*\update*" -Force -ErrorAction SilentlyContinue
```

然后**关掉整个 Terminal 再重开**（新环境变量才生效）。新版脚本已默认关闭更新检查。

---

## 附录：纯 GitHub 代理版脚本（保留 PowerShell 7.4.6）

上面的主脚本已经内置教育网镜像和代理回退，通常无需使用本附录。只有需要保留旧版 **PowerShell 7.4.6** 时，才使用下面的纯代理备选脚本。

> Windows Terminal 的代理顺序为 `v4.gh-proxy.org` → `gh-proxy.org` → `ghfast.top` → GitHub 直连。代理地址均拼在完整 GitHub URL 前，例如：
>
> ```text
> https://v4.gh-proxy.org/https://github.com/xxx/xxx/releases/download/...
> ```

### 代理版一键脚本（复制即用）

```powershell
# 自动 fallback 下载函数
# 每个源下载后立即校验 SHA256，失效代理返回的错误页不会被当成成功
function Get-WithProxy {
    param([string]$Url, [string]$OutFile, [string]$Sha256)
    $oldProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try {
        $proxies = @(
            "https://v4.gh-proxy.org/",
            "https://gh-proxy.org/",
            "https://ghfast.top/",
            ""  # 最后直连 GitHub
        )
        foreach ($p in $proxies) {
            $tryUrl = "$p$Url"
            Write-Host "Trying $tryUrl ..." -ForegroundColor DarkGray
            try {
                Invoke-WebRequest -Uri $tryUrl -OutFile $OutFile -UseBasicParsing -TimeoutSec 300 -ErrorAction Stop
                if ((Get-FileHash $OutFile -Algorithm SHA256).Hash -eq $Sha256) {
                    Write-Host "Success via $(if ($p) { $p } else { 'GitHub 直连' })" -ForegroundColor Green
                    return
                }
                Write-Host "SHA256 不匹配（代理可能返回了错误页），换下一个源" -ForegroundColor Red
            } catch { Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red }
            Remove-Item $OutFile -Force -ErrorAction SilentlyContinue
        }
        throw "所有下载源均失败或校验不通过：$Url"
    } finally {
        $ProgressPreference = $oldProgress
    }
}

# 检测管理员权限
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "请以管理员身份运行 PowerShell（右键 → 以管理员身份运行），否则 MSI 安装会失败。"
}

# 创建临时目录
$temp = "$env:TEMP\termsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# 版本号与 SHA256（升级时需同步更新）
$ps7Ver = "7.4.6"
$wtVer  = "1.21.3231.0"

# --- 1. 下载并安装 PowerShell 7.4 ---
$ps7Url = "https://github.com/PowerShell/PowerShell/releases/download/v$ps7Ver/PowerShell-$ps7Ver-win-x64.msi"
$ps7Out = "$temp\PowerShell-$ps7Ver-win-x64.msi"
if (Test-Path $ps7Out) { Remove-Item $ps7Out -Force }
Write-Host ">>> 下载 PowerShell $ps7Ver..." -ForegroundColor Cyan
Get-WithProxy -Url $ps7Url -OutFile $ps7Out -Sha256 "ed331a04679b83d4c013705282d1f3f8d8300485eb04c081f36e11eaf1148bd0"
Write-Host ">>> 安装 PowerShell $ps7Ver..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$ps7Out`"", "/qn", "ADD_EXPLORER_CONTEXT_MENU=1", "REBOOT=ReallySuppress" -Wait -PassThru
$exitCode = $proc.ExitCode
if ($exitCode -notin @(0, 3010)) {
    throw "PowerShell $ps7Ver 安装失败，退出码: $exitCode"
}
if ($exitCode -eq 0) {
    Write-Host ">>> PS7 已安装成功，无需重启，当前即可使用。" -ForegroundColor Green
}
if ($exitCode -eq 3010) {
    Write-Host ">>> PS7 已安装成功，但安装程序提示需要重启（退出码 3010）。当前已禁止自动重启（REBOOT=ReallySuppress），可继续使用。" -ForegroundColor Green
    Write-Host ">>> ⚠️ 还原卡环境：重启后需重新运行本脚本。" -ForegroundColor Yellow
}

# 关闭 PS7 启动时的更新检查：还原机房升级留不住，且部分版本（实测 7.6.6）显示更新提示时会直接崩溃
[Environment]::SetEnvironmentVariable('POWERSHELL_UPDATECHECK', 'Off', 'Machine')

# --- 2. 下载并解压 Windows Terminal ---
$wtZip = "$temp\WindowsTerminal_x64.zip"
if (Test-Path $wtZip) { Remove-Item $wtZip -Force }
Write-Host ">>> 下载 Windows Terminal $wtVer..." -ForegroundColor Cyan
Get-WithProxy -Url "https://github.com/microsoft/terminal/releases/download/v$wtVer/Microsoft.WindowsTerminal_$($wtVer)_x64.zip" -OutFile $wtZip -Sha256 "8FB268B93C9B99D6CF553709C2C58BF1B2FF4B364199152E09221DFB2A44BBF5"
$wtDest = "$env:LOCALAPPDATA\WindowsTerminal"
Expand-Archive -Path $wtZip -DestinationPath $wtDest -Force

# --- 3. PS7 Profile（UTF-8）---
$ps7ProfileDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) "PowerShell"
New-Item -ItemType Directory -Force -Path $ps7ProfileDir | Out-Null
$profilePath = "$ps7ProfileDir\Microsoft.PowerShell_profile.ps1"
if (Test-Path $profilePath) {
    $backup = "$profilePath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $profilePath $backup -Force
    Write-Host ">>> 已备份原 Profile 到 $backup" -ForegroundColor Yellow
}
$profileContent = @"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
`$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
"@
Set-Content -Path $profilePath -Value $profileContent -Encoding UTF8

# --- 4. Terminal settings.json ---
$wtSettingsDir = "$env:LOCALAPPDATA\Microsoft\Windows Terminal"
New-Item -ItemType Directory -Force -Path $wtSettingsDir | Out-Null
$wtSettingsPath = "$wtSettingsDir\settings.json"
if (Test-Path $wtSettingsPath) {
    $backup = "$wtSettingsPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $wtSettingsPath $backup -Force
    Write-Host ">>> 已备份原 settings.json 到 $backup" -ForegroundColor Yellow
}
$settingsJson = @'
{
  "$help": "https://aka.ms/terminal-documentation",
  "$schema": "https://aka.ms/terminal-profiles-schema",
  "actions": [
    { "command": { "action": "copy", "singleLine": false }, "keys": "ctrl+c" },
    { "command": "paste", "keys": "ctrl+v" },
    { "command": "find", "keys": "ctrl+shift+f" }
  ],
  "copyFormatting": "none",
  "defaultProfile": "{574e775e-4f2a-5b96-ac1e-a2962a402336}",
  "profiles": {
    "defaults": {
      "colorScheme": "One Half Dark",
      "opacity": 90,
      "useAcrylic": true,
      "startingDirectory": "%USERPROFILE%"
    },
    "list": [
      {
        "guid": "{574e775e-4f2a-5b96-ac1e-a2962a402336}",
        "hidden": false,
        "name": "PowerShell 7",
        "source": "Windows.Terminal.PowershellCore"
      },
      {
        "guid": "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}",
        "name": "Windows PowerShell"
      },
      {
        "guid": "{0caa0dad-35be-5f56-a8ff-afceeeaa6101}",
        "name": "Command Prompt",
        "commandline": "cmd.exe"
      }
    ]
  }
}
'@
Set-Content -Path $wtSettingsPath -Value $settingsJson -Encoding UTF8

# --- 5. 桌面快捷方式 ---
$wtExe = "$wtDest\terminal-$wtVer\WindowsTerminal.exe"
if (-not (Test-Path $wtExe)) {
    throw "WindowsTerminal.exe 未找到: $wtExe，请检查解压目录内容。"
}
$WshShell = New-Object -ComObject WScript.Shell
$SC = $WshShell.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Terminal.lnk")
$SC.TargetPath = $wtExe
$SC.WorkingDirectory = "$wtDest\terminal-$wtVer"
$SC.IconLocation = $wtExe
$SC.Save()

Write-Host ">>> 完成！双击桌面 'Terminal' 即可使用。" -ForegroundColor Green
```

> **代理站优先级**：默认先走 `v4.gh-proxy.org`，失败后依次尝试 `gh-proxy.org`、`ghfast.top` 和 GitHub 直连。每个源下载完都会校验 SHA256，代理返回错误页也会自动换下一个。
>
> 如果你那边某个代理特别快，可以调整 `Get-WithProxy` 函数里 `$proxies` 数组的顺序。

---

## 更新日志

- **2026-11-09** 修复：
  - 主脚本改为教育网镜像优先，PowerShell 全新安装版本更新为 7.6.9；已有 PowerShell 7 直接跳过
  - `curl` 返回 60 时自动使用 `--ssl-revoke-best-effort` 重试，旧版退到 `--ssl-no-revoke`，修复 Schannel 吊销检查失败；保留 CA、域名、有效期和 SHA256 校验
  - 主脚本改用 `curl.exe` 和 `.part` 临时文件，每个完整 URL 下载后立即校验 SHA256，避免 504 错误页或半截安装包中断安装
  - Windows Terminal 保留 `v4.gh-proxy.org` → `gh-proxy.org` → `ghfast.top` → 直连的回退链；CERNET 清单中暂未找到对应镜像
  - 原代理版脚本移至纯代理备选，保留 PowerShell 7.4.6，不再与主脚本同步变更
  - 已在 Windows 10 1909 + PowerShell 5.1 实测：Windows Terminal 正常启动，PowerShell 7 UTF-8 配置生效
- **2026-10-30** 修复：
  - 两个脚本均关闭 PS7 更新检查，避免更新提示框崩溃（新增 FAQ Q4）
  - 代理版下载函数改为每个源下载后立即校验 SHA256，失效代理返回错误页时自动换下一个源（原逻辑只看文件 >1KB，会被错误页骗过后直接校验失败退出）
  - 代理列表移除已失效的 `mirror.ghproxy.com`、`ghp.ci`，补充 `ghfast.top`、`gh.llkk.cc`
  - Profile 目录改用系统"文档"真实路径，兼容文档被重定向到其他盘/OneDrive
- **2026-05-14** 极速精简：
  - 砍掉字体下载/解压/注册整节（系统自带 Consolas + Segoe UI Emoji 已够用）
  - 砍掉 Oh My Posh 美化（还原机房外观其次，功能优先）
  - 砍掉 msixbundle 双保险（只保留 Unpackaged 版，最稳妥）
  - 合并分步详解为 4 节，FAQ 砍到 3 个
  - 代理版脚本同步精简并后移至附录
  - 经本地 PS5.1 + conhost 实测：Profile 加载后 UTF-8 生效，中文/Emoji 正常

---

> 在 Windows 10/11 还原机房一键安装 Windows Terminal + PowerShell 7，强制 UTF-8 根治 GBK 乱码。
>
> 复制脚本 → 粘贴 → 回车，获得一个带多标签页、UTF-8、中文/Emoji 正常显示的现代化终端。

---
