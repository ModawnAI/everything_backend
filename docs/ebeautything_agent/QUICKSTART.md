# Quick Start Guide - eBeautything Agent

This guide will help you get the agent running in 5 minutes.

## Prerequisites

✅ Both servers must be running:
```bash
# Terminal 1: Backend (port 3001)
cd /Users/paksungho/everything_backend
npm run dev

# Terminal 2: Admin Frontend (port 3000)
cd /Users/paksungho/ebeautything-admin
npm run dev
```

## Setup

### 1. Install Dependencies
```bash
cd ebeautything_agent
npm install
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your credentials
# The Supabase credentials are already provided in .env.example
```

### 3. Create Required Directories
```bash
mkdir -p screenshots videos reports/logs
```

## Run Your First Test

### Option 1: Run Admin Workflow Test
```bash
npm run test:admin-workflow
```

This will:
- Login to admin backend API
- Login to admin frontend UI
- Navigate through dashboard
- Test shop approval workflow
- Test user management
- Validate with database queries
- Generate screenshots and logs

### Option 2: Run All Tests
```bash
npm run test:all
```

### Option 3: Development Mode
```bash
npm run dev
```

## What to Expect

When you run the agent, you'll see:

1. **Console Output**: Real-time colored logs showing:
   - API requests and responses
   - Browser actions (navigation, clicks, etc.)
   - Database queries
   - Test results

2. **Screenshots**: Saved to `screenshots/` directory
   - admin-login-success-{timestamp}.png
   - admin-dashboard-{timestamp}.png
   - shops-list-{timestamp}.png
   - users-list-{timestamp}.png
   - analytics-dashboard-{timestamp}.png

3. **Logs**: Saved to `reports/logs/` directory
   - agent-all.log: All log entries
   - agent-error.log: Error entries only

4. **Videos** (if enabled): Saved to `videos/` directory

## Viewing Results

### Check Logs
```bash
# View recent logs
tail -f reports/logs/agent-all.log

# View errors only
tail -f reports/logs/agent-error.log
```

### Browse Screenshots
```bash
open screenshots/
```

### View Test Summary
The agent outputs a comprehensive summary at the end:
```
📊 Test Execution Summary
- Total steps executed: 25
- Successful steps: 24
- Failed steps: 1
- Average API response time: 45ms
```

## Troubleshooting

### Backend not reachable
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```
**Solution**: Make sure backend is running on port 3001

### Frontend not loading
```
Error: Timeout waiting for navigation
```
**Solution**: Make sure admin frontend is running on port 3000

### Authentication failed
```
Error: Invalid credentials
```
**Solution**: Check TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env match your backend admin users

### Browser stays open
If browser doesn't close after test:
```bash
# Set headless mode
export HEADLESS=true
npm run test:admin-workflow
```

## Next Steps

1. **Review the code**:
   - `src/config/agent.config.ts` - Agent configuration
   - `src/scenarios/admin-workflow.ts` - Test scenario
   - `src/tools/` - Custom tools for API, browser, database

2. **Customize tests**:
   - Modify existing scenarios
   - Add new test cases
   - Adjust timeouts and retries

3. **Extend functionality**:
   - Add user journey scenario
   - Add payment flow testing
   - Add WebSocket real-time testing

## Common Commands

```bash
# Development with auto-reload
npm run dev

# Run specific scenario
npm run test:admin-workflow
npm run test:user-journey  # Coming soon

# Run all tests
npm run test:all

# Build for production
npm run build

# Run built version
npm start
```

## Support

If you encounter issues:
1. Check logs in `reports/logs/agent-error.log`
2. Review screenshots in `screenshots/` directory
3. Enable debug mode: `export AGENT_LOG_LEVEL=debug`
4. Check both servers are running and accessible

---

**Happy Testing! 🚀**
