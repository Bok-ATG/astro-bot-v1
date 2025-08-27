#!/usr/bin/env node

// Simple health check script for docker and manual testing
// Usage: node health-check.js [port]

const http = require('http');

const port = process.argv[2] || process.env.HEALTH_CHECK_PORT || 3000;
const url = `http://localhost:${port}/health`;

const request = http.get(url, (res) => {
  if (res.statusCode !== 200) {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.error(`Health check failed: HTTP ${res.statusCode} - ${response.reason || 'unknown error'}`);
      } catch {
        console.error(`Health check failed: HTTP ${res.statusCode}`);
      }
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
});

request.on('error', (error) => {
  console.error(`Health check error: ${error.message}`);
  process.exit(1);
});

request.setTimeout(5000, () => {
  console.error('Health check timeout after 5s');
  request.destroy();
  process.exit(1);
});
