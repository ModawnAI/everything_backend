const { exec } = require('child_process');

const port = process.argv[2] || 3001;

console.log(`🔍 Checking for processes on port ${port}...`);

// Windows command to find and kill process
exec(`netstat -ano | findstr :${port}`, (err, stdout, stderr) => {
  if (err || !stdout) {
    console.log(`✅ No process found on port ${port}`);
    process.exit(0);
  }

  const lines = stdout.split('\n');
  const pids = new Set();

  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && !isNaN(pid) && pid !== '0') {
      pids.add(pid);
    }
  });

  if (pids.size === 0) {
    console.log(`✅ No process found on port ${port}`);
    process.exit(0);
  }

  pids.forEach(pid => {
    console.log(`🔧 Killing process with PID: ${pid}`);
    exec(`taskkill /PID ${pid} /F`, (killErr) => {
      if (killErr) {
        console.error(`❌ Failed to kill process ${pid}:`, killErr.message);
      } else {
        console.log(`✅ Process ${pid} killed successfully`);
      }
    });
  });

  setTimeout(() => {
    console.log(`✅ Port ${port} should be free now`);
    process.exit(0);
  }, 2000);
});