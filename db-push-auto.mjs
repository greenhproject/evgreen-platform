import { spawn } from 'child_process';

// Run drizzle-kit generate, auto-accepting all "create column" prompts
const proc = spawn('npx', ['drizzle-kit', 'generate'], {
  cwd: '/home/ubuntu/green-ev-platform',
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let output = '';

proc.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // When we see a prompt about column creation, send Enter to accept default (create column)
  if (text.includes('create column') || text.includes('rename column') || text.includes('created or renamed')) {
    setTimeout(() => {
      proc.stdin.write('\n');
    }, 100);
  }
});

proc.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

proc.on('close', (code) => {
  console.log(`\n=== drizzle-kit generate exited with code ${code} ===`);
  
  if (code === 0) {
    // Now run migrate
    console.log('Running drizzle-kit migrate...');
    const migrate = spawn('npx', ['drizzle-kit', 'migrate'], {
      cwd: '/home/ubuntu/green-ev-platform',
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    migrate.on('close', (migrateCode) => {
      console.log(`\n=== drizzle-kit migrate exited with code ${migrateCode} ===`);
      process.exit(migrateCode);
    });
  } else {
    process.exit(code);
  }
});
