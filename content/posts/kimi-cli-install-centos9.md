---
title: CentOS Stream 9 / RHEL 9 无订阅版安装 Kimi CLI
date: 2026-04-09
tags: [kimi-cli, centos, linux, uv]
---

> 📌 **官方已迁移**：`kimi-cli` 已品牌迁移为 `kimi-code`，包名与安装方式均有变化。本文所述的 `kimi-cli` 目前仍可正常使用，但后续建议自行安装新版：
> ```bash
> npm install -g @moonshot-ai/kimi-code
> # 或
> bun add -g @moonshot-ai/kimi-code
> ```

# CentOS Stream 9 / RHEL 9 无订阅版安装 Kimi CLI

> 对应 Windows 版：[Windows 下安装 Kimi CLI，PowerShell 一键指令](https://bash.yang125.fun/posts/kimi-cli-install-win/)

## 环境信息

- **系统**：CentOS Stream 9 / RHEL 9 / Rocky Linux 9 / AlmaLinux 9
- **场景**：无红帽订阅（无 Subscription）
- **目标**：一行命令完成 Python + uv + kimi-cli 安装
- **网络**：国内环境，使用阿里云/清华镜像加速

---

## 为什么这玩意这么折腾？

| 坑 | 原因 |
|---|---|
| **Subscription Manager** | RHEL 默认强制注册红帽订阅，无订阅时必须禁用插件并更换开源源 |
| **GPG Key 404** | 阿里云 `centos-stream/RPM-GPG-KEY...` 路径已失效，必须手动修正为 `centos/RPM-GPG-KEY...` |
| **缺少 pip** | 最小化安装的 CentOS/RHEL 只有 `python3`，没有 `python3-pip` |
| **国内镜像碎片化** | 华为云做 Python 安装包、清华做 PyPI、阿里云做系统源，各管一摊 |
| **Windows vs Linux 差异** | Windows 直接下载 `.exe` 安装包；Linux 必须用包管理器（dnf/yum） |

---

## 一键安装（单行版）

复制以下整行，在 `root` 权限下执行：

```bash
sed -i 's/enabled=1/enabled=0/g' /etc/yum/pluginconf.d/subscription-manager.conf 2>/dev/null; mkdir -p /etc/yum.repos.d/backup && mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/backup/ 2>/dev/null; echo -e "[baseos]\nname=CentOS Stream 9 BaseOS\nbaseurl=https://mirrors.aliyun.com/centos-stream/9-stream/BaseOS/x86_64/os/\ngpgcheck=1\nenabled=1\ngpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official\n\n[appstream]\nname=CentOS Stream 9 AppStream\nbaseurl=https://mirrors.aliyun.com/centos-stream/9-stream/AppStream/x86_64/os/\ngpgcheck=1\nenabled=1\ngpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official" > /etc/yum.repos.d/centos9.repo && dnf clean all && dnf install -y python3-pip && export UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple" UV_EXTRA_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/" && python3 -m pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple --user --quiet && python3 -m uv tool install kimi-cli --force && { grep -q ".local/bin" ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc; } && export PATH="$HOME/.local/bin:$PATH" && python3 -m uv --version && kimi --version
```

---

## 分步详解

如果你想知道上面那行命令到底干了什么，以下是逐段拆解：

### 1. 禁用 subscription-manager 插件

```bash
sed -i 's/enabled=1/enabled=0/g' /etc/yum/pluginconf.d/subscription-manager.conf 2>/dev/null
```

RHEL/CentOS 默认启用 `subscription-manager`，每次执行 `dnf` 都会尝试连接红帽订阅服务器。
无订阅环境下会报 **"无法读取客户身份"**，拖慢速度甚至导致命令失败。

### 2. 备份旧源并写入阿里云镜像

```bash
mkdir -p /etc/yum.repos.d/backup
mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/backup/ 2>/dev/null
```

原有源可能包含指向红帽官方或已失效的地址，先备份到 `backup` 目录，防止误删。

然后写入新的 `centos9.repo`：

```ini
[baseos]
name=CentOS Stream 9 BaseOS
baseurl=https://mirrors.aliyun.com/centos-stream/9-stream/BaseOS/x86_64/os/
gpgcheck=1
enabled=1
gpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official

[appstream]
name=CentOS Stream 9 AppStream
baseurl=https://mirrors.aliyun.com/centos-stream/9-stream/AppStream/x86_64/os/
gpgcheck=1
enabled=1
gpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official
```

> ⚠️ **注意 GPG Key 路径**：阿里云上 `centos-stream/RPM-GPG-KEY-CentOS-Official` 返回 404，
> 必须改成 `centos/RPM-GPG-KEY-CentOS-Official` 才能正常导入公钥。

### 3. 安装 python3-pip

```bash
dnf clean all
dnf install -y python3-pip
```

- `dnf clean all`：清除旧缓存，避免元数据冲突
- `python3-pip`：CentOS 最小化安装不带 pip，必须手动安装

### 4. 配置国内 PyPI 镜像并安装 uv

```bash
export UV_INDEX_URL="https://pypi.tuna.tsinghua.edu.cn/simple"
export UV_EXTRA_INDEX_URL="https://mirrors.aliyun.com/pypi/simple/"
python3 -m pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple --user --quiet
```

| 镜像 | 用途 | 稳定性 |
|------|------|--------|
| **清华 TUNA** | PyPI 主源 | 教育网+公网双栈，延迟低 |
| **阿里云** | PyPI 备用源 | 主源故障时自动 fallback |

`--user`：无需 root 权限即可安装 uv（当前已在 root 下，但养成好习惯）。

### 5. 安装 kimi-cli

```bash
python3 -m uv tool install kimi-cli --force
```

使用 `uv tool install` 将 `kimi-cli` 安装到 `~/.local/bin`，隔离依赖，避免污染系统 Python。

### 6. 配置 PATH

```bash
{ grep -q ".local/bin" ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc; }
export PATH="$HOME/.local/bin:$PATH"
```

- 写入 `~/.bashrc`：永久生效，下次登录自动加载
- 当前会话 `export`：立即生效，无需重新登录

### 7. 验证安装

```bash
python3 -m uv --version
kimi --version
```

正常输出示例：

```
uv 0.11.5 (x86_64-unknown-linux-gnu)
kimi, version 1.30.0
```

---

## 常见问题

### Q: 执行时提示 `bash: python3: command not found`

A: 通常是复制粘贴时带了控制字符（如 `~[200~`）。建议手敲或右键粘贴**纯文本**。

### Q: `Failed to download gpg key for repo 'baseos': Status code: 404`

A: GPG Key 路径错误。检查 `centos9.repo` 中的 `gpgkey` 是否为：
```
https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official
```
而不是 `centos-stream/RPM-GPG-KEY-CentOS-Official`。

### Q: `WARNING: Running pip as the 'root' user...`

A: 正常提示，可忽略。已在命令中使用 `--user` 限制安装范围。
如需更规范，可创建普通用户后在其 home 目录下执行。

---

## 对比 Windows 版

| 项目 | Windows (PowerShell) | Linux (Bash) |
|------|----------------------|--------------|
| **Python 安装** | 下载华为云 `.exe` 静默安装 | `dnf install python3-pip` |
| **包管理器** | pip / uv | uv (通过 pip 安装) |
| **镜像策略** | 华为云 (Python) + 清华/阿里 (PyPI) | 阿里云 (系统源) + 清华/阿里 (PyPI) |
| **环境变量** | `[Environment]::SetEnvironmentVariable` | 写入 `~/.bashrc` + `export` |
| **订阅问题** | 无 | 需禁用 `subscription-manager` |

---

## 参考链接

- Windows 原版：[https://bash.yang125.fun/posts/kimi-cli-install-win/](https://bash.yang125.fun/posts/kimi-cli-install-win/)
- 阿里云 CentOS 镜像：[https://developer.aliyun.com/mirror/centos](https://developer.aliyun.com/mirror/centos)
- 清华 PyPI 镜像：[https://mirrors.tuna.tsinghua.edu.cn/help/pypi/](https://mirrors.tuna.tsinghua.edu.cn/help/pypi/)
- Kimi CLI 官方文档：[https://www.kimi.com/code](https://www.kimi.com/code)
