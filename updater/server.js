const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Chrome 扩展更新服务器
// 格式参考: https://developer.chrome.com/docs/extensions/updating/extensions

const EXTENSION_ID = 'your-extension-id'; // 需要从 Chrome 扩展管理页面获取

// 静态文件目录 - 存放打包后的扩展
const distPath = path.join(__dirname, 'dist');
const manifestPath = path.join(distPath, 'manifest.json');

// 读取版本号
function getVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

app.use(express.static(distPath));

// 更新检查 XML
app.get('/update.xml', (req, res) => {
  const version = getVersion();
  const updateXml = `<?xml encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${EXTENSION_ID}'>
    <updatecheck codebase='${req.protocol}://${req.get('host')}/chrome-react-bookmark.crx' version='${version}' />
  </app>
</gupdate>`;
  
  res.type('application/xml');
  res.send(updateXml);
});

// 下载扩展 (CRX 格式)
app.get('/chrome-react-bookmark.crx', (req, res) => {
  // 简化处理：直接返回 zip 压缩包
  // 实际生产环境需要用 crx 包裝工具
  const filePath = path.join(distPath, 'chrome-react-bookmark.zip');
  res.download(filePath);
});

// 获取当前版本
app.get('/version', (req, res) => {
  res.json({ version: getVersion() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`更新服务器运行在 http://localhost:${PORT}`);
  console.log(`当前版本: ${getVersion()}`);
  console.log(`更新检查地址: http://localhost:${PORT}/update.xml`);
});
