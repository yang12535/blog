---
title: CentOS Stream 9 / RHEL 9 纯换源（两行）
date: 2026-04-09
tags: [centos, rhel, mirror, yum, pip]
---

# CentOS Stream 9 / RHEL 9 纯换源（两行）

> 只换源，不装任何软件。解决国内访问官方源慢、GPG Key 404、subscription 注册提示等问题。

---

## 两行命令

```bash
# 第一行：系统源（yum/dnf）换阿里云，禁用红帽订阅插件
sed -i 's/enabled=1/enabled=0/g' /etc/yum/pluginconf.d/subscription-manager.conf; mkdir -p /etc/yum.repos.d/backup && mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/backup/ 2>/dev/null; echo -e "[baseos]\nname=CentOS Stream 9 BaseOS\nbaseurl=https://mirrors.aliyun.com/centos-stream/9-stream/BaseOS/x86_64/os/\ngpgcheck=1\nenabled=1\ngpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official\n\n[appstream]\nname=CentOS Stream 9 AppStream\nbaseurl=https://mirrors.aliyun.com/centos-stream/9-stream/AppStream/x86_64/os/\ngpgcheck=1\nenabled=1\ngpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official\n\n[crb]\nname=CentOS Stream 9 CRB\nbaseurl=https://mirrors.aliyun.com/centos-stream/9-stream/CRB/x86_64/os/\ngpgcheck=1\nenabled=1\ngpgkey=https://mirrors.aliyun.com/centos/RPM-GPG-KEY-CentOS-Official" > /etc/yum.repos.d/centos9.repo && dnf clean all && dnf makecache

# 第二行：pip 换清华源（主）+ 阿里云（备）
mkdir -p ~/.pip && echo -e "[global]\nindex-url = https://pypi.tuna.tsinghua.edu.cn/simple\ntrusted-host = pypi.tuna.tsinghua.edu.cn\nextra-index-url = https://mirrors.aliyun.com/pypi/simple/" > ~/.pip/pip.conf
```

---

## 第一行在干什么？

| 分段 | 作用 |
|------|------|
| `sed -i ... subscription-manager.conf` | 禁用红帽订阅插件。无订阅的 RHEL/CentOS 每次执行 `dnf` 都会提示"无法读取客户身份"，关掉它。 |
| `mkdir -p .../backup && mv ...` | 备份原有 `.repo` 文件到 `backup` 目录，防止误删后无法恢复。 |
| `echo -e "..." > /etc/yum.repos.d/centos9.repo` | 写入阿里云 CentOS Stream 9 源，包含 BaseOS、AppStream、CRB 三个核心仓库。 |
| `dnf clean all && dnf makecache` | 清除旧缓存，重新拉取阿里云元数据，验证新源是否可用。 |

> **注意 GPG Key 路径**：阿里云上 `centos-stream/RPM-GPG-KEY-CentOS-Official` 会 404，
> 这里手动修正为 `centos/RPM-GPG-KEY-CentOS-Official`，否则安装软件时公钥导入失败。

---

## 第二行在干什么？

| 配置项 | 作用 |
|--------|------|
| `index-url` | PyPI 主源指向 **清华 TUNA**，国内延迟最低、同步最及时。 |
| `trusted-host` | 告诉 pip 信任清华域名，避免 HTTPS 证书警告。 |
| `extra-index-url` | 备用源指向 **阿里云**，清华抽风时自动 fallback。 |

写入路径是 `~/.pip/pip.conf`，仅对当前用户生效，不影响系统全局或其他用户。

---

## 为什么吃百家饭？

| 你要的东西 | 去哪吃 | 为什么这家 |
|-----------|--------|-----------|
| **RPM 系统源** (BaseOS/AppStream/CRB) | **阿里云** | 清华 TUNA 对 CentOS Stream 9 的仓库同步不完整，阿里云最全 |
| **PyPI 包** (pip install) | **清华 TUNA** | 同步频率高，新包上线快；阿里云 PyPI 偶有 6~12 小时延迟 |
| **Python 安装包** (.exe/.tgz) | **华为云** | 只有华为云镜像了 Python 官方安装包目录，清华/阿里云不做这个 |
| **GPG Key** | **阿里云** | 各家路径不统一，`centos-stream/` 和 `centos/` 下文件名还不一样 |

**没有一家镜像站能全包**，所以系统源吃阿里、pip 吃清华、安装包吃华为、key 还得自己找路径——这就是国内源的"百家饭"现状。

---

## 验证换源成功

```bash
# 查看系统源
ls /etc/yum.repos.d/          # 应只剩 centos9.repo 和 backup 目录
cat /etc/yum.repos.d/centos9.repo

# 测试系统源速度
dnf repolist

# 查看 pip 源
cat ~/.pip/pip.conf

# 测试 pip 源速度
pip config list
```

---

## 回滚（后悔了）

```bash
# 恢复原有 repo
mv /etc/yum.repos.d/backup/*.repo /etc/yum.repos.d/ 2>/dev/null
rm -f /etc/yum.repos.d/centos9.repo

# 删除 pip 镜像配置
rm -f ~/.pip/pip.conf

# 重新启用 subscription-manager（如有需要）
sed -i 's/enabled=0/enabled=1/g' /etc/yum/pluginconf.d/subscription-manager.conf
```
