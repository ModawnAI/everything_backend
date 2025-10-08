# eBeautything Agent - Claude Agent SDK E2E Testing Framework

> **Comprehensive AI-powered testing framework for eBeautything backend and admin frontend using Claude Agent SDK**

## 🎯 Overview

This agent system uses Claude's Agent SDK to simulate realistic user behavior across the eBeautything platform, testing the interaction between:
- **Backend API** (Node.js/Express on port 3001)
- **Admin Frontend** (Next.js on port 3000)
- **Supabase Database** (PostgreSQL)

## 📋 Features

### 🤖 Multi-Agent Architecture
- **Main Orchestrator Agent**: Coordinates all testing workflows
- **Backend Testing Agent**: Tests REST API endpoints
- **Frontend Testing Agent**: Tests admin UI using Playwright
- **Database Agent**: Validates Supabase data integrity
- **Security Agent**: Performs security and permission testing

### 🔧 Capabilities
- ✅ Automated user journey simulation
- ✅ Admin workflow testing (login, shop approval, user management)
- ✅ Real-time WebSocket testing
- ✅ Payment flow validation
- ✅ Referral system testing
- ✅ Multi-language (i18n) testing
- ✅ Performance monitoring
- ✅ Security vulnerability detection
- ✅ Database consistency validation

## 🚀 Quick Start

### Prerequisites
```bash
# Ensure both servers are running:
# Terminal 1: Backend
cd /Users/paksungho/everything_backend
npm run dev

# Terminal 2: Admin Frontend
cd /Users/paksungho/ebeautything-admin
npm run dev
```

### Installation
```bash
cd ebeautything_agent
npm install
```

### Configuration
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your actual credentials
```

### Run Tests
```bash
# Run all E2E tests
npm run test:all

# Run specific scenarios
npm run test:user-journey       # User registration → booking flow
npm run test:admin-workflow     # Admin login → shop approval → analytics
npm run test:e2e               # Full end-to-end suite

# Development mode with auto-reload
npm run dev
```

## 📁 Project Structure

```
ebeautything_agent/
├── src/
│   ├── agents/              # Agent definitions
│   │   ├── orchestrator.ts  # Main coordinator agent
│   │   ├── backend.ts       # Backend API testing agent
│   │   ├── frontend.ts      # Frontend UI testing agent
│   │   ├── database.ts      # Database validation agent
│   │   └── security.ts      # Security testing agent
│   ├── config/
│   │   ├── agent.config.ts  # Agent SDK configuration
│   │   ├── api.config.ts    # API endpoints mapping
│   │   └── test.config.ts   # Test scenarios configuration
│   ├── tools/               # Custom tools for agents
│   │   ├── api-client.ts    # HTTP client tool
│   │   ├── browser.ts       # Playwright browser tool
│   │   ├── db-query.ts      # Supabase query tool
│   │   └── websocket.ts     # Socket.io tool
│   ├── workflows/           # Predefined workflows
│   │   ├── user-journey.ts  # User flows
│   │   ├── admin-tasks.ts   # Admin workflows
│   │   └── payment.ts       # Payment testing
│   ├── scenarios/           # Test scenarios
│   │   ├── run-all.ts       # Run all tests
│   │   ├── user-journey.ts  # User simulation
│   │   └── admin-workflow.ts # Admin simulation
│   ├── utils/               # Utilities
│   │   ├── logger.ts        # Logging
│   │   ├── faker.ts         # Test data generation
│   │   └── reporter.ts      # Test reporting
│   └── index.ts             # Main entry point
├── reports/                 # Test execution reports
├── screenshots/             # Failure screenshots
├── videos/                  # Test execution videos
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Test Scenarios

### 1. User Journey Simulation
```typescript
// Simulates complete user lifecycle
- Registration with referral code
- Phone verification (PASS/SMS)
- Browse shops and services
- Create reservation
- Payment with split payment
- Review and rating
- Points and rewards
```

### 2. Admin Workflow
```typescript
// Simulates admin operations
- Admin login with MFA
- Shop approval workflow
- User management (ban, restore)
- Financial analytics
- Payment reconciliation
- Security monitoring
```

### 3. Real-time Features
```typescript
// Tests WebSocket functionality
- Reservation status updates
- Admin notifications
- Live chat (if implemented)
- Activity monitoring
```

## 🔑 Key Components

### Agent Orchestration
```typescript
// Main orchestrator delegates to specialized agents
const agents = [
  {
    name: 'backend-tester',
    description: 'Tests REST API endpoints and validates responses',
    prompt: 'Test backend API endpoints systematically...',
    tools: ['api-client', 'db-query']
  },
  {
    name: 'frontend-tester',
    description: 'Tests admin UI using Playwright',
    prompt: 'Navigate admin interface and validate UI states...',
    tools: ['browser', 'screenshot']
  }
];
```

### Custom Tools
```typescript
// Example: API Client Tool
const apiTool = tool({
  name: 'api-request',
  description: 'Make HTTP requests to backend API',
  inputSchema: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    endpoint: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional()
  }),
  handler: async (input) => {
    const response = await axios({
      method: input.method,
      url: `${BACKEND_URL}${input.endpoint}`,
      headers: input.headers,
      data: input.body
    });
    return response.data;
  }
});
```

## 📊 Reporting

Test results are generated in multiple formats:

### Console Output
Real-time progress with colored logs

### JSON Reports
```json
{
  "testRun": {
    "id": "run-2025-01-05-123456",
    "timestamp": "2025-01-05T12:34:56Z",
    "duration": 45000,
    "totalTests": 150,
    "passed": 145,
    "failed": 5,
    "scenarios": [...]
  }
}
```

### HTML Dashboard
Interactive test results viewer at `reports/index.html`

## 🛠️ Development

### Adding New Test Scenarios
```typescript
// src/scenarios/my-scenario.ts
export async function runMyScenario() {
  const agent = new OrchestratorAgent();

  await agent.execute({
    prompt: 'Test my specific scenario...',
    workflow: 'my-workflow',
    validation: {
      checkDatabase: true,
      checkUI: true
    }
  });
}
```

### Adding Custom Tools
```typescript
// src/tools/my-tool.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const myTool = tool({
  name: 'my-tool',
  description: 'Does something useful',
  inputSchema: z.object({
    param: z.string()
  }),
  handler: async (input) => {
    // Implementation
    return result;
  }
});
```

## 🔒 Security Considerations

- Never commit `.env` with real credentials
- Use test-specific admin accounts
- Run tests in isolated environment
- Clean up test data after execution (configurable)
- Monitor for security vulnerabilities

## 📈 Performance Monitoring

Agents track:
- API response times
- Page load times
- Database query performance
- WebSocket latency
- Error rates

## 🐛 Debugging

```bash
# Enable verbose logging
export AGENT_LOG_LEVEL=debug

# Run with Playwright UI mode
export HEADLESS=false

# Keep browser open on failure
export PLAYWRIGHT_DEBUG=1

# Generate execution traces
npm run test:e2e -- --trace on
```

## 🤝 Contributing

1. Follow existing code structure
2. Add tests for new features
3. Update documentation
4. Use TypeScript strictly

## 📝 License

MIT

## 🆘 Support

For issues or questions:
- Check logs in `reports/` directory
- Review screenshots in `screenshots/` directory
- Enable debug mode for detailed traces

---

**Built with ❤️ using Claude Agent SDK**
