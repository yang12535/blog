---
title: Windows Terminal + PowerShell 7 一键安装配置指南
date: 2026-04-29
tags: [windows, terminal, powershell, oh-my-posh, nerd-font, utf-8, github-proxy]


---

## 环境信息

| 项目 | 说明 |
| --- | --- |
| **系统** | Windows 10 / Windows 11（64 位） |
| **权限** | 普通用户即可（无需管理员，全程 0 弹窗） |
| **场景** | 机房、OS-Easy 还原卡、域控锁死环境 |
| **目标** | PowerShell 7 + Windows Terminal + Oh My Posh 美化 + 强制 UTF-8 |
| **网络** | 能访问 GitHub 即可（Release 直链） |

* * *

## 一键脚本（复制即用）

在 PowerShell 里复制粘贴执行（支持 PowerShell 5.1 老窗口）：

```powershell
# 创建临时目录
$temp = "$env:TEMP\termsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# 校验临时文件是否完整（不完整则自动删除）
function Test-ValidFile($Path, $MinBytes=1) {
    if (Test-Path $Path) {
        if ((Get-Item $Path).Length -ge $MinBytes) { return $true }
        Remove-Item $Path -Force
    }
    return $false
}

# --- 1. 下载并安装 PowerShell 7.4 ---
$ps7Url = "https://github.com/PowerShell/PowerShell/releases/download/v7.4.6/PowerShell-7.4.6-win-x64.msi"
$ps7Out = "$temp\PowerShell-7.4.6-win-x64.msi"
if (-not (Test-ValidFile $ps7Out 50MB)) {
    Write-Host ">>> 下载 PowerShell 7.4..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $ps7Url -OutFile $ps7Out -UseBasicParsing
}
Write-Host ">>> 安装 PowerShell 7.4..." -ForegroundColor Cyan
msiexec /i "$ps7Out" /qn ADD_EXPLORER_CONTEXT_MENU=1 ENABLE_PSREMOTING=1 REGISTER_MANIFEST=1

# --- 2. 下载并安装 Windows Terminal ---
$wtMsix = "$temp\WindowsTerminal.msixbundle"
$wtZip  = "$temp\WindowsTerminal_x64.zip"
if (-not (Test-ValidFile $wtMsix 10MB)) {
    Write-Host ">>> 下载 Windows Terminal (msixbundle)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/microsoft/terminal/releases/download/v1.21.3231.0/Microsoft.WindowsTerminal_1.21.3231.0_8wekyb3d8bbwe.msixbundle" -OutFile $wtMsix -UseBasicParsing
}
# 先尝试 msixbundle 安装（依赖已存在时可直接装上）
Add-AppxPackage -Path $wtMsix -ErrorAction SilentlyContinue

# --- 3. 同时准备 Unpackaged 版（防 msix 无法启动）---
if (-not (Test-ValidFile $wtZip 5MB)) {
    Write-Host ">>> 下载 Windows Terminal (Unpackaged 备用)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/microsoft/terminal/releases/download/v1.21.3231.0/Microsoft.WindowsTerminal_1.21.3231.0_x64.zip" -OutFile $wtZip -UseBasicParsing
}
$wtDest = "$env:LOCALAPPDATA\WindowsTerminal"
Expand-Archive -Path $wtZip -DestinationPath $wtDest -Force

# --- 4. 下载 Oh My Posh ---
$ompDir = "$env:LOCALAPPDATA\Programs\oh-my-posh"
New-Item -ItemType Directory -Force -Path $ompDir | Out-Null
$ompExe = "$ompDir\oh-my-posh.exe"
if (-not (Test-ValidFile $ompExe 5MB)) {
    Write-Host ">>> 下载 Oh My Posh..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/JanDeDobbeleer/oh-my-posh/releases/latest/download/posh-windows-amd64.exe" -OutFile $ompExe -UseBasicParsing
}

# --- 5. 下载 Nerd Font ---
$fontZip = "$temp\JetBrainsMono.zip"
if (-not (Test-ValidFile $fontZip 10MB)) {
    Write-Host ">>> 下载 JetBrainsMono Nerd Font..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/ryanoasis/nerd-fonts/releases/download/v3.2.1/JetBrainsMono.zip" -OutFile $fontZip -UseBasicParsing
}
$fontDest = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"
New-Item -ItemType Directory -Force -Path $fontDest | Out-Null
Expand-Archive -Path $fontZip -DestinationPath "$temp\JetBrainsMono" -Force
Get-ChildItem "$temp\JetBrainsMono" -Filter "*.ttf" | ForEach { Copy-Item $_.FullName -Destination $fontDest -Force }

# --- 6. 注册字体到系统（让 Windows Terminal 能识别）---
$shell = New-Object -ComObject Shell.Application
$fontFolder = $shell.Namespace(0x14)
Get-ChildItem $fontDest -Filter "*JetBrains*" | ForEach { $fontFolder.CopyHere($_.FullName, 0x10) }

# --- 7. 下载 Oh My Posh 主题 ---
$themeDir = "$ompDir\themes"
New-Item -ItemType Directory -Force -Path $themeDir | Out-Null
$themeFile = "$themeDir\powerlevel10k_rainbow.omp.json"
if (-not (Test-ValidFile $themeFile 1KB)) {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/powerlevel10k_rainbow.omp.json" -OutFile $themeFile -UseBasicParsing
}

# --- 8. 写 PowerShell 7 Profile（UTF-8 + OMP + PSReadLine）---
$ps7ProfileDir = "$env:USERPROFILE\Documents\PowerShell"
New-Item -ItemType Directory -Force -Path $ps7ProfileDir | Out-Null
$profileContent = @"
# 强制 UTF-8，根治 GBK 乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
`$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# Oh My Posh 主题
& "$ompExe" init pwsh --config "$themeFile" | Invoke-Expression

