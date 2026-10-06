# HawTend 品牌候选字体

仅使用下列字体的 Latin WOFF2 子集绘制 `HawTend` 字标。文件原样保存，没有改动字形。对应 SIL Open Font License 1.1 及版权说明随项目与构建产物分发。

| 字体 | 字体文件 | 官方提供来源 | 原始许可 |
| --- | --- | --- | --- |
| Manrope | `src/assets/fonts/manrope-latin.woff2` | [Google Fonts CSS](https://fonts.googleapis.com/css2?family=Manrope:wght@400..600&display=swap) | [Manrope OFL](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt) |
| DM Sans | `src/assets/fonts/dm-sans-latin.woff2` | [Google Fonts CSS](https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..600&display=swap) | [DM Sans OFL](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt) |
| Lora | `src/assets/fonts/lora-latin.woff2` | [Google Fonts CSS](https://fonts.googleapis.com/css2?family=Lora:wght@400..600&display=swap) | [Lora OFL](https://github.com/google/fonts/blob/main/ofl/lora/OFL.txt) |

获取日期：2026-10-05。字体在构建时从本地文件打包，页面运行时不连接 Google Fonts。CSS 别名用于页面隔离，不是修改字体内部名称或宣称创造了新字体。

## 公式字体

v0.0.9 加入 KaTeX 0.19.0。渲染器和 `dist/fonts` 中的公式字体均随应用打包，运行时无需 CDN。原始版权与 MIT 许可见 [KaTeX-MIT.txt](KaTeX-MIT.txt)，上游项目为 [KaTeX](https://github.com/KaTeX/KaTeX)。
