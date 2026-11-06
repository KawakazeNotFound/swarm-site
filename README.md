# Swarm site — 源码重建版

本工程由仓库内已有的静态发布文件重建，使用 React 18.3.1 和 Vite。
页面内容、固定坐标布局、多光标绘制、滚动调度、辅助线和标尺沿用发布版逻辑。
变量名、模块划分及构建配置按代码职责重新整理，不代表作者原始工程的命名或目录结构。

## 本地运行

需要 Node.js 20.19+ 或 22.12+（支持 Node.js 24）。在项目根目录运行：

```powershell
npm install
npm run dev
```

打开终端显示的本地地址。初始画面是 Logo 和环绕光标，向下滚动会启动页面绘制；鼠标与环绕光标碰撞也能启动。
终端按 `Ctrl+C` 停止服务。源码修改后开发页面会自动更新。

## 构建与预览

```powershell
npm run build
npm run preview
```

`dist/` 是重新生成的静态站点，可交给静态托管服务。托管目录应选 `dist/`，而不是包含 JSX 源码的项目根目录。
构建使用相对资源路径，适合部署在站点子目录。此仓库没有新增线上发布流程。

## 从哪里修改

| 文件 | 职责 |
| --- | --- |
| `src/Main.jsx` | React 入口、全局样式加载 |
| `src/App.jsx` | 字体等待、浏览器事件、视口尺寸与逐帧更新 |
| `src/scene/CreateScene.js` | 页面文案、板块、布局坐标及绘制任务依赖 |
| `src/scene/Theme.js` | 颜色、字体样式、页面尺寸、Logo 路径 |
| `src/scene/TextMetrics.js` | Canvas 文字测量和换行尺寸缓存 |
| `src/engine/SwarmEngine.js` | 任务分配、光标运动、绘制与编辑动画 |
| `src/engine/CursorSettings.js` | 光标配色、名称、数量设置 |
| `src/engine/AnimationMath.js` | 随机数、缓动与元素版本更新 |
| `src/components/` | 文本、矩形、路径、光标、选区、标尺及导航渲染 |
| `src/Styles.css` | 页面和动画图层样式 |

修改标题和介绍时，先在 `CreateScene.js` 中搜索当前英文文案。
其中 `addText`、`addRectangle`、`addPath`、`addGuide` 建立元素和对应绘制任务；`duplicateGroup` 复用卡片或栏目。
元素和任务的字符串 ID 用于依赖关系，并不是浏览器 DOM ID；重命名时需同时修改关联引用。
任务 `dependencies` 表示先后顺序，`snapGuideId` 表示文字对齐的辅助线，`animateSize` 表示逐步放大字体。

## 当前行为与博客改造边界

- 这是交互式展示页；按钮、定价和示例配置仍是展示内容，没有连接 Agent 服务、登录或支付接口。
- 页面按 1280 宽的设计画布缩放，采用固定坐标，不是随文章长度自动排版的博客模板。
- 保留了发布版的滚动触发和逐字绘制行为；长文、文章列表、分类和搜索需作为后续功能设计。
- 外部字体来自 Google Fonts；网络状况可能影响字体和文字尺寸。
- 既有 `assets/` 发布文件保持原样，当前源码入口不再加载它们；`npm run build` 将新产物写入 `dist/`。
- 原始注释、TypeScript 类型和作者的文件划分没有打包进发布文件，本工程没有将推测当作原始信息。
