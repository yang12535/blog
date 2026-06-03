---
title: 还原机房 PowerShell 7 + Windows Terminal 极速配置
date: 2026-04-29
tags: [windows, terminal, powershell, utf-8, github-proxy, 还原机房]

---

## 环境信息

| 项目 | 说明 |
| --- | --- |
| **系统** | Windows 10 / 11（64 位） |
| **权限** | 管理员（还原卡环境，重启还原） |
| **场景** | 机房、OS-Easy 还原卡 |
| **目标** | PowerShell 7 + Windows Terminal + 强制 UTF-8 |
| **网络** | 能访问 GitHub 即可（Release 直链） |

---

## 一键脚本（复制即用）

> ⚠️ **必须以管理员身份运行 PowerShell**（右键 → 以管理员身份运行），否则 PS7 MSI 安装会失败。

在 PowerShell 里复制粘贴执行（支持 PowerShell 5.1 老窗口）：

```powershell
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
Invoke-WebRequest -Uri $ps7Url -OutFile $ps7Out -UseBasicParsing -ErrorAction Stop -TimeoutSec 300
$ps7Hash = "ed331a04679b83d4c013705282d1f3f8d8300485eb04c081f36e11eaf1148bd0"
if ((Get-FileHash $ps7Out -Algorithm SHA256).Hash -ne $ps7Hash) {
    throw "PowerShell $ps7Ver 安装包 SHA256 校验失败"
}
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

# --- 2. 下载并解压 Windows Terminal（Unpackaged）---
$wtZip = "$temp\WindowsTerminal_x64.zip"
$wtUrl = "https://github.com/microsoft/terminal/releases/download/v$wtVer/Microsoft.WindowsTerminal_$($wtVer)_x64.zip"
if (Test-Path $wtZip) { Remove-Item $wtZip -Force }
Write-Host ">>> 下载 Windows Terminal $wtVer..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $wtUrl -OutFile $wtZip -UseBasicParsing -ErrorAction Stop -TimeoutSec 300
$wtZipHash = "8FB268B93C9B99D6CF553709C2C58BF1B2FF4B364199152E09221DFB2A44BBF5"
if ((Get-FileHash $wtZip -Algorithm SHA256).Hash -ne $wtZipHash) {
    throw "Windows Terminal zip SHA256 校验失败"
}
$wtDest = "$env:LOCALAPPDATA\WindowsTerminal"
Expand-Archive -Path $wtZip -DestinationPath $wtDest -Force

# --- 3. 写 PowerShell 7 Profile（强制 UTF-8）---
$ps7ProfileDir = "$env:USERPROFILE\Documents\PowerShell"
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
    throw "WindowsTerminal.exe 未找到: $wtExe，请检查解压目录内容。"
}
$WshShell = New-Object -ComObject WScript.Shell
$SC = $WshShell.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Terminal.lnk")
$SC.TargetPath = $wtExe
$SC.WorkingDirectory = "$wtDest\terminal-$wtVer"
$SC.IconLocation = $wtExe
$SC.Save()

Write-Host ">>> 完成！双击桌面的 'Terminal' 快捷方式即可使用。" -ForegroundColor Green
```

> **提示**：脚本运行期间请不要关闭窗口。由于是从 GitHub 下载，若网络较慢请耐心等待。

---

## 分步详解

### 1. 安装 PowerShell 7.4

Windows 自带的 PowerShell 5.1 默认编码是 GBK，Unicode 支持差、很多新语法不支持。

```powershell
msiexec /i "PowerShell-<版本>-win-x64.msi" /qn ADD_EXPLORER_CONTEXT_MENU=1
```

| 参数 | 含义 |
| --- | --- |
| `/qn` | 静默安装，无弹窗 |
| `ADD_EXPLORER_CONTEXT_MENU=1` | 右键菜单添加"在此处打开 PowerShell 7" |

安装后本体位于 `C:\Program Files\PowerShell\7\pwsh.exe`，与系统自带的 5.1 互不冲突。

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

| 配置项 | 路径 |
| --- | --- |
| **Windows Terminal 设置** | `%LOCALAPPDATA%\Microsoft\Windows Terminal\settings.json` |
| **PowerShell 7 Profile** | `%USERPROFILE%\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` |
| **Unpackaged Terminal** | `%LOCALAPPDATA%\WindowsTerminal\terminal-<版本>\WindowsTerminal.exe` |

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

---

## 附录：国内 GitHub 代理版脚本

如果上述脚本里的 GitHub 直链在你那边下载极慢或超时，使用此版本。**内置多个代理站自动 fallback**，走不通就换下一个，最后才尝试直连。

> 目前测试可用的文件下载代理：`gh-proxy.org`（主站）、`mirror.ghproxy.com`、`ghproxy.net`、`ghp.ci`。用法均为在原链接前拼接代理域名，如：
> ```
> https://gh-proxy.org/https://github.com/xxx/xxx/releases/download/...
> ```

### 代理版一键脚本（复制即用）

```powershell
# 自动 fallback 下载函数
function Get-WithProxy {
    param([string]$Url, [string]$OutFile)
    $oldProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'
    try {
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
                Invoke-WebRequest -Uri $proxyUrl -OutFile $OutFile -UseBasicParsing -TimeoutSec 120 -ErrorAction Stop
                if ((Get-Item $OutFile).Length -gt 1024) {
                    Write-Host "Success via $p" -ForegroundColor Green
                    return
                }
            } catch { Write-Host "Failed via $p : $($_.Exception.Message)" -ForegroundColor Red }
        }
        Write-Host "Trying direct download..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -ErrorAction Stop -TimeoutSec 300
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
Get-WithProxy -Url $ps7Url -OutFile $ps7Out
$ps7Hash = "ed331a04679b83d4c013705282d1f3f8d8300485eb04c081f36e11eaf1148bd0"
if ((Get-FileHash $ps7Out -Algorithm SHA256).Hash -ne $ps7Hash) {
    throw "PowerShell $ps7Ver 安装包 SHA256 校验失败"
}
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

# --- 2. 下载并解压 Windows Terminal ---
$wtZip = "$temp\WindowsTerminal_x64.zip"
if (Test-Path $wtZip) { Remove-Item $wtZip -Force }
Write-Host ">>> 下载 Windows Terminal $wtVer..." -ForegroundColor Cyan
Get-WithProxy -Url "https://github.com/microsoft/terminal/releases/download/v$wtVer/Microsoft.WindowsTerminal_$($wtVer)_x64.zip" -OutFile $wtZip
$wtZipHash = "8FB268B93C9B99D6CF553709C2C58BF1B2FF4B364199152E09221DFB2A44BBF5"
if ((Get-FileHash $wtZip -Algorithm SHA256).Hash -ne $wtZipHash) {
    throw "Windows Terminal zip SHA256 校验失败"
}
$wtDest = "$env:LOCALAPPDATA\WindowsTerminal"
Expand-Archive -Path $wtZip -DestinationPath $wtDest -Force

# --- 3. PS7 Profile（UTF-8）---
$ps7ProfileDir = "$env:USERPROFILE\Documents\PowerShell"
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

> **代理站优先级**：默认先走 `gh-proxy.org`（目前最稳），失败自动切 `mirror.ghproxy.com` → `ghproxy.net` → `ghp.ci`，全部挂掉才走 GitHub 直连。
>
> 如果你那边某个代理特别快，可以把 `Get-WithProxy` 函数里 `$proxies` 数组的顺序调一下，把最快的放第一。

---

## 更新日志

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
