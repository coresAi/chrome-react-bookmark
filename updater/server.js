const express = require('express');
const path = require('path');
const app = express();

// Chrome 扩展更新服务器
// 格式参考: https://developer.chrome.com/docs/extensions/updating/extensions

const EXTENSION_VERSION = '1.0.0';
const EXTENSION_ID = 'your-extension-id'; // 需要从 Chrome 扩展管理页面获取

// 静态文件目录 - 存放打包后的扩展
const distPath = path.join(__dirname, 'dist');

app.use(express.static(distPath));

// 更新检查 XML
app.get('/update.xml', (req, res) => {
  const updateXml = `<?xml encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${EXTENSION_ID}'>
    <updatecheck codebase='${req.protocol}://${req.get('host')}/chrome-react-bookmark.crx' version='${EXTENSION_VERSION}' />
  </app>
</gupdate>`;
  
  res.type('application/xml');
  res.send(updateXml);
});

// 下载扩展
app.get('/chrome-react-bookmark.crx', (req, res) => {
  const filePath = path.join(distPath, 'chrome-react-bookmark.crx');
  res.download(filePath);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`更新服务器运行在 http://localhost:${PORT}`);
  console.log(`更新检查地址: http://localhost:${PORT}/update.xml`);
});
