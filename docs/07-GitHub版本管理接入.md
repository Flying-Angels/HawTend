# 拾光：GitHub 版本管理接入

记录日期：2026-10-05\
当前状态：GitHub 插件账号连接成功；本地 Git 已提交原型；远程仓库仍未建立。

## 已确认与已准备

GitHub 插件 `get_profile` 返回账号 **Flying-Angels**。当前插件没有可用仓库，也未提供新建仓库的工具。本机 Git Credential Manager 没有已登录的 GitHub 账号；GitHub 插件的授权不会自动变成终端 Git 的凭据。

已经补充官方 GitHub CLI `2.102.0`，验证发布资产 SHA-256，并读取 `auth login` 和 `repo create` 的实际帮助。工具路径为 `C:/Users/19620/.codex/tools/github-cli-2.102.0/bin/gh.exe`，没有修改系统 PATH。

已启动 GitHub 官方网页授权流程，等待用户使用 Flying-Angels 完成。第一次命令行直连超时；改为仅在当前进程使用系统已有代理后，成功取得设备授权码。没有修改系统代理，也没有把凭据放进项目文件。

## 远程仓库方案

| 项目 | 准备方案 |
| --- | --- |
| 归属 | Flying-Angels |
| 名称 | 待确认；不使用 `shiguang`，拟采用 Tend 与姓名元素的组合 |
| 可见性 | 私有；应用代码和需求可保存，个人账单、报告与密钥排除 |
| 远程别名 | `origin` |
| 本地开发分支 | `codex/phase0-prototype` |
| 当前已提交原型 | `b7ad6e1` |
| 云端 | 尚未创建，不能宣称已经备份到 GitHub |

名称选定且授权完成后，由助手确认终端账号、检查同名仓库，再建立私有仓库，设置远程地址并推送。首次上传包括需求文档、原型代码、依赖锁文件、云端迁移与验证代码；云端准备文件仍保留“未完成实测”的说明。

`.gitignore` 排除 `node_modules/`、`dist/`、`output/`、`.env*`（仅公开配置模板 `.env.example` 例外）、`private-data/` 和日志。浏览器手账数据存在 IndexedDB，不在代码仓库中。

版本管理与应用数据同步用途不同：GitHub 保存代码和文档历史；Windows 与 iPhone 的个人数据仍由 Supabase 同步。把代码推送到 GitHub，不等于手机已经可以访问 App，也不等于手账已经云端备份。

后续开发由助手小步提交、检查构建后推送；HTTPS 应用托管和真实双端同步另行完成。用户只需完成账号登录授权。

## 名称方向与初筛

用户希望英文短名包含 `zhong haowen` 的个人元素，保留 Tend 的“照料生活”含义，并尽量避免同名应用。当前候选是自造组合名，尚未选定；不会使用旧名称创建云项目或远程仓库。现有原型内部标识不在选名前批量改动。

| 候选 | 组合方式 | 中 / 美 App Store 完全同名结果 |
| --- | --- | --- |
| HaoTend | Hao + Tend | 0 / 0 |
| HWTend | Haowen 首字母 HW + Tend | 0 / 0 |
| HawTend | Hao 的 Ha + Wen 的 W + Tend | 0 / 0 |
| HowTend | Hao 的自定义缩写 Ho + Wen 的 W + Tend；呼应英文 how | 0 / 0 |
| ZHWTend | 全名首字母 ZHW + Tend | 0 / 0 |

2026-10-05 使用 Apple 官方搜索 API，分别查询中国和美国的 software 分类，每次最多 200 条，按应用名称不区分大小写进行完全匹配。部分查询返回近似名称，但没有完全同名结果。另对 HaoTend、HWTend、HowTend、HawTend 查询公开搜索及 Apple/Google 应用页面，未发现明确同名应用。这是有限范围的初筛，不能证明所有国家、未索引网站和未公开应用中没有同名。

可复核的查询示例：[HaoTend 中国区](https://itunes.apple.com/search?term=Haotend&entity=software&country=cn&limit=200)、[HaoTend 美国区](https://itunes.apple.com/search?term=Haotend&entity=software&country=us&limit=200)、[HWTend 中国区](https://itunes.apple.com/search?term=HWTend&entity=software&country=cn&limit=200)、[HawTend 美国区](https://itunes.apple.com/search?term=Hawtend&entity=software&country=us&limit=200)。
