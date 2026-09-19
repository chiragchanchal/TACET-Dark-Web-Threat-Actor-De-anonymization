import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('[TACET BUILD] Installing web dependencies...');
execSync('npm --prefix tacet/web install', { stdio: 'inherit' });

console.log('[TACET BUILD] Building Vite frontend...');
execSync('npm --prefix tacet/web run build', { stdio: 'inherit' });

console.log('[TACET BUILD] Copying dist to root dist...');
const srcDist = path.resolve('tacet/web/dist');
const dstDist = path.resolve('dist');
if (fs.existsSync(dstDist)) fs.rmSync(dstDist, { recursive: true, force: true });
fs.cpSync(srcDist, dstDist, { recursive: true });

console.log('[TACET BUILD] Build complete. Output at:', dstDist);
