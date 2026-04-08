#!/usr/bin/env node
/**
 * 2FA Email Diagnostic Script
 * Run this to troubleshoot why verification codes aren't being sent
 */

require('dotenv').config();
const db = require('../src/config/database');
const { send2FACode } = require('../src/config/email');

const diagnose2FA = async () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           2FA Email Diagnostic Tool                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // 1. Check environment variables
  console.log('1️⃣  Environment Variables Check:');
  console.log('   EMAIL_SERVICE:', process.env.EMAIL_SERVICE || '(not set - defaults to ethereal)');
  console.log('   SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ NOT SET');
  console.log('   EMAIL_FROM_NAME:', process.env.EMAIL_FROM_NAME || 'E-tab Education (default)');
  console.log('   EMAIL_FROM_ADDRESS:', process.env.EMAIL_FROM_ADDRESS || 'noreply@etab.co.za (default)');
  console.log();

  // 2. If SendGrid not configured, show warning
  if (!process.env.SENDGRID_API_KEY) {
    console.log('⚠️  CRITICAL: SENDGRID_API_KEY is not set!');
    console.log('   2FA codes are being simulated (logged to console only).');
    console.log('   Users will NOT receive real emails!');
    console.log();
    console.log('   To fix:');
    console.log('   1. Get your API key from https://app.sendgrid.com/settings/api_keys');
    console.log('   2. Add to .env: SENDGRID_API_KEY=SG.your_key_here');
    console.log('   3. Restart your server');
    console.log();
  }

  // 3. Test database connection
  console.log('2️⃣  Database Connection Check:');
  try {
    const result = await db.query('SELECT NOW() as time');
    console.log('   ✅ Database connected:', result.rows[0].time);
  } catch (error) {
    console.log('   ❌ Database error:', error.message);
    process.exit(1);
  }
  console.log();

  // 4. Check for users
  console.log('3️⃣  User Check:');
  try {
    const users = await db.query(
      'SELECT id, email, first_name, last_name, role, school_id FROM users LIMIT 5'
    );
    
    if (users.rows.length === 0) {
      console.log('   ⚠️  No users found in database');
    } else {
      console.log(`   ✅ Found ${users.rows.length} users:`);
      users.rows.forEach(user => {
        console.log(`      - ${user.first_name} ${user.last_name} (${user.email})`);
      });
      console.log();
      
      // 5. Test sending 2FA to first user
      console.log('4️⃣  Test 2FA Email:');
      const testUser = users.rows[0];
      const testCode = '123456';
      
      console.log(`   Sending test 2FA code to: ${testUser.email}`);
      console.log(`   User: ${testUser.first_name} ${testUser.last_name}`);
      console.log(`   School ID: ${testUser.school_id}`);
      
      const result = await send2FACode({
        firstName: testUser.first_name,
        lastName: testUser.last_name,
        email: testUser.email,
        schoolId: testUser.school_id
      }, testCode);
      
      console.log();
      if (result.simulated) {
        console.log('   ⚠️  Email was SIMULATED (not actually sent)');
        console.log('   This means SENDGRID_API_KEY is not configured.');
      } else if (result.success) {
        console.log('   ✅ Email sent successfully!');
        console.log('   Message ID:', result.messageId);
      } else {
        console.log('   ❌ Email failed to send');
        console.log('   Error:', result.error);
      }
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
  console.log();

  // 6. Server log check instructions
  console.log('5️⃣  Server Log Check:');
  console.log('   Look for these messages in your server logs:');
  console.log('   - "[requestPasswordChange] Password change requested..."');
  console.log('   - "🔐 [2FA VERIFICATION CODE]"');
  console.log('   - "✅ 2FA code sent to: ..."');
  console.log('   OR');
  console.log('   - "❌ Failed to send email: ..."');
  console.log();

  // 7. API endpoint check
  console.log('6️⃣  API Endpoint Check:');
  console.log('   Make sure your frontend is calling:');
  console.log('   POST /api/settings/request-password-change');
  console.log('   Body: { "currentPassword": "user_password" }');
  console.log();

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           Diagnostic Complete                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Summary
  if (!process.env.SENDGRID_API_KEY) {
    console.log('🔴 PROBLEM IDENTIFIED: SendGrid API key not configured');
    console.log();
    console.log('✅ SOLUTION:');
    console.log('   1. Go to https://app.sendgrid.com/settings/api_keys');
    console.log('   2. Create an API key with "Full Access" or "Mail Send"');
    console.log('   3. Copy the key (starts with SG.)');
    console.log('   4. Open your .env file');
    console.log('   5. Add: SENDGRID_API_KEY=SG.your_key_here');
    console.log('   6. Save .env');
    console.log('   7. Restart your server: npm start');
    console.log('   8. Test again');
  } else {
    console.log('🟡 SendGrid is configured. If emails still not sending:');
    console.log('   1. Check SendGrid dashboard for suppressed/bounced emails');
    console.log('   2. Verify your domain is still verified in SendGrid');
    console.log('   3. Check if emails are going to spam folders');
    console.log('   4. Look at server logs for detailed error messages');
  }

  await db.end();
  process.exit(0);
};

diagnose2FA().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
