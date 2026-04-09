---
title: Windows 下安装 Kimi CLI，PowerShell 一键指令
date: 2026-04-08
tags: [kimi, cli, windows, 教程]
---

> PowerShell 一键完成 Python + uv + kimi-cli 安装，含国内镜像加速与永久环境变量配置。

---

## 环境信息

- **系统**：Windows 10 / Windows 11
- **权限**：普通用户（无需管理员，部分操作自动提窗）
- **目标**：一行 PowerShell 完成全套环境搭建
- **网络**：国内环境，使用华为云/清华/阿里云镜像加速

---

## 完整命令

以管理员身份打开 PowerShell，复制粘贴执行：

```powershell
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;Set-ExecutionPolicy Bypass -Scope Process -Force;if(-not(Get-Command python -ErrorAction SilentlyContinue)){Write-Host ">>> 安装 Python 3.12 (华为云镜像)..." -ForegroundColor Cyan;Invoke-WebRequest -Uri "https://repo.huaweicloud.com/python/3.12.4/python-3.12.4-amd64.exe" -OutFile "$env:TEMP\py.exe" -UseBasicParsing;Start-Process "$env:TEMP\py.exe" -ArgumentList "/quiet PrependPath=1 Include_test=0 InstallAllUsers=0" -Wait};Write-Host ">>> 安装 uv (清华源)..." -ForegroundColor Cyan;python -m pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple/ --user --quiet;[Environment]::SetEnvironmentVariable("UV_INDEX_URL","https://pypi.tuna.tsinghua.edu.cn/simple/","User");[Environment]::SetEnvironmentVariable("UV_EXTRA_INDEX_URL","https://mirrors.aliyun.com/pypi/simple/","User");$env:UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple/";$env:UV_EXTRA_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/";Write-Host ">>> 安装 kimi-cli..." -ForegroundColor Cyan;python -m uv tool install kimi-cli --force;$uPath=[Environment]::GetEnvironmentVariable("Path","User");$uvBin="$env:USERPROFILE\.local\bin";if($uPath -notlike "*$uvBin*"){[Environment]::SetEnvironmentVariable("Path","$uPath;$uvBin","User")};$env:Path="$env:Path;$uvBin";Write-Host ">>> 完成！" -ForegroundColor Green;python -m uv --version;kimi --version;Write-Host "`n✓ 环境变量已永久保存" -ForegroundColor Green;Read-Host "按回车退出"
```

---

## 分步详解

### 1. 启用 TLS 1.2 与绕过执行策略

```powershell
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Set-ExecutionPolicy Bypass -Scope Process -Force
```

- **TLS 1.2**：Windows 默认可能使用 TLS 1.0/1.1，下载 Python 安装包时会握手失败，强制启用 1.2。
- **执行策略**：PowerShell 默认禁止运行脚本，`Bypass -Scope Process` 仅当前会话放行，不影响系统安全策略。

### 2. 检测并安装 Python 3.12（华为云镜像）

```powershell
if(-not(Get-Command python -ErrorAction SilentlyContinue)){
    Write-Host ">>> 安装 Python 3.12 (华为云镜像)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://repo.huaweicloud.com/python/3.12.4/python-3.12.4-amd64.exe" -OutFile "$env:TEMP\py.exe" -UseBasicParsing
    Start-Process "$env:TEMP\py.exe" -ArgumentList "/quiet PrependPath=1 Include_test=0 InstallAllUsers=0" -Wait
}
```

| 参数 | 含义 |
|------|------|
| `/quiet` | 静默安装，无弹窗 |
| `PrependPath=1` | 自动将 Python 加入用户 PATH |
| `Include_test=0` | 不安装测试套件，节省空间 |
| `InstallAllUsers=0` | 仅安装到当前用户目录，无需管理员权限 |

> **为什么用华为云？** 国内下载 `python.org` 官方安装包极慢，华为云镜像同步了完整的 Python 发布目录，且支持直链下载。

### 3. 安装 uv（清华 PyPI 镜像）

```powershell
Write-Host ">>> 安装 uv (清华源)..." -ForegroundColor Cyan
python -m pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple/ --user --quiet
```

- **uv**：Rust 编写的高性能 Python 包管理器，替代 `pip` + `venv` + `pip-tools`，安装 kimi-cli 及其依赖极快。
- **清华源**：国内访问 PyPI 官方源常超时，清华 TUNA 同步频率高、带宽大。
- **`--user`**：安装到用户目录，避免写系统 Program Files 的权限问题。

### 4. 配置 uv 永久镜像环境变量

```powershell
[Environment]::SetEnvironmentVariable("UV_INDEX_URL","https://pypi.tuna.tsinghua.edu.cn/simple/","User")
[Environment]::SetEnvironmentVariable("UV_EXTRA_INDEX_URL","https://mirrors.aliyun.com/pypi/simple/","User")
$env:UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple/"
$env:UV_EXTRA_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/"
```

| 变量 | 作用 |
|------|------|
| `UV_INDEX_URL` | uv 默认 PyPI 主源 → **清华 TUNA** |
| `UV_EXTRA_INDEX_URL` | uv 备用源 → **阿里云**，清华抽风时自动 fallback |

- **`[Environment]::SetEnvironmentVariable(..., "User")`**：写入用户级注册表，**永久生效**，重启后仍然有效。
- **`$env:...`**：当前会话立即生效，无需重启 PowerShell。

### 5. 安装 kimi-cli

```powershell
Write-Host ">>> 安装 kimi-cli..." -ForegroundColor Cyan
python -m uv tool install kimi-cli --force
```

- **`uv tool install`**：将 `kimi-cli` 作为独立工具安装到隔离环境，不污染系统 Python 的 site-packages。
- **`--force`**：若已存在则覆盖升级，保证装到最新版。

### 6. 将 uv 工具目录加入 PATH

```powershell
$uPath=[Environment]::GetEnvironmentVariable("Path","User")
$uvBin="$env:USERPROFILE\.local\bin"
if($uPath -notlike "*$uvBin*"){
    [Environment]::SetEnvironmentVariable("Path","$uPath;$uvBin","User")
}
$env:Path="$env:Path;$uvBin"
```

uv 默认将可执行文件放在 `$env:USERPROFILE\.local\bin`（即 `C:\Users\<用户名>\.local\bin`）。
脚本检测该路径是否已在用户 PATH 中，没有则追加，**同样永久生效**。

### 7. 验证安装

```powershell
python -m uv --version
kimi --version
```

正常输出示例：

```
uv 0.11.5
kimi, version 1.30.0
```

### 8. 交互提示

```powershell
Write-Host "`n✓ 环境变量已永久保存" -ForegroundColor Green
Read-Host "按回车退出"
```

安装完成后暂停，方便用户查看版本信息和任何报错。

---

## 为什么吃百家饭？

| 你要的东西 | 去哪吃 | 原因 |
|-----------|--------|------|
| **Python 安装包** (`.exe`) | **华为云** | 只有华为云完整镜像了 `python.org` 发布目录，清华/阿里云不做这个 |
| **PyPI 包** (`pip/uv`) | **清华 TUNA** | 同步最及时，阿里云 PyPI 偶有延迟 |
| **PyPI 备用** | **阿里云** | 清华故障时兜底 |
| **Windows 安装参数** | `/quiet` | 微软 MSI/EXE 静默安装标准，无弹窗 |

国内没有一家镜像站能全包，只能系统源、安装包、PyPI 分开蹭。

---

## 常见问题

### Q: 执行时红字报错 "无法加载文件，因为在此系统上禁止运行脚本"

A: 先执行一次 `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`，再重新运行本命令。

### Q: Python 安装后 `python` 命令仍识别不到

A: 安装参数已包含 `PrependPath=1`，但有时需要**新开一个 PowerShell 窗口**或注销重登才能加载新 PATH。

### Q: 如何卸载？

A: 
```powershell
# 卸载 kimi-cli
python -m uv tool uninstall kimi-cli

# 卸载 uv
python -m pip uninstall uv -y

# 卸载 Python（控制面板 → 应用 → Python 3.12）
```

### Q: 不想用国内镜像了，如何恢复官方源？

A: 删除环境变量后重启 PowerShell：
```powershell
[Environment]::SetEnvironmentVariable("UV_INDEX_URL", $null, "User")
[Environment]::SetEnvironmentVariable("UV_EXTRA_INDEX_URL", $null, "User")
```

---

## 相关链接

- Linux 版（CentOS Stream 9 / RHEL 无订阅）：[kimi-cli-install-centos9.md](./kimi-cli-install-centos9.md)
- 纯换源版（两行命令）：[centos9-mirror-switch.md](./centos9-mirror-switch.md)
- Kimi CLI 官方文档：https://www.kimi.com/code
