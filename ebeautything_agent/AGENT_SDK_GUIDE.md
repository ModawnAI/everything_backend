# eBeautything Agent SDK - Complete Guide

## 🤖 Overview

The eBeautything Agent is an **AI-powered testing framework** built with **Claude Agent SDK** that provides comprehensive end-to-end testing for the eBeautything platform, covering:

- ✅ **Backend API Testing** (Node.js/Express)
- ✅ **Admin Frontend Testing** (Next.js/React with Playwright)
- ✅ **Database Validation** (Supabase/PostgreSQL)
- ✅ **Real-time WebSocket Testing** (Socket.io)

### Key Features

- **AI-Driven Testing**: Uses Claude AI to intelligently orchestrate test scenarios
- **Multi-Tool Integration**: Browser automation, API testing, database queries
- **Comprehensive Validation**: Validates API responses, UI state, and database integrity
- **Screenshot Capture**: Visual regression testing with automated screenshots
- **Detailed Reporting**: Rich logs and test execution summaries

## 📋 Prerequisites

### 1. Running Services

Both servers **must be running** before starting the agent:

```bash
# Terminal 1: Backend API (port 3001)
cd /Users/paksungho/everything_backend
npm run dev

# Terminal 2: Admin Frontend (port 3000)
cd /Users/paksungho/ebeautything-admin
npm run dev
```

### 2. Environment Setup

```bash
cd /Users/paksungho/everything_backend/ebeautything_agent

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and fill in:
# - ANTHROPIC_API_KEY (required)
# - SUPABASE_SERVICE_ROLE_KEY (required)
```

### 3. Required Directories

```bash
mkdir -p screenshots videos reports/logs
```

## 🚀 Quick Start

### Run Predefined Test Scenarios

```bash
# Full system test (comprehensive)
npm run agent:full

# Quick health check
npm run agent:health

# Admin workflow test
npm run agent:admin

# Interactive mode (custom prompts)
npm run agent:interactive
```

### Custom Test Prompts

```bash
# Run with custom prompt
npm run agent test --scenario=custom --prompt="Test the admin login flow and validate the session"
```

## 🔧 How It Works

### Architecture

```
┌─────────────────────────────────────┐
│   Claude Agent Orchestrator         │
│   (AI-powered test coordinator)     │
└─────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌──────────┐
│API Test│  │Browser │  │Database  │
│ Tools  │  │ Tools  │  │  Tools   │
└────────┘  └────────┘  └──────────┘
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌──────────┐
│Backend │  │Frontend│  │Supabase  │
│  API   │  │  UI    │  │    DB    │
└────────┘  └────────┘  └──────────┘
```

### Available Tools

The agent has access to these tools via MCP (Model Context Protocol):

#### 1. **api-test**
Make HTTP requests to backend API with automatic validation.

```typescript
{
  method: 'POST',
  endpoint: '/api/admin/auth/login',
  body: { email: 'admin@test.com', password: 'password' },
  expectedStatus: 200,
  validateFormat: 'success'
}
```

#### 2. **browser-interact**
Automate frontend UI interactions using Playwright.

```typescript
// Navigate
{ action: 'navigate', url: '/login' }

// Fill form
{ action: 'fill', selector: 'input[type="email"]', value: 'admin@test.com' }

// Click button
{ action: 'click', selector: 'button[type="submit"]' }

// Screenshot
{ action: 'screenshot', screenshotName: 'login-page', fullPage: true }
```

#### 3. **db-query**
Query Supabase database to validate data state.

```typescript
{
  table: 'admin_users',
  select: 'id,email,role',
  filters: { email: 'admin@test.com' },
  single: true
}
```

#### 4. **db-insert, db-update, supabase-rpc**
Additional database operations for test data management.

## 📝 Test Scenarios

### 1. Full System Test

Executes comprehensive end-to-end testing:

```bash
npm run agent:full
```

**What it tests:**
- Backend health check
- Admin authentication (API + Frontend)
- Shop management workflows
- User management
- Database integrity validation
- Session and security

**Expected Output:**
- Test execution logs
- API response times
- Screenshots in `screenshots/` directory
- Comprehensive test report

### 2. Quick Health Check

Fast validation that all services are running:

```bash
npm run agent:health
```

**What it tests:**
- Backend API availability
- Admin login functionality
- Database connectivity
- Frontend accessibility

### 3. Admin Workflow Test

Complete admin user journey:

```bash
npm run agent:admin
```

**What it tests:**
- Admin login (API + UI)
- Navigation through admin sections
- Shop approval/rejection
- User ban/restore
- Analytics dashboard
- Database validation

### 4. Interactive Mode

Custom testing with natural language prompts:

```bash
npm run agent:interactive
```

Example prompts:
```
🤖 Test> Test admin login and verify the session token is valid

🤖 Test> Navigate to the shops page and capture a screenshot

🤖 Test> Query the database to find all pending shop approvals

🤖 Test> Test the user ban workflow end-to-end
```

## 🎯 Example Test Flow

Here's what happens when you run `npm run agent:full`:

### Step 1: AI Agent Receives Task
```
Execute comprehensive end-to-end test of the eBeautything platform:
1. Backend health check
2. Admin authentication
3. Frontend login
4. Database validation
...
```

### Step 2: Agent Plans Execution
The Claude AI agent analyzes the task and creates a test plan:
- Identify required tools
- Determine test sequence
- Plan validation steps

### Step 3: Agent Executes Tests

**API Testing:**
```typescript
// Agent calls api-test tool
POST /api/admin/auth/login
→ Response: { success: true, token: "eyJhbGc..." }
→ Validation: ✅ Status 200, JWT token present
```

