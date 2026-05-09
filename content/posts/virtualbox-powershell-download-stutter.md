---
title: VirtualBox 中 PowerShell 下载脉冲式卡顿的根治方案
date: 2026-05-09
tags: [virtualbox, powershell, windows, download, iwr, curl, 虚拟机]
---

> 在 VirtualBox 虚拟机中使用 PowerShell 下载大文件时，任务管理器呈现脉冲式波动、速度暴跌到 100 Kbps？不要先怀疑网络或代理——**先关闭进度条**，90% 的情况立即恢复正常。
>
> 如果你需要保留交互式进度体验，**用 RDP 连虚拟机** 或 **升级到 PowerShell 7** 是更长期的解决方案。

---

## 环境信息

| 项目 | 说明 |
| --- | --- |
| **宿主系统** | Windows 10 / 11（Hyper-V / WHP 开启，VirtualBox 6.1+） |
| **虚拟机** | Windows 10 Pro（VirtualBox NAT 模式，Intel PRO/1000 MT 网卡） |
| **Shell** | Windows PowerShell 5.1（系统默认） |
| **场景** | 在虚拟机内使用 `Invoke-WebRequest` 或 `curl.exe` 下载文件 |
| **症状** | 任务管理器网络图呈现明显脉冲（一波一波），平均速度极低（~100 Kbps） |

---

## 问题现象

在 VirtualBox 虚拟机里打开 PowerShell，执行 `Invoke-WebRequest` 下载一个 20~30 MB 的文件：

```powershell
Invoke-WebRequest -Uri "https://mirrors.tuna.tsinghua.edu.cn/python/3.12.4/python-3.12.4-amd64.exe" -OutFile "$env:TEMP\py.exe"
```

你会看到：

- **PowerShell 控制台**：绿色进度条 `正在读取 Web 响应...` 持续刷新，看起来很正常
- **任务管理器**：网络接收呈明显的**脉冲式**——突然飙到 400+ Kbps，然后掉到接近 0，过几秒再飙一波
- **实际速度**：平均只有 **112 Kbps**（约 14 KB/s），下载一个 25 MB 文件需要 30 分钟以上
- **对比**：同一台虚拟机里用浏览器下载同一个文件，速度稳定在 5~10 MB/s

> 关键观察：**curl.exe 下载 HTTP 链接速度正常（8+ MB/s），但 HTTPS + 控制台进度条时异常；`Invoke-WebRequest` 几乎必现。**

---

## 根因分析

这个问题不是网络问题，不是 CPU 性能问题，也不是 VirtualBox NAT 本身的问题。它是一个 **"渲染阻塞 I/O"** 的叠加效应：

### 第一层：PowerShell 5.1 `Write-Progress` 的高开销

PowerShell 5.1 的 `Invoke-WebRequest` 在下载过程中，每收到一个数据块就会调用一次 `Write-Progress`。这个函数不是简单的 `Write-Host`，它会：

1. 计算百分比、已下载字节、剩余时间
2. 向控制台缓冲区写入一个**全宽彩色进度条 UI**
3. 触发 conhost（Windows 控制台主机）的**整屏重绘**

在物理机上，这个开销可以忽略（现代 SSD + 显卡渲染毫秒级）。但在 VirtualBox 虚拟机中，conhost 的每一帧刷新都要经过：

```
conhost 缓冲区 → VirtualBox 显示虚拟化层（VBoxSVGA/WHP）→ 宿主机显卡驱动 → 宿主机屏幕
```

### 第二层：VirtualBox 显示虚拟化层的延迟放大

VirtualBox 在 Hyper-V（WHP）之上运行时，显示路径被强制走 **用户态虚拟化**：

- 虚拟机内的控制台画面变化 → VBoxSVGA 驱动捕获 → 通过 WHP API 传递到宿主机 → VirtualBox 主进程渲染到宿主窗口
- 这个路径的刷新率远低于物理机直连显示器，且每一帧都有明显的**用户态往返延迟**

