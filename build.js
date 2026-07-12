const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('--- Starting Production Build ---');

// 1. Install frontend React dependencies
console.log('Installing React frontend dependencies...');
try {
  execSync('npm install', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });
} catch (err) {
  console.error('Error installing frontend dependencies:', err.message);
  process.exit(1);
}

// 2. Build frontend React app
console.log('Building React frontend...');
try {
  execSync('npm run build', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });
} catch (err) {
  console.error('Error building frontend:', err.message);
  process.exit(1);
}

// 2. Copy compiled assets from frontend/dist to root dist/
console.log('Copying static assets to root dist/ folder...');
const srcDir = path.join(__dirname, 'frontend', 'dist');
const destDir = path.join(__dirname, 'dist');

function copyDirRecursive(src, dest) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  copyDirRecursive(srcDir, destDir);
  console.log('Static assets copied successfully.');
} catch (err) {
  console.error('Error copying assets:', err.message);
  process.exit(1);
}

console.log('--- Build Complete ---');
