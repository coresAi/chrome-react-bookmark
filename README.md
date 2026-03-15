# chrome-react-bookmark

书签收藏夹 - 一键收藏、快捷搜索的浏览器插件

## 功能

1. **一键收藏** - 点击插件图标，自动收藏当前页面
2. **快捷搜索** - 按 Command+J 在当前页弹出悬浮搜索框
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

# 构建扩展
npm run build
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
| ⌘+J / Ctrl+J | 打开搜索框 |
| ↑↓ | 导航 |
| Enter | 打开书签 |
| ⌘+Enter | 新标签页打开 |
| Esc | 关闭搜索框 |

## 自动更新

扩展支持自动更新，需要：
1. 部署更新服务器
2. 获取扩展 ID
3. 修改 manifest.json 中的 update_url
