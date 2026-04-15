---
title: Windows 一键安装 Kimi CLI
date: 2026-04-14
tags: [kimi-cli, windows, uv, powershell]
---

> PowerShell 一键完成 Python + uv + kimi-cli 安装，含国内镜像加速与永久环境变量配置。

* * *

## 环境信息

- **系统**：Windows 10 / Windows 11
- **权限**：普通用户（无需管理员，部分操作自动提窗）
- **目标**：一行 PowerShell 完成全套环境搭建
- **网络**：国内环境，使用华为云/清华/阿里云镜像加速

* * *

## 完整命令

以管理员身份打开 PowerShell，复制粘贴执行：

```
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;Set-ExecutionPolicy Bypass -Scope Process -Force;Remove-Item "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" -ErrorAction SilentlyContinue;Remove-Item "$env:LOCALAPPDATA\Microsoft\WindowsApps\python3.exe" -ErrorAction SilentlyContinue;$pyDir="$env:LOCALAPPDATA\Programs\Python\Python312";$pyExe="$pyDir\python.exe";if(-not(Test-Path $pyExe)){Write-Host ">>> 安装 Python 3.12 (华为云镜像)..." -ForegroundColor Cyan;$i="$env:TEMP\py.exe";if(-not(Test-Path $i)){Invoke-WebRequest -Uri "https://repo.huaweicloud.com/python/3.12.4/python-3.12.4-amd64.exe" -OutFile $i -UseBasicParsing};Start-Process $i -ArgumentList "/quiet PrependPath=1 Include_test=0 InstallAllUsers=0" -Wait};$env:Path="$pyDir;$pyDir\Scripts;$env:Path";Write-Host ">>> 安装 uv (清华源)..." -ForegroundColor Cyan;python -m pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple/ --user --quiet;[Environment]::SetEnvironmentVariable("UV_INDEX_URL","https://pypi.tuna.tsinghua.edu.cn/simple/","User");[Environment]::SetEnvironmentVariable("UV_EXTRA_INDEX_URL","https://mirrors.aliyun.com/pypi/simple/","User");$env:UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple/";$env:UV_EXTRA_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/";Write-Host ">>> 安装 kimi-cli..." -ForegroundColor Cyan;python -m uv tool install kimi-cli --force;$uPath=[Environment]::GetEnvironmentVariable("Path","User");$uvBin="$env:USERPROFILE\.local\bin";if($uPath -notlike "*$uvBin*"){[Environment]::SetEnvironmentVariable("Path","$uPath;$uvBin","User")};$env:Path="$env:Path;$uvBin";Write-Host ">>> 完成！" -ForegroundColor Green;python --version;python -m uv --version;kimi --version;Write-Host "`n✓ 环境变量已永久保存" -ForegroundColor Green;Read-Host "按回车退出"
```

* * *

## 分步详解

### 1\. 启用 TLS 1.2 与绕过执行策略

```
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Set-ExecutionPolicy Bypass -Scope Process -Force
```

- **TLS 1.2**：Windows 默认可能使用 TLS 1.0/1.1，下载 Python 安装包时会握手失败，强制启用 1.2。
- **执行策略**：PowerShell 默认禁止运行脚本， `Bypass -Scope Process` 仅当前会话放行，不影响系统安全策略。

### 2\. 清理 Microsoft Store 的假 python

```
Remove-Item "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe" -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Microsoft\WindowsApps\python3.exe" -ErrorAction SilentlyContinue
```

Windows 10/11 会在 `WindowsApps` 目录放一个 **App Execution Alias**（空壳 `python.exe`）。
即使你的 PATH 里已经有真正的 Python，执行 `python` 时仍可能被它劫持到 Microsoft Store。
脚本在安装前先删掉这两个假入口，防止后续命令被截胡。

### 3\. 检测并安装 Python 3.12（华为云镜像）

```
$pyDir="$env:LOCALAPPDATA\Programs\Python\Python312"
$pyExe="$pyDir\python.exe"
if(-not(Test-Path $pyExe)){
    Write-Host ">>> 安装 Python 3.12 (华为云镜像)..." -ForegroundColor Cyan
    $i="$env:TEMP\py.exe"
    if(-not(Test-Path $i)){
        Invoke-WebRequest -Uri "https://repo.huaweicloud.com/python/3.12.4/python-3.12.4-amd64.exe" -OutFile $i -UseBasicParsing
    }
    Start-Process $i -ArgumentList "/quiet PrependPath=1 Include_test=0 InstallAllUsers=0" -Wait
}
```

| 参数| 含义|
| ---| ---|
| `/quiet`| 静默安装，无弹窗|
| `PrependPath=1`| 自动将 Python 加入用户 PATH|
| `Include_test=0`| 不安装测试套件，节省空间|
| `InstallAllUsers=0`| 仅安装到当前用户目录，无需管理员权限|

> **为什么用 `Test-Path` 而不是 `Get-Command python`？**
> 因为 `Get-Command python` 在 Windows 上可能命中 Microsoft Store 的空壳 `python.exe`，造成"已安装"的误判，导致跳过安装 yet 后面的 `python -m pip` 直接报错。

> **为什么用华为云？** 国内下载 `python.org` 官方安装包极慢，华为云镜像同步了完整的 Python 发布目录，且支持直链下载。

### 4\. 强制刷新当前会话的 PATH

```
$env:Path="$pyDir;$pyDir\Scripts;$env:Path"
```

Python 安装程序修改的是**注册表里的永久 PATH**，但 **正在运行的 PowerShell 窗口不会自动感知**。
如果不把这行加上，后续所有 `python` 命令都会报 `无法将“python”项识别为 cmdlet...`。
我们通过将真实 Python 目录 prepend 到当前会话的 `$env:Path` 最前面，确保本窗口内立即生效，同时绕过 WindowsApps 的优先级干扰。

### 5\. 安装 uv（清华 PyPI 镜像）

```
Write-Host ">>> 安装 uv (清华源)..." -ForegroundColor Cyan
python -m pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple/ --user --quiet
```

- **uv**：Rust 编写的高性能 Python 包管理器，替代 `pip` \+ `venv` \+ `pip-tools`，安装 kimi-cli 及其依赖极快。
- **清华源**：国内访问 PyPI 官方源常超时，清华 TUNA 同步频率高、带宽大。
- **`--user`**：安装到用户目录，避免写系统 Program Files 的权限问题。

### 6\. 配置 uv 永久镜像环境变量

```
[Environment]::SetEnvironmentVariable("UV_INDEX_URL","https://pypi.tuna.tsinghua.edu.cn/simple/","User")
[Environment]::SetEnvironmentVariable("UV_EXTRA_INDEX_URL","https://mirrors.aliyun.com/pypi/simple/","User")
$env:UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple/"
$env:UV_EXTRA_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/"
```

| 变量| 作用|
| ---| ---|
| `UV_INDEX_URL`| uv 默认 PyPI 主源 → **清华 TUNA**|
| `UV_EXTRA_INDEX_URL`| uv 备用源 → **阿里云**，清华抽风时自动 fallback|

- **`[Environment]::SetEnvironmentVariable(..., 