当 PowerShell 进度条以每秒数次的频率刷新时，VirtualBox 的显示层变成了瓶颈——**进度条更新排队，下载线程被阻塞等待 UI 反馈**。

### 第三层：TCP 接收窗口的反压效应

下载线程被阻塞的直接后果是：

```
curl/IWR 读取网络缓冲区的速度下降
    → TCP 接收窗口（Receive Window）无法及时排空
    → 接收窗口变小 → 发送方（服务器/代理）收到 TCP Window Update = 0
    → 服务器暂停发送数据
    → 任务管理器显示网络接收掉到 0
    → 控制台终于渲染完积压的进度帧
    → 下载线程恢复，读取缓冲区
    → 接收窗口重新打开
    → 服务器 burst 发送一批数据
    → 任务管理器显示一个脉冲峰值
```

这是脉冲式图案**最主要、最可能的解释**——控制台渲染 I/O 阻塞了网络 I/O，形成周期性反压（VirtualBox NAT 的包缓冲策略、Hyper-V 网络虚拟化开销等也可能是叠加因素）。

### 为什么 curl/HTTP 正常？

curl 的进度条输出到 **stderr**，是纯文本行，不是 PowerShell 的 `Write-Progress` UI 组件。curl 的进度刷新频率和渲染开销都远低于 IWR，因此不会触发同样的阻塞效应。

但 curl 下载**境外 HTTPS** 时仍可能遇到另一个问题（Schannel CRL 检查卡死），这与本文讨论的控制台渲染问题是独立的。详见 [Windows 旧版 curl 下载慢的根治方案](/posts/curl-download-slow-fix/)。

### 为什么 aria2 正常？

aria2 是**多线程下载**，同时维护 8~16 个 TCP 连接。即使某个连接的接收窗口因阻塞暂时关闭，其他连接仍在传输，任务管理器看到的是多条连接的叠加，自然显得平滑。

---

## 根治方案（按推荐程度排序）

### 方案一：关闭进度条（10 秒，零副作用）

```powershell
$ProgressPreference = 'SilentlyContinue'
```

这是**最彻底、最简单**的方案。关闭后 `Invoke-WebRequest` 不再渲染进度条，下载线程不会被 UI 阻塞。

**验证对比**：

| 模式 | 下载 25 MB 耗时 | 平均速度 |
| --- | --- | --- |
| `$ProgressPreference = 'Continue'`（默认） | 180+ 秒（超时） | ~112 Kbps |
| `$ProgressPreference = 'SilentlyContinue'` | ~3.5 秒 | ~4.9 MB/s |

**永久生效**：把下面这行加到你的 PowerShell `$PROFILE` 里：

```powershell
notepad $PROFILE
# 粘贴：
$ProgressPreference = 'SilentlyContinue'
```

保存后关闭窗口，重新打开 PowerShell 即可。

> 副作用：所有使用 `Write-Progress` 的命令（如 `Copy-Item` 大文件、某些模块的安装脚本）都不会再显示进度条。如果你偶尔需要进度条，可以临时改回来：
> ```powershell
> $ProgressPreference = 'Continue'
> ```

---

### 方案二：用 `Start-Job` 后台运行

如果你**必须保留进度条**（比如给新手看的交互脚本），把下载任务放到**后台作业**中执行：

```powershell
Start-Job { Invoke-WebRequest -Uri 'https://...' -OutFile 'C:\temp\file.exe' -UseBasicParsing } | Wait-Job | Receive-Job
```

后台作业脱离 VirtualBox 控制台渲染路径，进度条在内存中更新但不会被显示到屏幕上，阻塞效应完全消失。

---

### 方案三：升级到 PowerShell 7+

PowerShell 7 优化了 `Write-Progress` 的渲染性能，开销远低于 5.1。在 VirtualBox 中测试，PS 7 的进度条虽然仍有一定开销，但不会再导致 100 Kbps 级别的崩溃。

```powershell
# 用 winget 安装
winget install Microsoft.PowerShell
```

安装后使用 `pwsh.exe` 代替 `powershell.exe`。

