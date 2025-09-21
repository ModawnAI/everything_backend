#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');

/**
 * Start Redis server if not running
 */
async function startRedis() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Checking Redis status...');
    
    // Check if Redis is already running
    exec('redis-cli ping', (error, stdout, stderr) => {
      if (!error && stdout.trim() === 'PONG') {
        console.log('✅ Redis is already running');
        resolve();
        return;
      }
      
      console.log('🚀 Starting Redis server...');
      
      // Try to start Redis server
      const redisProcess = spawn('redis-server', [], {
        stdio: 'pipe',
        detached: false
      });
      
      redisProcess.stdout.on('data', (data) => {
        console.log(`Redis: ${data}`);
      });
      
      redisProcess.stderr.on('data', (data) => {
        console.log(`Redis Error: ${data}`);
      });
      
      redisProcess.on('error', (error) => {
        console.error('❌ Failed to start Redis:', error.message);
        console.log('💡 Please install Redis or start it manually');
        reject(error);
      });
      
      // Wait a moment for Redis to start
      setTimeout(() => {
        exec('redis-cli ping', (pingError, pingStdout) => {
          if (!pingError && pingStdout.trim() === 'PONG') {
            console.log('✅ Redis started successfully');
            resolve();
          } else {
            console.error('❌ Redis failed to start properly');
            reject(new Error('Redis failed to start'));
          }
        });
      }, 2000);
    });
  });
}

/**
 * Check if our Express server is running
 */
async function checkServer() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Checking if server is running...');
    
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 3000,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Server is already running');
        resolve();
      } else {
        console.log('⚠️ Server responded with status:', res.statusCode);
        reject(new Error(`Server responded with status: ${res.statusCode}`));
      }
    });
    
    req.on('error', (error) => {
      console.log('🚀 Starting server...');
      startServer().then(resolve).catch(reject);
    });
    
    req.on('timeout', () => {
      console.log('🚀 Starting server (timeout)...');
      startServer().then(resolve).catch(reject);
    });
    
    req.end();
  });
}

/**
 * Start our Express server
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Express server...');
    
    const serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      detached: false
    });
    
    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Server: ${output}`);
      
      // Look for server ready indicators
      if (output.includes('Server running') || 
          output.includes('listening') || 
          output.includes('started on port')) {
        if (!serverReady) {
          serverReady = true;
          console.log('✅ Server started successfully');
          resolve();
        }
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.log(`Server Error: ${data}`);
    });
    
    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error.message);
      reject(error);
    });
    
    // Wait up to 30 seconds for server to start
    setTimeout(() => {
      if (!serverReady) {
        console.error('❌ Server failed to start within 30 seconds');
        reject(new Error('Server startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Main function to start all dependencies
 */
async function startDependencies() {
  try {
    console.log('🎯 Starting dependencies for comprehensive test...\n');
    
    // Start Redis first
    await startRedis();
    console.log('');
    
    // Then check/start server
    await checkServer();
    console.log('');
    
    console.log('✅ All dependencies are ready!');
    console.log('🚀 You can now run: npm run test:comprehensive');
    
    // Keep the process alive for a few seconds to ensure everything is stable
    setTimeout(() => {
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Failed to start dependencies:', error.message);
    console.log('\n💡 Manual steps:');
    console.log('1. Start Redis: redis-server');
    console.log('2. Start server: npm run dev');
    console.log('3. Run tests: npm run test:comprehensive');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  startDependencies();
}

module.exports = { startDependencies, startRedis, startServer };
