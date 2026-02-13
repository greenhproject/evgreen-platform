import { spawn } from 'child_process';
import * as readline from 'readline';

const child = spawn('npx', ['drizzle-kit', 'generate'], {
  cwd: '/home/ubuntu/green-ev-platform',
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let output = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // If drizzle-kit asks about column creation/rename, always select first option (create)
  if (text.includes('create column') || text.includes('created or renamed')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 200);
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
  
  if (text.includes('create column') || text.includes('created or renamed')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 200);
  }
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
  process.exit(code);
});
