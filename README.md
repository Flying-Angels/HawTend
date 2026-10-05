# HawTend · 人生管理 App

整体需求审阅通过，用户已同意进入下一阶段。当前处于第 0 期：视觉设计、交互原型与可行性验证。用户已确认名称 **HawTend** 与 Q 版山楂 Logo 方向；本地 PWA 已更新名称和图标。Supabase 账号连接已验证，免费项目与同步基础代码已准备；应用仍只保存本地数据。

已确认：先供本人使用；界面温暖、有生活感，接近个人手账；Windows 与 iPhone 支持云端同步；UI 和交互质量为核心要求。

## 审阅顺序

先看 [整体审阅与第 0 期设计](docs/04-整体审阅与第0期设计.md) 和 [实际验证记录](docs/05-第0期验证记录.md)。本次启动的 [本地原型](http://127.0.0.1:4173/) 仅供这台电脑使用；手机界面可在缩小浏览器窗口后查看，iPhone 实机使用需后续 HTTPS 托管。

1. [需求与分期计划](docs/01-需求与分期计划.md)：先确认功能理解、第一版范围和分期顺序。
2. [技术选型与接入边界](docs/02-技术选型与接入边界.md)：查看 Windows/iOS、云端同步、支付宝和健康数据的实现路径。
3. [Skills 与项目准备](docs/03-Skills与项目准备.md)：查看已安装能力、待连接服务和当前准备状态。

需求文档：v0.4；技术文档：v0.6。2026-10-05 进入第 0 期，完整功能与分期维持已暂定方案。云端准备状态见 [免费云同步接入记录](docs/06-免费云同步接入记录.md)。

本次补充：大事记的独立感想、重要程度与分类颜色；多笔存款的年化收益、计息与到期配置，纳入建议的第 1 期收入推算。

本轮原型包含我的手账、人生时间轴、心愿与目标、资金安排。可以新增/编辑目标、大事记与资金，保存感想、分类与三级重要程度，预览日期调整并撤销，切换三种配色，导出 JSON。编辑只保存到当前浏览器的 IndexedDB 中，不会跨设备同步。初始数据均为虚构示例，参考日固定为 2026-10-05；请先用虚构内容审阅。

GitHub 网页授权已成功，已创建 [Flying-Angels/hawtend](https://github.com/Flying-Angels/hawtend) 私有仓库并配置 `origin`；代码、文档和品牌资产已推送到 `main` 与 `codex/phase0-prototype`，见 [GitHub 接入记录](docs/07-GitHub版本管理接入.md)。依赖、构建产物、截图、个人账单、健康报告及密钥排除在版本库之外。Logo 原图、生成提示词和实际界面检查见 [HawTend 品牌与 Logo](docs/08-HawTend品牌与Logo.md)。

## 开发与预览

```powershell
npm ci
npm run build
npm run check:finance
npm run check:cloud
npm run preview
```

开发使用 `npm run dev`；离线检查使用构建后的 `npm run preview`。锁文件固定实际验证过的依赖。此电脑已有 Node 24.19.0；补充的 npm/npx 与 Playwright CLI 位于 `C:/Users/19620/.codex/tools/life-app-toolchain/node_modules/.bin/`，需要时临时加入当前终端 PATH，未修改系统 PATH。

`src/` 是原型代码，`public/` 包含清单和原创图标，`scripts/build-sw.mjs` 构建后生成离线页面缓存，`scripts/check-finance.ts` 检查资金边界。截图和浏览器检查辅助文件位于 `output/playwright/`，不进入 Git。原型的近似计算范围见设计文档，尚不能代替正式财务模型。

Supabase 插件已安装并连接，用户已选 FlyingAngels；组织为 Free，新项目工具报价为 0 美元/月。项目费用确认仍待用户回复，当前没有创建云项目或上传手账。已经准备 CLI 生成的迁移、行级权限与版本校验、回滚测试 SQL，以及未接入界面的类型化云端适配器。

下一步：完成费用确认后创建项目并执行权限测试，配置应用登录与 HTTPS 托管，随后接入同步并验证 iPhone。账号登录和授权由用户完成，技术配置由助手执行。第 0 期整体仍未验收完成。