---

### 方案四：用远程桌面连接虚拟机（绕过 VirtualBox 控制台）

VirtualBox 自带控制台窗口的渲染性能是其最大瓶颈。如果你通过 **RDP（远程桌面）** 连接到虚拟机：

```powershell
# 在虚拟机里开启远程桌面
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0
# 使用规则名匹配，不受系统语言影响
Get-NetFirewallRule -Name "RemoteDesktop-UserMode-In-TCP", "RemoteDesktop-UserMode-In-UDP" -ErrorAction SilentlyContinue | Enable-NetFirewallRule
```

然后在宿主机上用 `mstsc` 连接 `10.0.2.15`。RDP 的显示协议（RDP 10）有自己的压缩和缓存机制，控制台渲染效率远高于 VirtualBox 原生窗口。

实测：**同一台虚拟机，同一命令，通过 RDP 连接后 IWR 下载速度恢复正常（4+ MB/s）**，即使 `$ProgressPreference = 'Continue'`。

---

### 方案五：多线程下载工具（aria2）

如果你经常需要下载大文件，直接用 aria2 绕过所有单线程瓶颈：

```powershell
winget install aria2

aria2c -x 8 -s 8 -k 1M `
    --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36" `
    "https://mirrors.tuna.tsinghua.edu.cn/..."
```

aria2 的多线程机制天然平滑了单连接的脉冲，且没有 PowerShell 进度条问题。

---

## 常见问题 FAQ

### Q1：我按方案一关了进度条，但偶尔想看下载进度怎么办？

**方式 A**：下载前临时开启（仅本次会话）
```powershell
$ProgressPreference = 'Continue'
Invoke-WebRequest ...
$ProgressPreference = 'SilentlyContinue'
```

**方式 B**：用 `curl -#` 替代 IWR（curl 的简单进度条开销极低）
```powershell
curl.exe -# -L -o file.exe "https://..."
```

### Q2：为什么任务管理器显示脉冲，但平均速度看起来还行？

因为脉冲的**峰值**会把平均值拉上去。实际观察到的 112 Kbps 是任务管理器采样窗口内的平均，如果你看更细粒度（如资源监视器的 1 秒采样），会看到大量的 0 Kbps 时段。

### Q3：这跟 VirtualBox 的「NAT 网络」模式有关吗？

关系不大。我们在测试中对比了：
- NAT 模式（默认）
- NAT 网络模式
- 桥接模式

**三种模式下，只要走 VirtualBox 自带控制台 + PowerShell 5.1 + `Write-Progress`，都会出现同样的脉冲**。换桥接不会解决控制台渲染阻塞问题。

### Q4：增加 VirtualBox 显存或换显卡类型有帮助吗？

**没有**。这不是显存不足或 3D 加速问题。VirtualBox 控制台是 2D 帧缓冲区的逐帧传输，增加显存分配给 3D/2D 视频内存对 conhost 的文本渲染没有帮助。

### Q5：为什么在 VMware / Hyper-V 自带的虚拟机连接里没这个问题？

- **VMware Workstation** 的控制台渲染性能确实比 VirtualBox 好（VMware 的显示驱动效率更高）
- **Hyper-V 增强会话模式（Enhanced Session Mode）** 基于 RDP 协议，本质上已经绕过了传统的控制台渲染路径

VirtualBox 的控制台在 WHP 兼容模式下的显示性能是其已知短板。

---

## 参考链接

- [Windows 旧版 curl 下载慢的根治方案](/posts/curl-download-slow-fix/) — 本文的姊妹篇，解决 curl 本身的 UA 限速、Schannel CRL 卡死、代理不生效等问题
- [PowerShell 执行策略与 Profile 配置指南](/posts/curl-download-slow-fix/)（本文同系列）
- VirtualBox 官方文档：[Chapter 6. Virtual Networking](https://www.virtualbox.org/manual/ch06.html)
- PowerShell 7 安装：[https://github.com/PowerShell/PowerShell](https://github.com/PowerShell/PowerShell)
