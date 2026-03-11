import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'push'], {
  cwd: '/home/ubuntu/green-ev-platform',
  env: process.env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let lastPrompt = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Detect interactive prompts and auto-answer
  if (text.includes('truncate') || text.includes('created or renamed')) {
    // Send Enter to select the first/default option (No truncate / create column)
    setTimeout(() => {
      child.stdin.write('\n');
      console.log('\n[AUTO] Sent Enter');
    }, 500);
  } else if (text.includes('Yes, I want to')) {
    // Confirmation prompt - send Enter
    setTimeout(() => {
      child.stdin.write('\n');
      console.log('\n[AUTO] Sent Enter for confirmation');
    }, 500);
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`\n[EXIT] Code: ${code}`);
  process.exit(code);
});

// Timeout after 120 seconds
setTimeout(() => {
  console.log('\n[TIMEOUT] Killing process after 120s');
  child.kill();
  process.exit(1);
}, 120000);
