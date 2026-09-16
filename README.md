# 燕云十六声 彩字工坊

一个纯静态、本地可直接打开的彩字文案工具，包含：

- 彩字编辑：支持快捷色、单色包裹、双渐变、多色渐变
- 所见即所得：编辑区本身就是实时彩字预览
- 一键复制：导出为游戏可用的分段颜色标签

## 直接使用

1. 直接打开 [index.html](./index.html)
2. 在编辑区输入或粘贴文案
3. 选中文字后使用上方按钮包裹颜色标签
4. 在编辑区底部直接复制结果；需要时可展开查看标签代码

## 支持的标签语法

- 快捷色：`#R你好`
  - 适合快速标一小段连续文字
  - 会在遇到空格、标点或下一段标签时结束
- 单色：`[c=#ff6a3d]你好，我是你师傅[/c]`
  - 适合精确控制范围
- 双渐变：`[g=#ff6a3d>#ffd166]邀我入画[/g]`
- 多色渐变：`[m=#f94144,#f8961e,#f9c74f,#90be6d]我进去保护你们[/m]`

## 说明

- 当前工具采用“编辑语法”和“导出语法”分离的方式
- 编辑时可以使用更好写的区块标签
- 导出时单色内容只保留一个颜色代码；渐变内容会按色程智能压缩为有限色段，避免长文案逐字插入颜色代码

## 渐变分段规则

- 短文本和人工逐字配色保持原样，避免误压缩精细配色。
- 长渐变根据总色程与文本长度决定色段数量，双渐变通常只需数个至十余个色段，多色渐变最多 18 段。
- 分段会优先落在空格和常见标点附近；中文连续文本则按均匀长度分段。
- 编辑器中的渐变视觉不受影响，压缩只作用于复制出的游戏标签。

## 修改记录

### 2026-09-14 渐变导出改为智能分段

- 渐变不再为每个字输出一个新的颜色代码。
- 新增基于 RGB 色程、文本长度和标点边界的分段算法，并将渐变分段上限限制为 18 段。
- 单色与短文本保留精确输出；只压缩连续、平滑的长渐变彩字。跳色或反复改色的手工样式会保留原有颜色变化。

### 2026-09-14 导出分段规则按游戏新版调整

- `app.js` 中的 `toCanonicalTaggedText` 已移除“遇到空格/标点就重置颜色代码”的旧逻辑
- 现在导出规则改为：只有在颜色真正发生变化时，才会重新插入颜色代码
- 这意味着：
  - 同一整段如果只有一个颜色，开头只会保留一个颜色代码
  - 同色内容中间即使出现空格、逗号、句号等标点，也不会在后面重复补颜色代码
- 同步删除了不再使用的 `DELIMITER_PATTERN` 常量

### 2026-07-06 适配 1920×1080 视口的紧凑化调整

- 目标：让 `<main class="studio-grid">` 区域内的全部内容在 1920×1080 浏览器视口内一屏可见，不出现滚动条
- `styles.css` 主要调整（保持原有的版式与古风纸面质感）：
  - `.page-shell` 上下 padding：`18px 0 32px` → `12px 0 20px`
  - `.topbar` padding：`22px 24px` → `14px 22px`
  - `.brand-logo` 从 56×56 改成 44×44，并同步收紧圆角与内边距
  - `h1` 字号 `clamp(1.8rem, 2.4vw, 2.7rem)` → `clamp(1.55rem, 1.8vw, 2.1rem)`；副标题字号收为 0.92rem、margin 减小
  - `.workflow-banner` margin-top / padding 都收紧
  - `.panel` padding：`20px` → `16px 18px`；`.studio-grid` gap / margin-top 同步缩小
  - `.current-color-box` 内边距与字号都收一档
  - `.mode-panel-wrap` padding / 圆角 / margin-top 整体收紧
  - `.mode-tab / .ghost-button / .ink-button / .seal-button / .chip-button`：min-height `42px → 36px`，padding / 字号同步收紧
  - `.step-pill / .stat-pill / .tag-pill / .pool-pill / .selection-hint`：min-height `36px → 30px`，padding / 字号同步收紧
  - `.swatch-button`、`.swatch-dot`、`.gradient-strip`、`.swatch-pair`、`.swatch-grid`、`.color-swatch` 尺寸与圆角都略微缩小
  - `input / textarea` padding / 圆角收一档，textarea min-height 与字号同步
  - `.editor-card / .rich-editor`：从 `min-height: 380px` 压到 `240px`，字体 `1.05rem → 1rem`
  - `.preview-shell / .preview-stage`：从 `min-height: 320px` 压到 `200px`，行高 / 字号同步
  - `.status-text` 上下 margin、字号同步收紧

