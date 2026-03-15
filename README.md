# chrome-react-bookmark

书签收藏夹 - 一键收藏、快捷搜索的浏览器插件

## 功能

1. **一键收藏** - 点击插件图标，自动收藏当前页面
2. **快捷搜索** - 按 `⌘+Shift+S` 在当前页弹出悬浮搜索框
3. **模糊搜索** - 输入关键词实时匹配书签名/URL
4. **键盘操作** - ↑↓ 导航，Enter 打开，⌘+Enter 新标签页
5. **Badge 徽章** - 已收藏的页面在工具栏显示绿色 ✓
6. **本地存储** - 书签存储在浏览器 localStorage，多标签页同步

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev
```

## 安装

1. 构建扩展: `npm run build`
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `dist-chrome` 目录

## 快捷键

| 按键 | 功能 |
|------|------|
| ⌘+Shift+S | 打开搜索框 |
| ↑↓ | 导航 |
| Enter | 打开书签 |
| ⌘+Enter | 新标签页打开 |
| Esc | 关闭搜索框 |

---

## 🤖 与 AI 交互流程

> 本节是全全（AI）和主人的交互规范

### 提需求

主人通过飞书/消息给全全提需求，例如：
- "添加一个功能：xxx"
- "修改一下搜索框的样式"
- "把快捷键改成 xxx"

### 全全处理

1. 全全修改代码
2. 运行 `npm run deploy` 自动：
   - 递增版本号
   - 构建项目
   - 复制到 updater 目录
3. 推送 Git

### 等待更新

- 等待几秒钟，Chrome 会自动检测到新版本
- 按 `⌘+R` 刷新页面即可看到最新效果
- **无需手动刷新扩展**，版本更新会自动同步

### 常用命令

```bash
cd ~/Desktop/git/chrome-react-bookmark

# 发布新版本（自动递增版本号）
npm run deploy

# 发布并推送 Git
npm run release
```

### 更新服务器

- 本地运行: `cd updater && node server.js`
- 访问: http://localhost:3001

---

## 自动更新原理

1. `npm run deploy` 会自动递增 patch 版本号（如 1.0.4 → 1.0.5）
2. 构建产物复制到 `updater/dist/`
3. 更新服务器返回新版本 XML
4. Chrome 检测到版本变化后自动更新
5. 无需手动刷新插件

---

## 项目结构

```
chrome-react-bookmark/
├── src/                    # React 源码
├── public/                 # 扩展配置源码
├── dist-chrome/            # 构建后的扩展（可直接加载）
├── updater/                # 自动更新服务器
│   ├── server.js
│   └── dist/              # 扩展文件
├── scripts/
│   └── deploy.js          # 自动发布脚本
└── package.json
```
