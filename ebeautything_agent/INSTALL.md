# Installation and Setup - eBeautything Agent

## System Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Operating System**: macOS, Linux, or Windows
- **Memory**: At least 4GB RAM
- **Disk Space**: ~500MB for dependencies

## Prerequisites

### 1. Running Services

Both servers MUST be running before starting the agent:

#### Backend Server (Port 3001)
```bash
# Terminal 1
cd /Users/paksungho/everything_backend
npm install  # If not already installed
npm run dev
```

Verify backend is running:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","message":"에뷰리띵 백엔드 서버가 정상적으로 실행 중입니다."}
```

#### Admin Frontend (Port 3000)
```bash
# Terminal 2
cd /Users/paksungho/ebeautything-admin
npm install  # If not already installed
npm run dev
```

Verify frontend is running:
```bash
open http://localhost:3000/login
# Browser should open to admin login page
```

### 2. API Keys

You'll need:
- ✅ **Anthropic API Key** - Get from https://console.anthropic.com/
- ✅ **Supabase Credentials** - Already provided in .env file

## Installation Steps

### Step 1: Navigate to Agent Directory
```bash
cd /Users/paksungho/everything_backend/ebeautything_agent
```

### Step 2: Install Dependencies
```bash
npm install
```

Expected output:
```
added 250 packages in 45s
```

### Step 3: Configure Environment

The `.env` file is already created with Supabase credentials. You just need to add your Anthropic API key:

```bash
# Edit .env file
nano .env

# Or use VS Code
code .env
```

Replace this line:
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

With your actual key:
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

Save and exit.

### Step 4: Create Required Directories
```bash
mkdir -p screenshots videos reports/logs
```

### Step 5: Verify Installation

Run a quick test to ensure everything is set up correctly:

```bash
npm run test:admin-workflow
```

If successful, you should see:
```
🤖 eBeautything Agent SDK Started
🚀 Starting Admin Workflow Test
✅ API Request: POST /api/admin/auth/login (200 OK)
...
```

## Troubleshooting Installation

### Issue: "Module not found"
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Issue: "TypeScript compilation errors"
```bash
# Rebuild TypeScript
npm run build
```

### Issue: "Permission denied"
```bash
# Fix permissions
chmod +x node_modules/.bin/*
```

### Issue: "EADDRINUSE" (port already in use)
```bash
# Backend port 3001 is used
lsof -ti:3001 | xargs kill -9

# Frontend port 3000 is used
lsof -ti:3000 | xargs kill -9
```

## Verifying Everything Works

### 1. Test Backend Connection
```bash
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ebeautything.com",
    "password": "Admin123!@#"
  }'
```

Expected: JSON response with admin user and tokens

### 2. Test Frontend Access
```bash
open http://localhost:3000/login
```

Expected: Admin login page loads

### 3. Test Supabase Connection
```bash
# Run a simple Node script
node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);
client.from('users').select('count').then(console.log);
"
```

Expected: Database query response

### 4. Test Playwright
```bash
npx playwright install chromium
```

Expected: Chromium browser downloads

## Post-Installation

### Optional: Install Playwright Browsers
If you want to run browser tests:

```bash
# Install all browsers
npx playwright install

# Or just Chromium
npx playwright install chromium
```

### Optional: Enable Debug Mode
For detailed logs during development:

```bash
export AGENT_LOG_LEVEL=debug
export PLAYWRIGHT_DEBUG=1
npm run dev
```

### Optional: Setup Git Hooks
If you're contributing to the project:

```bash
npm run prepare  # Installs husky hooks
```

## Configuration Options

All configuration is in `.env`:

```bash
# Backend/Frontend URLs
BACKEND_URL=http://localhost:3001
ADMIN_URL=http://localhost:3000

# Database
SUPABASE_URL=https://ysrudwzwnzxrrwjtpuoh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Test Credentials
TEST_ADMIN_EMAIL=admin@ebeautything.com
TEST_ADMIN_PASSWORD=Admin123!@#

# Agent Behavior
AGENT_LOG_LEVEL=info          # debug, info, warn, error
AGENT_TIMEOUT=300000           # 5 minutes
AGENT_MAX_RETRIES=3

# Browser Settings
HEADLESS=false                 # Show browser during tests
SLOW_MO=100                    # Slow down actions by 100ms
SCREENSHOT_ON_FAILURE=true     # Capture screenshots on errors
VIDEO_ON_FAILURE=true          # Record video on errors
```

## Next Steps

After installation:

1. **Read QUICKSTART.md** for running your first test
2. **Read README.md** for comprehensive documentation
3. **Review IMPLEMENTATION_SUMMARY.md** to understand the architecture

## Getting Help

If you encounter issues:

1. Check logs in `reports/logs/agent-error.log`
2. Review screenshots in `screenshots/` directory
3. Ensure both servers are running
4. Verify environment variables in `.env`
5. Check Node.js and npm versions

## Uninstallation

To remove the agent:

```bash
cd /Users/paksungho/everything_backend
rm -rf ebeautything_agent
```

---

**Ready to test!** 🚀

Run your first test:
```bash
npm run test:admin-workflow
```
