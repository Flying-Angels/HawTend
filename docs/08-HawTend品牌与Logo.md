# HawTend：品牌与 Logo

日期：2026-10-05\
名称：用户已正式确认 **HawTend**。\
视觉方向：用户提出并确认 Q 版山楂方向；本文件记录生成后的首版资产及实际应用检查。

## 名称与视觉

**Ha** 来自 Hao，**W** 来自 Wen，**Tend** 表达照料生活。品牌联想是“认真照料自己的生活，也记录慢慢长大的自己”。这是自造组合名。仓库与包名称使用小写 `hawtend`。

Logo 为一颗暖红色的山楂，有短棕色果柄、鼠尾草绿的裂叶、简单的眼睛与微笑，以及底部的星形花萼。它沿用暖纸手账的生活感，作为名称旁的小标记和安装图标；文字名称由界面排版绘制，没有把文字烘焙进图像。

## 生成与资产

使用 **内置 image_gen 工具**，请求真正透明的背景；没有调用 CLI/API 回退。原图为 1254 × 1254 RGBA PNG，角点 alpha 为 0。原图已复制到项目中，不依赖生成工具目录。安装图标用同一幅原图缩放并置于暖纸底色；没有改变人物表情、果实或叶片。

| 文件 | 用途 |
| --- | --- |
| [透明原图](../public/brand/hawtend-mascot-v1.png) | 生成后的原始品牌角色，1254 × 1254 |
| [256px 透明 Logo](../public/brand/hawtend-logo-256.png) | 预览与常规使用 |
| [128px 界面标记](../src/assets/hawtend-mark-128.png) | 桌面和手机页头，构建后带内容哈希；约 21 kB |
| [512px 安装图标](../public/hawtend-icon-512.png) | 通用图标；另有 192px 版本 |
| [512px 可裁切图标](../public/hawtend-maskable-512.png) | 角色放在安全区内，适应系统圆形等裁切 |
| [180px Apple 图标](../public/hawtend-apple-touch-180.png) | iPhone 主屏幕图标配置 |
| [32px 浏览器图标](../public/hawtend-favicon-32.png) | 浏览器标签 |
| [图标生成脚本](../scripts/build-brand-icons.ps1) | Windows 维护工具；普通 npm 构建无需执行 |

## 实际应用与验证

- 界面名称、页头标记、对话框、导出文件名、网页标题与 PWA 清单已改为 HawTend。
- 在 Chromium 以 320、390、768、1024 和 1440px 五种宽度检查：首页没有水平溢出，名称与状态栏没有重叠，Logo 均加载成功。
- 320px 离线重载后，名称和 Logo 仍显示，三个安装图标、Apple 图标与浏览器图标均能离线读取。
- 可裁切图标的中心 80% 直径安全圆外，没有检测到明显的角色像素；背景保持实色。
- 保留原本的 IndexedDB 名称 `shiguang-prototype-v1`，避免改名造成旧手账看似消失。在独立测试浏览器中写入虚构旧记录后重载，新界面可以读取；随后恢复测试前状态。
- Service Worker 缓存改用 `hawtend-` 前缀，并在新版本激活时清理旧应用前缀；版本哈希覆盖界面、Logo、清单与图标内容，因此单独改图标也会生成新缓存版本。
- TypeScript 和生产构建通过。截图来自运行中的本地原型；这次没有声称完成 iPhone Safari 实机安装验证。

界面截图：[桌面首页](../output/playwright/hawtend-desktop-home.png)、[手机首页](../output/playwright/hawtend-mobile-home.png)、[320px 离线首页](../output/playwright/hawtend-mobile-offline-320.png)、[手机设置](../output/playwright/hawtend-mobile-settings.png)。截图位于忽略的 `output/`，保留在本地，不上传 GitHub。

## 本次完整生成提示词

```text
Use case: logo-brand.
Asset type: transparent mascot logomark for HawTend, a personal life journal PWA for Windows and iPhone.
Primary request: create one original adorable chibi hawthorn berry character logo, warm and calm, suitable as a polished app icon and a small header mark.
Subject: one plump round hawthorn fruit in muted warm brick red, with a short brown stem and a single small lobed sage-green hawthorn leaf; a tiny dark five-point calyx at the lower end distinguishes the fruit. Two simple dark dot eyes, a very small gentle smile, subtle soft rosy cheeks. Keep the fruit spherical rather than heart-shaped. No arms or legs.
Style: clean flat illustration with organic rounded shapes, soft matte colors, minimal gentle shading, crisp silhouette, quiet personal-journal aesthetic. Original character, no imitation of any existing mascot.
Composition: square canvas, centered single character, generous clear padding, character about 72 percent of canvas height including the leaf, fully visible and readable when reduced to a small app icon.
Palette: warm clay/berry red, sage green matching #566958 and #73866a, cocoa-brown facial details. Transparent background with genuine alpha.
Text: none; the HawTend wordmark will be rendered separately in the app.
Constraints: no scenery, no surrounding stickers, no lettering, no badge, no watermark, no white background, no mockup, no grid, no duplicate characters; avoid a cherry, apple, strawberry or tomato silhouette.
```
