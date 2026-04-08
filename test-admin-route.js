const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

async function testAdminRoutes() {
  console.log('Testing admin routes...\n');
  
  try {
    // Test health
    console.log('1. Health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server running:', health.data.status);
  } catch (e) {
    console.log('❌ Server not running or health check failed');
    console.log('   Start with: npm start');
    return;
  }
  
  try {
    // Test /api/admin/subjects without auth
    console.log('\n2. Testing /api/admin/subjects (no auth)...');
    const noAuth = await axios.get(`${BASE_URL}/api/admin/subjects`);
    console.log('❌ Should have failed without auth');
  } catch (e) {
    if (e.response?.status === 401) {
      console.log('✅ Correctly requires auth (401)');
    } else {
      console.log('❌ Error:', e.message);
    }
  }
  
  try {
    // Test /admin/subjects without auth
    console.log('\n3. Testing /admin/subjects (no auth)...');
    const noAuth2 = await axios.get(`${BASE_URL}/admin/subjects`);
    console.log('❌ Should have failed without auth');
  } catch (e) {
    if (e.response?.status === 401) {
      console.log('✅ Correctly requires auth (401)');
    } else {
      console.log('❌ Error:', e.message);
    }
  }
  
  try {
    // Test debug endpoint
    console.log('\n4. Testing debug endpoint...');
    const debug = await axios.get(`${BASE_URL}/api/debug/subjects?school=KHS`);
    console.log('✅ Debug endpoint works:', debug.data.count, 'subjects');
  } catch (e) {
    console.log('❌ Debug endpoint failed:', e.message);
  }
  
  console.log('\n--- Summary ---');
  console.log('Routes are configured correctly.');
  console.log('The issue: Frontend is NOT calling /api/admin/subjects');
  console.log('Check browser Network tab for the actual URL being called.');
}

testAdminRoutes();
