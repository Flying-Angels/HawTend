# 人生管理 App：Skills 与项目准备

首次准备日期：2026-10-04\
更新日期：2026-10-05\
状态：已完成 skills 与需求准备；用户同意进入第 0 期，已创建并检查本地 PWA 交互原型。

## 1. 已补充的 skills

从 [OpenAI 官方 skills 仓库](https://github.com/openai/skills/tree/main/skills/.curated) 累计安装了 9 个 skills，另外创建了 1 个项目专用 skill。2026-10-05 按已选 PWA 路线补充 Playwright，共 10 个。

| Skill | 本项目中的用途 | 当前状态 |
| --- | --- | --- |
| figma | 获取设计上下文、截图、变量和素材 | 已安装；使用外部设计文件需可用的 Figma 连接 |
| figma-create-new-file | 后续创建新的设计文件 | 已安装；本轮未创建文件 |
| figma-use | 后续在 Figma 中编辑设计节点 | 已安装；本轮未调用 |
| figma-generate-design | 后续生成和调整页面设计 | 已安装；需先确认设计阶段和服务连接 |
| figma-implement-design | 按审阅设计落实界面，并对照设计截图 | 已安装；本轮未实施界面 |
| screenshot | 检查运行中的 Windows 界面，保留视觉验证证据 | 已安装；本轮未截图 |
| playwright | 检查 PWA 页面操作、浏览器状态和运行截图 | 已补充 CLI，实际执行桌面/手机视口、离线、保存失败与流程检查 |
| gh-fix-ci | 应用开发后排查 GitHub Actions 检查失败 | 已安装；需可用仓库、CLI 与身份验证 |
| gh-address-comments | 应用开发后处理 GitHub 评审意见 | 已安装；需可用仓库与身份验证 |
| life-app-experience | 维护本项目的手账视觉、统一时间轴和双端交互评审规则 | 已创建，通过 skill-creator 官方格式校验；只作用于此产品 |
| supabase:supabase | 核实免费项目、配置客户端、认证和行级权限 | Supabase 插件提供，已读取并使用；账号连接已验证 |
| supabase:supabase-postgres-best-practices | 设计用户隔离、索引、版本校验与数据库权限测试 | Supabase 插件提供，已读取并使用；数据库实测待项目创建 |

安装目录为 `C:/Users/19620/.codex/skills/`。上述 skills 在当前会话已可用；安装 skill 不等于连接其依赖的外部账户。

项目专用 skill 路径：`C:/Users/19620/.codex/skills/life-app-experience/SKILL.md`。其中记录已确认的个人使用、温暖手账风格和云端同步偏好；具体配色、页面设计和当前分期提案仍以用户审阅后的文档为准。

## 2. 已有能力与后续用途

当前会话已有文档、PDF、图像生成、可视化和电子表格相关 skills。本轮交付采用 Markdown，方便审阅和未来 GitHub 版本管理，未额外生成 Word/PDF。

后续按实际任务使用：图像能力可辅助插画和视觉参考；文档/PDF 能力可辅助报告样本处理；可视化能力可辅助说明资金与时间轴交互。它们不是最终 App 自动拥有的功能，App 内对应能力仍需单独开发。

已创建 React/TypeScript/Vite 工程、PWA 清单与图标、离线资源缓存；未配置托管服务，不需要 Flutter/Xcode。本机已有 Node 24.19.0，npm/npx 与 Playwright CLI 补充在 `C:/Users/19620/.codex/tools/life-app-toolchain/`，未修改系统 PATH。项目依赖由锁文件固定。

## 3. 外部服务连接状态

| 服务 | 本轮结果 | 后续动作 |
| --- | --- | --- |
| GitHub | 插件与 CLI 账号 Flying-Angels 连接可用，网页授权已完成；HawTend 公开仓库已建立 | `main` 与 `codex/phase0-prototype` 均已推送，安装方式见 README，变更见 [接入记录](07-GitHub版本管理接入.md) |
| Figma | 插件已安装；身份查询返回尚未连接账号 | 需要在 Figma 中保存可编辑设计时，登录并连接账号 |
| Supabase 云数据库 | 插件与账号已连接；用户选择 FlyingAngels；Free 与新项目 0 美元/月已核实 | 费用确认待回复；助手创建项目并配置权限，随后验证实际连接与同步 |
| 应用托管 | 拟用 Cloudflare Pages Free，未部署 | 助手配置 HTTPS 托管，随后验证手机访问与登录回调 |
| iPhone 使用 | 已选 PWA，完成 Chromium 手机宽度布局检查 | 尚未验证 Safari 实机、安装、触摸及后台恢复；不要求 Mac 或 Apple 开发者会员 |
| 支付平台 | 只做公开接口可行性核实 | 不宣称已取得个人流水权限 |

GitHub 的连接已验证，Figma 还需要账号连接；当前状态不影响本轮需求文档交付。Figma 也不是完成产品设计的唯一方式；若不连接，可在后续采用本地设计与原型流程。

## 4. 本轮文件

- `README.md`：项目入口与文档阅读顺序。
- `docs/01-需求与分期计划.md`：需求、场景、首版范围、UI 验收和分期。
- `docs/02-技术选型与接入边界.md`：技术推荐、双端实现、同步设计和外部能力边界。
- `docs/03-Skills与项目准备.md`：本文件，记录准备状态。

截至 2026-10-05，需求文档 v0.4、技术文档 v0.6 已同步阶段状态。新增本地原型代码、整体设计说明与实际验证记录，保留运行截图；Supabase 已连接，云端迁移与适配器已准备。HawTend 名称与 Q 版山楂方向已确认，GitHub 私有仓库已创建；数据库和外部 Figma 文件尚未创建，应用尚未发布。第 0 期整体仍需应用账号与实机验证。当前云端准备见 [免费云同步接入记录](06-免费云同步接入记录.md)。