### 2026-07-06 添加 logo.svg 作为页面图标与品牌标识

- `index.html` `<head>` 中追加 favicon / 移动端图标 / 主题色：
  - `<link rel="icon" type="image/svg+xml" href="./logo.svg">`
  - `<link rel="apple-touch-icon" href="./logo.svg">`
  - `<link rel="mask-icon" href="./logo.svg" color="#FF743E">`
  - `<meta name="theme-color" content="#FF743E">`
- 顶部 `topbar` 内新增品牌区 `.brand-block`，把 `logo.svg` 显示在标题左侧，与「YANYUN COLOR STUDIO / 燕云十六声 彩字工坊 / 副标题」水平排列
- `styles.css` 新增 `.brand-block` / `.brand-logo` 样式：56×56 圆角阴影方块；720px 以下窄屏自动缩到 44×44
- 主题色 `#FF743E` 取自 logo 本身的橙色，与「快捷色板」中的橙金色形成呼应

### 2026-07-06 双渐变 / 多色渐变改为可点击色块

- 原来的「双渐变」/「多色渐变」通过文本输入框手填 hex 值，使用门槛较高
- 现在两种模式均改为可点击的圆角方块：
  - 双渐变：两个大方块，中间用 `→` 表示方向，点击任一方块弹出系统颜色选择器
  - 多色渐变：6 个方块水平排列，点击任一方块弹出系统颜色选择器
- `index.html` 新增 `.swatch-pair` / `.swatch-grid` 结构与隐藏的 `type=color` 输入，分别承担「显示色块」与「弹出选色」两个角色
- `app.js`：
  - 新增 `DEFAULT_GRADIENT_PALETTE` 默认 6 色数组与 `paletteColors` 状态
  - 新增 `renderPaletteSwatches` / `syncSwatch`，把方块与 color input 双向绑定
  - `getPaletteValues` 改为读取内存中的 `paletteColors`，不再解析文本输入
  - 替换 `bindEvents` 中针对渐变模式的监听逻辑：方块背景随 color input 实时更新，同时刷新渐变预览条
  - `init` 中调用 `renderPaletteSwatches`
- `styles.css` 新增 `.swatch-pair / .swatch-grid / .swatch-wrapper / .color-swatch / .swatch-picker / .swatch-arrow / .field-hint` 等样式，统一色块视觉与整体风格保持一致；窄屏下方块网格自动从 6 列折成 3 列双行

### 2026-07-06 颜色代码统一改为小写 hex

- 燕云游戏只识别小写 hex（如 `#ff0000`），大写写法（如 `#FF0000`）会被识别失败
- `app.js` 中 `normalizeHex` / `rgbToHex` / `colorStringToHex` 全部改为输出小写 hex，并匹配小写校验正则
- `PRESET_COLORS` 中的预设色值改成小写
- `buildStats` 统计独特颜色时改用小写归一化
- `index.html` 中 `currentColorDisplay` 与 `singleHexInput` 默认占位文本同步改成小写示例
- README 文档示例同步改为小写

### 2026-07-06 精简核心可视编辑功能

- 删除 index.html 中被注释的「高级标签模式」和「乐子文库与灵感池」两块折叠面板及其内部所有 DOM 节点
- 删除 app.js 中依赖上述 DOM 的所有逻辑：markupEditor / libraryList / categoryFilters / selectedPool / customText 等元素引用、`parseQuickTagRun` / `parseMarkupToChars` / `syncMarkupEditor` / `importMarkupToVisual` / `buildPromptFromSelection` / `getCombinedLibrary` / `uniqueCategories` / `matchesSearch` / `filteredLibrary` / `renderCategoryFilters` / `renderSelectedPool` / `appendTextToEditor` / `renderLibrary` / `loadLibrary` / `addCustomEntry` / `exportLibrary` / `importLibrary` 等函数、`builtInLibrary` / `customLibrary` / `activeCategory` / `selectedPromptIds` 等状态变量、`FALLBACK_LIBRARY` / `STORAGE_KEYS.customLibrary` 等常量、`loadLocalJson` / `saveLocalJson` 等工具函数以及所有对应的事件绑定
- 核心功能修复：`toCanonicalTaggedText` 中不再预设色板的自定义颜色输出格式由 `#{F94144}` 修正为 `#F94144`（去掉多余的大括号）
- 调整入口文案：移除对已删除的高级标签区的引用
- 页面结构、样式与整体风格保持不变
