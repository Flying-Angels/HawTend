# HawTend：GitHub 版本管理接入

初始记录日期：2026-10-05；更新日期：2026-10-06。\
当前状态：按用户要求使用 **Flying-Angels/HawTend** 大小写名称并将仓库改为 **Public**，保留原仓库和提交历史。README 已改为产品介绍与实际安装指南，Windows 包通过 GitHub Release 下载。下文保留首次私有仓库建立时的过程记录。

## 已确认与已准备

GitHub 插件 `get_profile` 返回账号 **Flying-Angels**。初始插件没有可用仓库，也未提供新建仓库的工具；已通过 GitHub CLI 完成新建。GitHub 插件的授权不会自动变成终端 Git 的凭据，命令行网页授权已经另外完成。

已经补充官方 GitHub CLI `2.102.0`，验证发布资产 SHA-256，并读取 `auth login` 和 `repo create` 的实际帮助。工具路径为 `C:/Users/19620/.codex/tools/github-cli-2.102.0/bin/gh.exe`，没有修改系统 PATH。

GitHub 官方网页授权成功，`gh auth status` 核实账号 Flying-Angels，凭据保存在系统 keyring；已为 github.com 配置 GitHub CLI 凭据助手。命令行连接使用当前进程的系统已有代理，没有修改系统代理，也没有把凭据放进项目文件。

## 远程仓库方案

| 项目 | 准备方案 |
| --- | --- |
| 归属 | Flying-Angels |
| 名称 | `HawTend`，大小写与产品名一致 |
| 可见性 | 公开；应用代码和需求可查看，个人账单、报告与密钥排除 |
| 远程别名 | `origin` |
| 远程地址 | `https://github.com/Flying-Angels/HawTend.git` |
| 默认分支 | `main`，已推送并核实 |
| 本地开发分支 | `codex/phase0-prototype` |
| 首个原型提交 | `b7ad6e1`；之后按小步提交持续同步 |
| 云端 | 公开仓库，默认分支与开发分支均已上传 |

已确认终端账号，检查同名仓库不存在，再建立私有仓库并配置 `origin`。已推送默认分支 `main` 与开发分支 `codex/phase0-prototype`，通过 `git ls-remote` 核实首批上传对应品牌提交 `9d7840b`，GitHub 返回 `isPrivate: true`。首次上传包括需求文档、原型代码、依赖锁文件、品牌资产、云端迁移与验证代码；云端准备文件仍保留“未完成实测”的说明。本次状态说明作为后续小步提交同步。

`.gitignore` 排除 `node_modules/`、`dist/`、`output/`、`.env*`（仅公开配置模板 `.env.example` 例外）、`private-data/` 和日志。浏览器手账数据存在 IndexedDB，不在代码仓库中。

版本管理与应用数据同步用途不同：GitHub 保存代码和文档历史；Windows 与 iPhone 的个人数据计划由 Supabase 同步，但尚未接入。把代码推送到 GitHub，不等于手机已经可以访问 App，也不等于手账已经云端备份。

后续开发由助手小步提交、检查构建后推送；HTTPS 应用托管和真实双端同步另行完成。GitHub 账号登录授权已完成，不需要再次登录。

## 名称方向与初筛

用户希望英文短名包含 `zhong haowen` 的个人元素，保留 Tend 的“照料生活”含义，并尽量避免同名应用。以下保留初筛记录；用户现已正式选定 **HawTend**，同时确认 Q 版山楂 Logo 方向。旧本地数据库 ID 为兼容已有内容继续保留，不作为对外产品名。

| 候选 | 组合方式 | 中 / 美 App Store 完全同名结果 |
| --- | --- | --- |
| HaoTend | Hao + Tend | 0 / 0 |
| HWTend | Haowen 首字母 HW + Tend | 0 / 0 |
| HawTend | Hao 的 Ha + Wen 的 W + Tend | 0 / 0 |
| HowTend | Hao 的自定义缩写 Ho + Wen 的 W + Tend；呼应英文 how | 0 / 0 |
| ZHWTend | 全名首字母 ZHW + Tend | 0 / 0 |

2026-10-05 使用 Apple 官方搜索 API，分别查询中国和美国的 software 分类，每次最多 200 条，按应用名称不区分大小写进行完全匹配。部分查询返回近似名称，但没有完全同名结果。另对 HaoTend、HWTend、HowTend、HawTend 查询公开搜索及 Apple/Google 应用页面，未发现明确同名应用。这是有限范围的初筛，不能证明所有国家、未索引网站和未公开应用中没有同名。

可复核的查询示例：[HaoTend 中国区](https://itunes.apple.com/search?term=Haotend&entity=software&country=cn&limit=200)、[HaoTend 美国区](https://itunes.apple.com/search?term=Haotend&entity=software&country=us&limit=200)、[HWTend 中国区](https://itunes.apple.com/search?term=HWTend&entity=software&country=cn&limit=200)、[HawTend 美国区](https://itunes.apple.com/search?term=Hawtend&entity=software&country=us&limit=200)。