# 常用别名
Set-Alias ll Get-ChildItem
Set-Alias which Get-Command

# 历史预测
Set-PSReadLineOption -PredictionSource History
Set-PSReadLineOption -PredictionViewStyle ListView
"@
Set-Content -Path "$ps7ProfileDir\Microsoft.PowerShell_profile.ps1" -Value $profileContent -Encoding UTF8

# --- 9. 写 Windows Terminal settings.json ---
$wtSettingsDir = "$env:LOCALAPPDATA\Microsoft\Windows Terminal"
New-Item -ItemType Directory -Force -Path $wtSettingsDir | Out-Null
$settingsJson = @'
{
  "$help": "https://aka.ms/terminal-documentation",
  "$schema": "https://aka.ms/terminal-profiles-schema",
  "actions": [
    { "command": { "action": "copy", "singleLine": false }, "keys": "ctrl+c" },
    { "command": "paste", "keys": "ctrl+v" },
    { "command": "find", "keys": "ctrl+shift+f" },
    { "command": { "action": "splitPane", "split": "auto", "splitMode": "duplicate" }, "keys": "alt+shift+d" }
  ],
  "copyFormatting": "none",
  "defaultProfile": "{574e775e-4f2a-5b96-ac1e-a2962a402336}",
  "newTabMenu": [ { "type": "remainingProfiles" } ],
  "profiles": {
    "defaults": {
      "colorScheme": "One Half Dark",
      "font": { "face": "JetBrainsMono NF", "size": 12 },
      "opacity": 90,
      "useAcrylic": true,
      "padding": "8, 8, 8, 8",
      "cursorShape": "bar",
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
  },
  "schemes": [
    {
      "name": "One Half Dark",
      "background": "#282C34",
      "black": "#282C34",
      "blue": "#61AFEF",
      "brightBlack": "#5A6374",
      "brightBlue": "#61AFEF",
      "brightCyan": "#56B6C2",
      "brightGreen": "#98C379",
      "brightPurple": "#C678DD",
      "brightRed": "#E06C75",
      "brightWhite": "#DCDFE4",
      "brightYellow": "#E5C07B",
      "cursorColor": "#A3B3CC",
      "cyan": "#56B6C2",
      "foreground": "#DCDFE4",
      "green": "#98C379",
      "purple": "#C678DD",
      "red": "#E06C75",
      "selectionBackground": "#474E5D",
      "white": "#DCDFE4",
      "yellow": "#E5C07B"
    }
  ]
}
'@
Set-Content -Path "$wtSettingsDir\settings.json" -Value $settingsJson -Encoding UTF8

# --- 10. 创建桌面快捷方式（Unpackaged 版，确保能点开）---
$wtExe = "$wtDest\terminal-1.21.3231.0\WindowsTerminal.exe"
$WshShell = New-Object -ComObject WScript.Shell
$SC = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Terminal.lnk")
$SC.TargetPath = $wtExe
$SC.WorkingDirectory = "$wtDest\terminal-1.21.3231.0"
$SC.IconLocation = $wtExe
$SC.Save()

# --- 11. 可选：强制系统全局 UTF-8（需要重启，还原卡环境谨慎）---
# Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage" -Name "ACP" -Value "65001"
# Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage" -Name "OEMCP" -Value "65001"
# Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage" -Name "MACCP" -Value "65001"

Write-Host ">>> 完成！双击桌面的 'Terminal' 快捷方式即可使用。" -ForegroundColor Green
```

> **提示**：脚本运行期间请不要关闭窗口。由于是从 GitHub 下载，若网络较慢请耐心等待。

* * *

## 分步详解

### 1. 安装 PowerShell 7.4

Windows 自带的 PowerShell 5.1 是 2016 年的老东西，Unicode 支持差、换行逻辑诡异、很多新语法不支持。

```powershell
msiexec /i "PowerShell-7.4.6-win-x64.msi" /qn ADD_EXPLORER_CONTEXT_MENU=1 ENABLE_PSREMOTING=1 REGISTER_MANIFEST=1
```

| 参数 | 含义 |
| --- | --- |
| `/qn` | 静默安装，无弹窗 |
| `ADD_EXPLORER_CONTEXT_MENU=1` | 在资源管理器右键菜单添加"在此处打开 PowerShell 7" |
| `REGISTER_MANIFEST=1` | 注册事件日志清单 |

安装后本体位于 `C:\Program Files\PowerShell\7\pwsh.exe`，与系统自带的 5.1 互不冲突。

### 2. 安装 Windows Terminal

Windows Terminal 是微软官方的现代终端，支持多标签页、GPU 加速、背景毛玻璃、自定义配色。

**为什么装两份？**

| 版本 | 说明 |
| --- | --- |
| **MSIX 版** | 正规安装包，点开始菜单能启动，但依赖 Windows 的 AppX 框架。某些精简系统或权限受限环境可能点不开。 |
| **Unpackaged 版** | 绿色免安装，解压后直接 `WindowsTerminal.exe` 启动，不依赖 AppX，作为保底方案。 |

一键脚本里两者都准备了：先尝试 msixbundle，同时把 unpackaged 解压到 `%LOCALAPPDATA%\WindowsTerminal`，最后桌面快捷方式指向的是 unpackaged 版，**确保双击一定能打开**。

### 3. 安装 Oh My Posh

Oh My Posh 是一个跨平台的终端提示符美化引擎，用 Go 编写，单文件可执行，无需依赖。

```powershell
# 下载单文件 exe
Invoke-WebRequest -Uri "https://github.com/.../posh-windows-amd64.exe" -OutFile "$env:LOCALAPPDATA\Programs\oh-my-posh\oh-my-posh.exe"

# 在 PS7 Profile 里初始化
& "$env:LOCALAPPDATA\Programs\oh-my-posh\oh-my-posh.exe" init pwsh --config "...\powerlevel10k_rainbow.omp.json" | Invoke-Expression
```

> **为什么用 `powerlevel10k_rainbow`？**
> 
> 这个主题在 Windows 上兼容性最好，颜色分段清晰，能显示 git 分支、执行时间、错误状态码，且不需要额外图标字体也能基本可用。

### 4. 安装 JetBrainsMono Nerd Font

Windows Terminal 要正确显示 Oh My Posh 的图标（文件夹、git 分支、时钟等符号），必须使用 **Nerd Font**（在普通编程字体基础上补全了数千个图标字形）。

```powershell
# 下载并解压
Expand-Archive -Path "JetBrainsMono.zip" -DestinationPath "..."

# 复制到用户字体目录
Copy-Item *.ttf -Destination "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"

# 用 Shell COM 对象真正注册到系统字体表
$shell = New-Object -ComObject Shell.Application
$fontFolder = $shell.Namespace(0x14)  # 0x14 = Fonts virtual folder
$fontFolder.CopyHello($fontFile, 0x10) # 静默安装
```

> **坑点：字体名称不是文件名**
>
> 很多人会在 `settings.json` 里写 `"face": "JetBrainsMono Nerd Font"`，但系统实际注册的字体家族名是 `"JetBrainsMono NF"`。写错会导致 Terminal 启动时弹窗报错"找不到字体"。
>
> 正确写法：
> ```json
> "font": { "face": "JetBrainsMono NF", "size": 12 }
> ```

### 5. 强制 UTF-8，根治 GBK 乱码

Windows 中文版默认代码页是 **GBK (936)**，这会导致：
- `git log` 中文乱码
- `python` 输出乱码
- `npm`、`cargo` 等现代工具输出异常
- 复制粘贴到剪贴板的内容编码错乱

**方案 A：PowerShell 7 Profile 级（立即生效，推荐）**

在 Profile 顶部加入：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
```

这样每个新开的 Terminal 标签页内部都是 UTF-8，不影响系统其他程序。

**方案 B：系统全局级（需重启，还原卡环境慎用）**

```powershell
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage" -Name "ACP" -Value "65001"
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage" -Name "OEMCP" -Value "65001"
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Nls\CodePage" -Name "MACCP" -Value "65001"
```

改完后**必须重启**才能生效。若机房有 OS-Easy 等还原卡，重启后注册表会被还原，此方案仅对当前开机 session 有效。

### 6. 配置文件位置速查

| 配置项 | 路径 |
| --- | --- |
| **Windows Terminal 设置** | `%LOCALAPPDATA%\Microsoft\Windows Terminal\settings.json` |
| **PowerShell 7 Profile** | `%USERPROFILE%\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` |
| **Oh My Posh 本体** | `%LOCALAPPDATA%\Programs\oh-my-posh\oh-my-posh.exe` |
| **字体文件** | `%LOCALAPPDATA%\Microsoft\Windows\Fonts\` |
| **Unpackaged Terminal** | `%LOCALAPPDATA%\WindowsTerminal\terminal-1.21.3231.0\WindowsTerminal.exe` |

* * *

## 常见问题 FAQ

### Q1：双击桌面 Terminal 没反应？

**原因**：MSIX 版的 App Execution Alias 在部分系统上无法正常启动。

**解决**：一键脚本已经在桌面创建了指向 **Unpackaged 版** 的快捷方式（`Terminal.lnk`），该版本不依赖任何系统组件，双击必开。如果还是打不开，直接运行：

```powershell
& "$env:LOCALAPPDATA\WindowsTerminal\terminal-1.21.3231.0\WindowsTerminal.exe"
```

### Q2：打开后提示"找不到字体：JetBrainsMono NF"？

**原因**：字体没有正确注册到系统字体表，或者 `settings.json` 里的 `face` 写错了。

**解决**：
1. 确认 `settings.json` 中写的是 `"face": "JetBrainsMono NF"`（不是 `Nerd Font`）。
2. 运行一键脚本里的字体注册代码（Shell COM 复制到 Fonts 文件夹）。
3. 若仍报错，注销再登录一次刷新字体缓存。

### Q3：PowerShell 7 里中文还是乱码？

**原因**：当前 PowerShell 7 session 的 `[Console]::OutputEncoding` 仍是 GBK。

**解决**：检查 Profile 是否已加载。在 Terminal 里执行：

```powershell
[Console]::OutputEncoding
```

应输出 `System.Text.UTF8Encoding`。如果不是，说明 Profile 没生效，检查文件路径是否正确：

```
%USERPROFILE%\Documents\PowerShell\Microsoft.PowerShell_profile.ps1
```

### Q4：Oh My Posh 图标显示成方块 □？

**原因**：虽然字体已安装，但 Terminal 没有使用该字体，或者使用的是普通版而非 Nerd Font 版。

**解决**：确认 `settings.json` 中 `defaults.font.face` 为 `JetBrainsMono NF`，且 `JetBrainsMonoNerdFont-Regular.ttf` 已存在于 `%LOCALAPPDATA%\Microsoft\Windows\Fonts`。

### Q5：重启后所有配置都消失了？

**原因**：机房安装了 OS-Easy、联想硬盘保护卡、冰点还原等还原软件，关机/重启后 C 盘自动还原。

**解决**：
- **当前开机 session 内**，所有配置都在内存和当前用户目录中，正常使用无影响。
- **如需永久保留**，需要找机房管理员在还原卡软件里设置"保存数据"或开放写入白名单。
- **临时规避**：每次开机后重新运行一遍一键脚本（约 2 分钟）。

### Q6：如何切换 Oh My Posh 主题？

1. 从 [官方主题库](https://ohmyposh.dev/docs/themes) 下载喜欢的 `.omp.json` 文件。
2. 修改 PS7 Profile 中的 `--config` 路径：

```powershell
& "$env:LOCALAPPDATA\Programs\oh-my-posh\oh-my-posh.exe" init pwsh --config "C:\Path\To\your-theme.omp.json" | Invoke-Expression
```

3. 保存后，在 Terminal 中执行 `. $PROFILE` 立即生效。

### Q7：想换回默认的 Windows PowerShell 5.1？

在 Terminal 的标签页下拉菜单里可以直接选 **Windows PowerShell**，或者按 `Ctrl + Shift + 5` 打开新标签选择配置文件。

* * *

## 效果预览

配置完成后，你的终端应该具备以下特征：

- **多标签页**：`Ctrl + Shift + T` 新开标签，`Ctrl + Tab` 切换
- **毛玻璃背景**：90% 透明度 + Acrylic 模糊效果
- **PowerShell 7.4**：支持 `??`、`?.`、Pipeline Parallel 等新语法
- **Oh My Posh 提示符**：显示当前路径、git 状态、管理员标识、上条命令执行时间
- **UTF-8 全程**：`ls`、`git`、`python` 中文输出不再乱码
- **JetBrainsMono NF**：等宽编程字体，带连字和图标支持

* * *

> 如果还有问题，欢迎根据实际情况调整脚本中的下载链接和路径。

* * *

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
        } catch { Write-Host "Failed via $p : $($_.Exception.Message)" -ForegroundColor Red }
    }
    # 所有代理都失败，最后尝试直连
    Write-Host "Trying direct download..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

# 创建临时目录
$temp = "$env:TEMP\termsetup"
New-Item -ItemType Directory -Force -Path $temp | Out-Null

# 校验临时文件是否完整（不完整则自动删除）
function Test-ValidFile($Path, $MinBytes=1) {
    if (Test-Path $Path) {
        if ((Get-Item $Path).Length -ge $MinBytes) { return $true }
        Remove-Item $Path -Force
    }
    return $false
}

# --- 1. PowerShell 7.4 ---
$ps7Url = "https://github.com/PowerShell/PowerShell/releases/download/v7.4.6/PowerShell-7.4.6-win-x64.msi"
$ps7Out = "$temp\PowerShell-7.4.6-win-x64.msi"
if (-not (Test-ValidFile $ps7Out 50MB)) {
    Write-Host ">>> 下载 PowerShell 7.4..." -ForegroundColor Cyan
    Get-WithProxy -Url $ps7Url -OutFile $ps7Out
}
Write-Host ">>> 安装 PowerShell 7.4..." -ForegroundColor Cyan
msiexec /i "$ps7Out" /qn ADD_EXPLORER_CONTEXT_MENU=1 ENABLE_PSREMOTING=1 REGISTER_MANIFEST=1

# --- 2. Windows Terminal (msixbundle + unpackaged zip) ---
$wtMsix = "$temp\WindowsTerminal.msixbundle"
if (-not (Test-ValidFile $wtMsix 10MB)) {
    Write-Host ">>> 下载 Windows Terminal msixbundle..." -ForegroundColor Cyan
    Get-WithProxy -Url "https://github.com/microsoft/terminal/releases/download/v1.21.3231.0/Microsoft.WindowsTerminal_1.21.3231.0_8wekyb3d8bbwe.msixbundle" -OutFile $wtMsix
}
Add-AppxPackage -Path $wtMsix -ErrorAction SilentlyContinue

$wtZip = "$temp\WindowsTerminal_x64.zip"
if (-not (Test-ValidFile $wtZip 5MB)) {
    Write-Host ">>> 下载 Windows Terminal Unpackaged..." -ForegroundColor Cyan
    Get-WithProxy -Url "https://github.com/microsoft/terminal/releases/download/v1.21.3231.0/Microsoft.WindowsTerminal_1.21.3231.0_x64.zip" -OutFile $wtZip
}
$wtDest = "$env:LOCALAPPDATA\WindowsTerminal"
Expand-Archive -Path $wtZip -DestinationPath $wtDest -Force

# --- 3. Oh My Posh ---
$ompDir = "$env:LOCALAPPDATA\Programs\oh-my-posh"
New-Item -ItemType Directory -Force -Path $ompDir | Out-Null
$ompExe = "$ompDir\oh-my-posh.exe"
if (-not (Test-ValidFile $ompExe 5MB)) {
    Write-Host ">>> 下载 Oh My Posh..." -ForegroundColor Cyan
    Get-WithProxy -Url "https://github.com/JanDeDobbeleer/oh-my-posh/releases/latest/download/posh-windows-amd64.exe" -OutFile $ompExe
}

# --- 4. JetBrainsMono Nerd Font ---
$fontZip = "$temp\JetBrainsMono.zip"
if (-not (Test-ValidFile $fontZip 10MB)) {
    Write-Host ">>> 下载 JetBrainsMono Nerd Font..." -ForegroundColor Cyan
    Get-WithProxy -Url "https://github.com/ryanoasis/nerd-fonts/releases/download/v3.2.1/JetBrainsMono.zip" -OutFile $fontZip
}
$fontDest = "$env:LOCALAPPDATA\Microsoft\Windows\Fonts"
New-Item -ItemType Directory -Force -Path $fontDest | Out-Null
Expand-Archive -Path $fontZip -DestinationPath "$temp\JetBrainsMono" -Force
Get-ChildItem "$temp\JetBrainsMono" -Filter "*.ttf" | ForEach { Copy-Item $_.FullName -Destination $fontDest -Force }

# 注册字体
$shell = New-Object -ComObject Shell.Application
$fontFolder = $shell.Namespace(0x14)
Get-ChildItem $fontDest -Filter "*JetBrains*" | ForEach { $fontFolder.CopyHere($_.FullName, 0x10) }

# --- 5. Oh My Posh 主题 ---
$themeDir = "$ompDir\themes"
New-Item -ItemType Directory -Force -Path $themeDir | Out-Null
$themeFile = "$themeDir\powerlevel10k_rainbow.omp.json"
if (-not (Test-ValidFile $themeFile 1KB)) {
    Get-WithProxy -Url "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/powerlevel10k_rainbow.omp.json" -OutFile $themeFile
}

# --- 6. PS7 Profile ---
$ps7ProfileDir = "$env:USERPROFILE\Documents\PowerShell"
New-Item -ItemType Directory -Force -Path $ps7ProfileDir | Out-Null
$profileContent = @"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`$OutputEncoding = [System.Text.Encoding]::UTF8
`$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
& "$ompExe" init pwsh --config "$themeFile" | Invoke-Expression
Set-Alias ll Get-ChildItem
Set-Alias which Get-Command
Set-PSReadLineOption -PredictionSource History
Set-PSReadLineOption -PredictionViewStyle ListView
"@
Set-Content -Path "$ps7ProfileDir\Microsoft.PowerShell_profile.ps1" -Value $profileContent -Encoding UTF8

# --- 7. Terminal settings.json ---
$wtSettingsDir = "$env:LOCALAPPDATA\Microsoft\Windows Terminal"
New-Item -ItemType Directory -Force -Path $wtSettingsDir | Out-Null
$settingsJson = @'
{
  "$help": "https://aka.ms/terminal-documentation",
  "$schema": "https://aka.ms/terminal-profiles-schema",
  "actions": [
    { "command": { "action": "copy", "singleLine": false }, "keys": "ctrl+c" },
    { "command": "paste", "keys": "ctrl+v" },
    { "command": "find", "keys": "ctrl+shift+f" },
    { "command": { "action": "splitPane", "split": "auto", "splitMode": "duplicate" }, "keys": "alt+shift+d" }
  ],
  "copyFormatting": "none",
  "defaultProfile": "{574e775e-4f2a-5b96-ac1e-a2962a402336}",
  "newTabMenu": [ { "type": "remainingProfiles" } ],
  "profiles": {
    "defaults": {
      "colorScheme": "One Half Dark",
      "font": { "face": "JetBrainsMono NF", "size": 12 },
      "opacity": 90,
      "useAcrylic": true,
      "padding": "8, 8, 8, 8",
      "cursorShape": "bar",
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
  },
  "schemes": [
    {
      "name": "One Half Dark",
      "background": "#282C34",
      "black": "#282C34",
      "blue": "#61AFEF",
      "brightBlack": "#5A6374",
      "brightBlue": "#61AFEF",
      "brightCyan": "#56B6C2",
      "brightGreen": "#98C379",
      "brightPurple": "#C678DD",
      "brightRed": "#E06C75",
      "brightWhite": "#DCDFE4",
      "brightYellow": "#E5C07B",
      "cursorColor": "#A3B3CC",
      "cyan": "#56B6C2",
      "foreground": "#DCDFE4",
      "green": "#98C379",
      "purple": "#C678DD",
      "red": "#E06C75",
      "selectionBackground": "#474E5D",
      "white": "#DCDFE4",
      "yellow": "#E5C07B"
    }
  ]
}
'@
Set-Content -Path "$wtSettingsDir\settings.json" -Value $settingsJson -Encoding UTF8

# --- 8. 桌面快捷方式 ---
$wtExe = "$wtDest\terminal-1.21.3231.0\WindowsTerminal.exe"
$WshShell = New-Object -ComObject WScript.Shell
$SC = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Terminal.lnk")
$SC.TargetPath = $wtExe
$SC.WorkingDirectory = "$wtDest\terminal-1.21.3231.0"
$SC.IconLocation = $wtExe
$SC.Save()

Write-Host ">>> 完成！双击桌面 'Terminal' 即可使用。" -ForegroundColor Green
```

> **代理站优先级**：默认先走 `gh-proxy.org`（目前最稳），失败自动切 `mirror.ghproxy.com` → `ghproxy.net` → `ghp.ci`，全部挂掉才走 GitHub 直连。
>
> 如果你那边某个代理特别快，可以把 `Get-WithProxy` 函数里 `$proxies` 数组的顺序调一下，把最快的放第一。

---

## 更新日志

- **2026-05-08** 修复断点续传导致的安装失败：
  - 增加临时文件大小校验函数 `Test-ValidFile`，不完整时自动删除重下
  - 覆盖 PowerShell 7 MSI、Windows Terminal msixbundle/zip、Oh My Posh、Nerd Font、主题文件等全部下载节点
  - 解决「执行到一半退出，再次运行时报文件损坏/安装包无法运行」的问题

* * *

---

> 在 Windows 10/11 上零权限安装 Windows Terminal + PowerShell 7 + Oh My Posh，解决 GBK 乱码与默认终端难用的问题。适用于机房、还原卡、无管理员权限环境。
>
> 复制脚本 → 粘贴 → 回车，获得一个带毛玻璃、多标签页、UTF-8、Nerd Font 的现代化终端。

---
