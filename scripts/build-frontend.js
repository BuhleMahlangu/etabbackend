#!/usr/bin/env node
/**
 * Build frontend and copy to backend public folder
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️  Building frontend...');

try {
  // Build frontend
  process.chdir(path.join(__dirname, '..', '..', 'etabfrontend'));
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('📦 Copying to backend...');
  
  // Create public folder
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Copy dist files
  const distDir = path.join(process.cwd(), 'dist');
  const files = fs.readdirSync(distDir);
  
  files.forEach(file => {
    const src = path.join(distDir, file);
    const dest = path.join(publicDir, file);
    
    if (fs.statSync(src).isDirectory()) {
      // Copy directory recursively
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  });
  
  console.log('✅ Frontend copied to backend/public/');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
