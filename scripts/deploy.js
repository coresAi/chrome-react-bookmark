const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'public', 'manifest.json');
const updaterDist = path.join(rootDir, 'updater', 'dist');

// 读取 package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// 解析版本号
const [major, minor, patch] = pkg.version.split('.').map(Number);

// 递增 patch 版本
const newVersion = `${major}.${minor}.${patch + 1}`;
pkg.version = newVersion;

// 写回 package.json
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 更新 manifest.json (这样 build 时会使用新版本)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`版本号更新: ${pkg.version} → ${newVersion}`);

// 构建
console.log('构建中...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 复制到 updater 目录
execSync(`cp -r dist-chrome/* ${updaterDist}/`, { cwd: rootDir, stdio: 'inherit' });

console.log('已复制到 updater/dist');
console.log(`\n✅ 发布完成！新版本: ${newVersion}`);
