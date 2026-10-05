# HawTend：Windows 桌面版与空白手账

记录日期：2026-10-05。用户提出希望通过 EXE 在 Windows 直接打开，并让新账号从空白手账开始，现有展示内容作为独立样例保留。

当前更新：0.0.4.0 沿用 G 图案与 Lora 字体，Windows 图标改为透明背景，桌面快捷方式已更新，见 [G 品牌统一与桌面更新](14-G品牌统一与桌面更新.md)。下面“实际验证”表记录首个桌面版的启动与数据测试；本次编译和内置资源检查已通过，未独立重启新版 EXE。

## Windows 打开方式

本地已生成 **`releases/windows/HawTend.exe`**，当前大小 3,086,336 字节，约 2.94 MiB。可以双击，也可以单独复制这个 EXE 到其他文件夹；日常运行不依赖项目源码、Node.js、npm 或 PowerShell 启动脚本。当前电脑已有 Edge 和 .NET Framework，使用它们显示独立窗口与运行轻量启动器，没有新增付费服务。

本机桌面已创建 `HawTend.lnk`，指向项目内的 EXE。透明快捷方式图标位于 `releases/windows/HawTend-transparent.ico`，打包脚本会重新生成；请保留这些文件的位置，移动后需更新快捷方式引用。EXE 自身也内置透明图标，单独复制仍可使用。

页面、样式、图标和离线脚本作为 ZIP 资源内置于 EXE。启动后通过固定 `http://127.0.0.1:4173/` 显示页面，只监听本机回环地址，不对局域网或互联网开放。如果同地址已有正常的 HawTend，会复用它；其他程序占用端口时给出提示，不自动改地址。

Edge 存在时使用应用窗口打开；找不到 Edge 时使用默认浏览器。没有安装开机服务或自动启动。EXE 自己提供页面时会有山楂托盘图标，右键可打开手账或退出；关闭页面窗口不会自动退出托盘进程。复用现有预览时启动器打开窗口后退出，不拥有原有预览进程。

个人数据仍保存在浏览器的 IndexedDB，并未写进 EXE。复制 EXE 不等于复制手账；Edge 与其他浏览器的本机记录各自独立。需要跨设备或跨浏览器使用同一份数据时，仍要接入云端账号与同步。当前没有安装包、签名和自动更新，也尚未在其他 Windows 电脑实测；后续可以继续完善桌面分发，iPhone 仍维持已确认的免费 PWA 路线。

现有 CMD 启动入口保留，方便开发预览；日常 Windows 体验优先使用 EXE。

## 空白与样例的规则

- 初次打开个人手账时：目标、大事记、资金均为空，概览显示 0；配色、插画和导航保持完整，提供记录第一天、添加心愿与配置资金的引导。
- “看看样例”打开原来的虚构记录。支持试改文字、金额和配色，但只保留在这次体验的内存中，不写入个人手账；返回或刷新后恢复个人内容。
- 样例的状态、说明与编辑提示明确标注“样例体验”。导出样例与个人手账使用不同文件名。
- 个人手账只保存自己的记录。未配置资金时显示添加资金的空状态，未填写开支与义务时以 0 开始试算，不自动带入示例金额。
- 新账号的本地存储接口按经过认证的账号 ID 分开，不继承本机手账或样例。账号注册、登录和云端初始化还未接入界面；上线时继续执行“云端无记录 → 空白手账”，不能把样例自动上传。

旧数据库 ID 保留。新增个人本机存储键 `personal-local-v1`，原来的 `current` 不覆盖也不删除：完全未改的示例记录不进入个人手账，配色可保留；改过的旧记录继续读取并保留，首次个人保存写到新键。这里优先保留旧记录，没有擅自删除其中可能已有的个人内容。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 生产构建与 Windows 编译 | 通过；使用本机 .NET Framework C# 编译器，源码与构建脚本可重新打包 |
| EXE 内置页面 | 实际独立启动 EXE 的隔离端口 4174，工作目录设为临时文件夹；读取内置 HTML、JS、清单及离线脚本通过，没有调用 Node 或项目文件读取接口 |
| 正常窗口 | 实际启动默认 EXE，复用既有 4173 预览；Windows 返回 Edge 窗口标题“HawTend · 人生手账” |
| 仅提供静态资源 | HEAD 正确，POST 返回 405，未知路径与资源外路径返回 404，其他 Host 返回 400；只绑定 127.0.0.1 |
| 空白 / 样例布局 | 在内置页面上完成 320、390、1440 三种宽度 × 四个页面 × 两种模式，共 24 项无页面横向溢出检查 |
| 样例隔离 | 修改样例感想、配色后，个人持久化数据保持原样；返回空白手账与已有个人手账均通过 |
| 个人保存与离线 | 实际新增一条虚构记录，刷新与离线重开保留；运行中没有捕获脚本或控制台错误 |
| 旧数据与账号存储 | 在独立浏览器测试配置中运行真实存储函数；纯示例跳过、旧记录保留、旧键未覆盖、本机与账号 A/账号 B 隔离通过。这是客户端存储测试，不能代替登录与云端权限测试 |
| 托盘退出、其他电脑、iPhone | 尚未完成实际交互验证；托盘图标资源可读取，不能据此宣称退出流程已实测 |

首版 EXE SHA-256：`4BF005068BA4BF69A7003D30071A0EC478128DD241B8EDDCF6E1C527B3FA758A`。当前 0.0.4.0 的哈希和资源检查结果见 [G 统一记录](14-G品牌统一与桌面更新.md)。重新编译可能产生新的二进制哈希。

截图在忽略的 `output/playwright/`：`hawtend-empty-desktop.png`、`hawtend-empty-mobile.png`、`hawtend-sample-mobile.png`。所有新增验证记录都位于独立的自动化浏览器配置中，没有清理或写入用户的实际 Edge 手账。

## 构建与维护

由助手运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows.ps1`，完成 TypeScript 检查、页面构建、离线缓存生成、资源打包和 EXE 编译。已有最新页面构建时可加 `-SkipWebBuild`。如果 EXE 正在提供页面，更新前应退出它，再重新构建；同一浏览器来源下的 IndexedDB 不随替换 EXE 清理。

`windows/HawTend.cs` 和构建脚本进入 GitHub；`releases/` 与构建中间文件排除，避免把二进制和本机日志混入源码历史。这一版仍是第 0 期本地桌面原型，没有因此完成云端同步或第 1 期正式财务模型。

技术依据：[Edge PWA 窗口体验](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux)、[Chromium 应用窗口参数](https://chromium.googlesource.com/chromium/chromium/+/master/chrome/common/chrome_switches.cc)、[.NET TCP 回环监听](https://learn.microsoft.com/en-us/dotnet/api/system.net.sockets.tcplistener)、[ZIP 内置资源读取](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.ziparchive)、[C# 资源与图标编译](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/resources)。
