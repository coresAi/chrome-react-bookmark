# Chrome Extension Updater

Chrome 扩展自动更新服务器。

## 使用方法

### 1. 开发模式（直接加载）

```bash
# 打包扩展
cd chrome-react-bookmark
npm run build

# 复制到更新服务器目录
cp -r dist-chrome/* ../chrome-extension-updater/dist/
```

### 2. 安装扩展到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `chrome-react-bookmark/dist-chrome` 目录

### 3. 自动更新配置

1. 获取扩展 ID（在 Chrome 扩展管理页面）
2. 修改 `server.js` 中的 `EXTENSION_ID`
3. 部署到服务器
4. 修改扩展的 `manifest.json` 中的 `update_url`

### 4. 启动更新服务器

```bash
cd chrome-extension-updater
node server.js
```

## 快捷键

- **⌘+J** (Mac) / **Ctrl+J** (Windows): 打开搜索框
- **↑↓**: 导航
- **Enter**: 打开
- **⌘+Enter**: 新标签页打开