**Frontend Testing:**
```typescript
// Agent calls browser-interact tool
Navigate to /login
Fill email: admin@test.com
Fill password: ***
Click submit button
→ Redirected to /dashboard
→ Screenshot captured: admin-dashboard-2025-01-05.png
```

**Database Validation:**
```typescript
// Agent calls db-query tool
Query admin_users WHERE email = 'admin@test.com'
→ Result: { id: 1, email: 'admin@test.com', role: 'admin' }
→ Validation: ✅ Admin exists in database
```

### Step 4: Agent Reports Results
```
📊 Test Execution Summary
- Total API calls: 15
- Total UI interactions: 8
- Database queries: 5
- Screenshots captured: 4
- Success rate: 100%
- Average API response time: 45ms
```

## 🔍 Debugging & Troubleshooting

### Enable Debug Logging

```bash
export AGENT_LOG_LEVEL=debug
npm run agent:full
```

### View Logs

```bash
# All logs
tail -f reports/logs/agent-all.log

# Errors only
tail -f reports/logs/agent-error.log
```

### Common Issues

#### 1. Backend Not Reachable
```
Error: connect ECONNREFUSED 127.0.0.1:3001
```
**Solution:** Ensure backend is running on port 3001
```bash
cd /Users/paksungho/everything_backend && npm run dev
```

#### 2. Frontend Not Loading
```
Error: Timeout waiting for navigation
```
**Solution:** Ensure admin frontend is running on port 3000
```bash
cd /Users/paksungho/ebeautything-admin && npm run dev
```

#### 3. Authentication Failed
```
Error: Invalid credentials
```
**Solution:** Check credentials in `.env` match your backend admin users

#### 4. Browser Doesn't Close
Set headless mode:
```bash
export HEADLESS=true
npm run agent:full
```

## 📊 Understanding Output

### Console Output
```
🤖 eBeautything Agent SDK Started
Configuration: {
  backendUrl: 'http://localhost:3001',
  adminUrl: 'http://localhost:3000',
  model: 'claude-sonnet-4-5-20250929'
}

Running: Full System Test

Agent Response: I'll execute the comprehensive test...

Tool Result: api-test
{
  "success": true,
  "status": 200,
  "data": { ... }
}

✅ Test execution completed successfully
```

### Screenshots
Located in `screenshots/` directory:
- `admin-login-success-{timestamp}.png`
- `shops-list-{timestamp}.png`
- `user-management-{timestamp}.png`

### Log Files
Located in `reports/logs/`:
- `agent-all.log` - Complete execution log
- `agent-error.log` - Errors and warnings only

## 🛠️ Advanced Usage

### Custom Agent Configuration

Edit `src/agent-orchestrator.ts` to customize:

```typescript
const agentOptions = {
  model: 'claude-sonnet-4-5-20250929',
  permissionMode: 'bypassPermissions',
  allowedTools: [
    'api-test',
    'browser-interact',
    'db-query',
    // ... add more tools
  ]
};
```

### Add Custom Tools

Create new tools in `src/tools/`:

```typescript
// src/tools/custom-tool.ts
export const myCustomTool = tool({
  name: 'my-custom-tool',
  description: 'Does something useful',
  inputSchema: z.object({
    param: z.string()
  }),
  handler: async (input) => {
    // Implementation
    return { content: [{ type: 'text', text: 'Result' }] };
  }
});
```

Register in MCP server:
```typescript
// src/agent-orchestrator.ts
const mcpServer = createSdkMcpServer({
  name: 'ebeautything-testing-tools',
  tools: [
    // ... existing tools
    myCustomTool
  ]
});
```

### Create Custom Scenarios

Add to `src/agent-orchestrator.ts`:

```typescript
export const testScenarios = {
  // ... existing scenarios

  myCustomScenario: `
Test my custom workflow:
1. Do this
2. Then that
3. Validate results
  `
};
```

Use it:
```bash
npm run agent test --scenario=custom --prompt="$(cat my-scenario.txt)"
```

## 🔐 Security Considerations

- ✅ `.env` file is gitignored - never commit credentials
- ✅ Use test-specific admin accounts
- ✅ Run in isolated development environment
- ✅ Service role key is only for testing
- ✅ Agent has restricted permissions via `allowedTools`

## 📈 Performance Tips

1. **Parallel Execution**: Agent automatically parallelizes independent tests
2. **Headless Mode**: Use `HEADLESS=true` for faster execution
3. **Screenshot Optimization**: Set `fullPage=false` for faster screenshots
4. **Timeout Configuration**: Adjust `AGENT_TIMEOUT` for complex scenarios

## 🤝 Contributing

### Adding New Test Scenarios

1. Define scenario in `src/agent-orchestrator.ts`
2. Add npm script to `package.json`
3. Document in this guide

### Adding New Tools

1. Create tool in `src/tools/`
2. Register in MCP server
3. Update agent system prompt with tool description

## 📚 Additional Resources

- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude/docs/agent-sdk)
- [Playwright Documentation](https://playwright.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Project README](./README.md)

## 🆘 Support

### Getting Help

1. **Check Logs**: Review `reports/logs/agent-error.log`
2. **Enable Debug**: Set `AGENT_LOG_LEVEL=debug`
3. **Review Screenshots**: Check `screenshots/` for UI state
4. **Verify Services**: Ensure backend and frontend are running

### Common Commands

```bash
# Install dependencies
npm install

# Run full test
npm run agent:full

# Run in debug mode
AGENT_LOG_LEVEL=debug npm run agent:full

# Interactive testing
npm run agent:interactive

# View logs
tail -f reports/logs/agent-all.log
```

---

**Built with ❤️ using Claude Agent SDK**
