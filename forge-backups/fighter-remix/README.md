# fighter remix 游戏备份

来源：[Forge 分享项目](https://forge.ui8.ai/share/frag_f88d18ca-218d-4194-abde-ee631568c2af)。

这是从该项目公开分享预览保存的备份，预览返回版本为 **5**；保存时项目资料标记的发布版本为 **4**。

- `src/`：10 个预览代码模块，包括飞机组件、场景、模型、火焰、音效和教程。
- `index.css`：预览样式。
- `assets/`：32 个资源文件，包括 2 张 PNG 图片和 30 个 MP3 音效；已逐个核对项目清单中的 SHA-256。
- `project-metadata.json`：保存时的公开项目资料和资源清单。

## 当前状态

代码由 Forge 预览服务器转换，保留原 `.ts` / `.tsx` 路径，但 TypeScript 类型已移除，JSX 已转换为 JavaScript。导入路径仍包含预览版本参数。此目录不是完整的原始 TypeScript 工程导出，没有本地启动配置，尚未验证游戏能在 Forge 外运行。

文件保存自用户提供的分享副本；原作者信息见项目资料中的 `remixedFrom`。本备份未附加新的开源许可证。

## 可运行版本

独立运行及继续开发的工程位于 [`../../games/fighter/`](../../games/fighter/)，构建后的网页位于 [`../../fighter/`](../../fighter/)。本目录保留预览备份。
