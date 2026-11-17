# 像素飞行 · Fighter Remix

独立运行的 React 游戏，来自本仓库 `forge-backups/fighter-remix/` 中的 Forge 分享预览备份。保留原游戏操作，并增加可收起的实时调节面板，参数自动保存在当前浏览器，支持恢复默认设置。

## 本地开发

需要 Node.js 20.19+ 或 22.12+。

```sh
cd games/fighter
npm ci
npm run dev
```

- `src/components/fighter-jet-eject.js`：游戏界面、输入和 HUD。
- `src/lib/eject/scene.js`：场景、飞行、战斗和默认参数。
- `src/lib/jet-model.js`、`pilot-model.js`：模型数据。
- `src/main.jsx`：独立页面和参数设置面板。
- `src/controls.json`：设置面板配置。
- 音效直接引用 `../../forge-backups/fighter-remix/assets/`，构建时自动复制到发布目录。

源码以 JavaScript 形式继续维护，移除了 Forge 的导入版本参数；音频导入改用 Vite 的 `?url`。原始预览备份仍保存在 `forge-backups/`。

## 发布更新

在仓库根目录运行：

```sh
npm ci --prefix games/fighter
npm run build --prefix games/fighter
```

将 `games/fighter/` 的源码变更和生成的 `fighter/` 目录一同提交到 `main`。现有 GitHub Pages 从主分支根目录发布，游戏位于 `/dark-gate-dungeon/fighter/`。

音频需要第一次点击或按键后才会播放。所有 32 个原始资源均保存在备份目录；游戏模型本身由代码数据绘制，PNG 是参考图片。
