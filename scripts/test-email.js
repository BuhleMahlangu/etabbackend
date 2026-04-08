#!/usr/bin/env node
/**
 * Email Test Script for E-tab
 * Tests the centralized email configuration
 * 
 * Usage:
 *   node scripts/test-email.js
 *   node scripts/test-email.js welcome
 *   node scripts/test-email.js 2fa
 */

require('dotenv').config();
const {
  sendWelcomeEmail,
  send2FACode,
  sendPasswordChangeNotification,
  getEtabFromAddress,
  createDefaultTransporter,
} = require('../src/config/email');

const testEmail = async () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           E-tab Email System Test                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // 1. Check environment variables
  console.log('📋 Environment Configuration:');
  console.log('   EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'ethereal (default)');
  console.log('   EMAIL_FROM_NAME:', process.env.EMAIL_FROM_NAME || 'E-tab Education (default)');
  console.log('   EMAIL_FROM_ADDRESS:', process.env.EMAIL_FROM_ADDRESS || 'noreply@etab.co.za (default)');
  console.log('   EMAIL_SUPPORT_ADDRESS:', process.env.EMAIL_SUPPORT_ADDRESS || 'support@etab.co.za (default)');
  console.log('   SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ Not set');
  console.log();

  // 2. Test from address
  console.log('📧 Testing From Address Configuration:');
  const fromAddress = getEtabFromAddress();
  console.log('   Name:', fromAddress.name);
  console.log('   Email:', fromAddress.email);
  console.log('   Reply-To:', fromAddress.replyTo);
  console.log();

  // 3. Test transporter
  console.log('🔌 Testing Email Transporter:');
  try {
    const transporter = await createDefaultTransporter();
    if (transporter) {
      console.log('   ✅ Transporter created successfully');
      
      // Verify connection
      await transporter.verify();
      console.log('   ✅ Connection verified');
    } else {
      console.log('   ⚠️  No transporter (will use simulation mode)');
    }
  } catch (error) {
    console.log('   ❌ Transporter error:', error.message);
  }
  console.log();

  // 4. Get test email address
  const testToEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testType = process.argv[2] || 'all';

  console.log('🧪 Running Email Tests');
  console.log('   To:', testToEmail);
  console.log('   Type:', testType);
  console.log();

  // 5. Test Welcome Email
  if (testType === 'all' || testType === 'welcome') {
    console.log('📨 Testing Welcome Email...');
    try {
      const result = await sendWelcomeEmail({
        firstName: 'Test',
        lastName: 'User',
        email: testToEmail,
        role: 'learner',
        schoolId: 1,
        schoolName: 'Test High School',
        grade: 10,
        isFET: true,
        enrolledCount: 3,
      });
      
      if (result.simulated) {
        console.log('   ✅ Welcome email simulated (check console output above)');
      } else {
        console.log('   ✅ Welcome email sent:', result.messageId);
      }
    } catch (error) {
      console.log('   ❌ Welcome email failed:', error.message);
    }
    console.log();
  }

  // 6. Test 2FA Email
  if (testType === 'all' || testType === '2fa') {
    console.log('🔐 Testing 2FA Code Email...');
    try {
      const testCode = Math.floor(100000 + Math.random() * 900000).toString();
      const result = await send2FACode({
        firstName: 'Test',
        email: testToEmail,
        schoolId: 1,
      }, testCode);
      
      if (result.simulated) {
        console.log('   ✅ 2FA email simulated (check console output above)');
      } else {
        console.log('   ✅ 2FA email sent:', result.messageId);
      }
    } catch (error) {
      console.log('   ❌ 2FA email failed:', error.message);
    }
    console.log();
  }

  // 7. Test Password Change Notification
  if (testType === 'all' || testType === 'password') {
    console.log('🔒 Testing Password Change Notification...');
    try {
      const result = await sendPasswordChangeNotification({
        firstName: 'Test',
        lastName: 'User',
        email: testToEmail,
        schoolId: 1,
      });
      
      if (result.simulated) {
        console.log('   ✅ Password change email simulated');
      } else {
        console.log('   ✅ Password change email sent:', result.messageId);
      }
    } catch (error) {
      console.log('   ❌ Password change email failed:', error.message);
    }
    console.log();
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           Email Test Complete                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Summary
  console.log('📊 Summary:');
  if (!process.env.SENDGRID_API_KEY) {
    console.log('   ⚠️  SENDGRID_API_KEY not set - emails are simulated');
    console.log('   💡 To send real emails, add SENDGRID_API_KEY to .env');
  } else {
    console.log('   ✅ SendGrid configured - emails will be sent');
  }
  
  console.log();
  console.log('📚 Next Steps:');
  console.log('   1. Update your .env file with:');
  console.log('      EMAIL_SERVICE=sendgrid');
  console.log('      SENDGRID_API_KEY=SG.your_api_key');
  console.log('      EMAIL_FROM_NAME=E-tab Education');
  console.log('      EMAIL_FROM_ADDRESS=noreply@etab.co.za');
  console.log('      EMAIL_SUPPORT_ADDRESS=support@etab.co.za');
  console.log();
  console.log('   2. Run this test again:');
  console.log('      node scripts/test-email.js');
  console.log();
  console.log('   3. Test with real email:');
  console.log('      TEST_EMAIL=youremail@example.com node scripts/test-email.js');
};

testEmail().catch(console.error);
