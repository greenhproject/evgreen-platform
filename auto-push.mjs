import { spawn } from 'child_process';
import path from 'path';

const child = spawn('npx', ['drizzle-kit', 'push', '--force'], {
  cwd: path.resolve('/home/ubuntu/green-ev-platform'),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let output = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Auto-answer: send Enter (select first/default option) for any prompt
  if (text.includes('❯') || text.includes('?')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 100);
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
  
  if (text.includes('❯') || text.includes('?')) {
    setTimeout(() => {
      child.stdin.write('\n');
    }, 100);
  }
});

child.on('close', (code) => {
  console.log(`\n\nProcess exited with code ${code}`);
  if (code !== 0) {
    console.log('Full output length:', output.length);
  }
});

// Timeout after 5 minutes
setTimeout(() => {
  console.log('\nTimeout reached, killing process');
  child.kill();
  process.exit(1);
}, 300000);
