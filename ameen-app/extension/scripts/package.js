const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const extensionDir = path.resolve(__dirname, '..');
const distDir = path.resolve(extensionDir, 'dist');
const releaseDir = path.resolve(extensionDir, 'release');

const browsers = ['chrome', 'firefox', 'edge', 'brave'];

// Clean and create release directory
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true });
}
fs.mkdirSync(releaseDir, { recursive: true });

// Build all browsers
console.log('🔨 بناء جميع المتصفحات...');
for (const browser of browsers) {
  console.log(`  📦 ${browser}...`);
  execSync(`npx cross-env TARGET=${browser} webpack --config webpack.config.js`, {
    cwd: extensionDir,
    stdio: 'inherit',
  });
}

// Package each browser
console.log('\n📦 إنشاء حزم التثبيت...');
for (const browser of browsers) {
  const browserDist = path.join(distDir, browser);
  if (!fs.existsSync(browserDist)) {
    console.warn(`  ⚠️  dist/${browser} غير موجود — تخطي`);
    continue;
  }

  const zipFile = path.join(releaseDir, `ameen-${browser}-v1.0.0.zip`);
  const files = fs.readdirSync(browserDist);

  // Use system zip if available, otherwise create a simple zip
  try {
    execSync(`powershell -Command "Compress-Archive -Path '${browserDist}\\*' -DestinationPath '${zipFile}' -Force"`, {
      cwd: extensionDir,
      stdio: 'pipe',
    });
    const stats = fs.statSync(zipFile);
    const kb = (stats.size / 1024).toFixed(1);
    console.log(`  ✅ ${browser}: ${zipFile} (${kb} KB)`);
  } catch (e) {
    console.error(`  ❌ ${browser}: فشل إنشاء الحزمة — ${e.message}`);
  }
}

console.log('\n✨ تم إنشاء جميع الحزم في:', releaseDir);
