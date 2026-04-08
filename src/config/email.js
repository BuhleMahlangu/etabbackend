const nodemailer = require('nodemailer');
const db = require('./database');

// Cache for school transporters
const schoolTransporters = new Map();
let etherealAccount = null;

// Create Ethereal test account for development
const createEtherealAccount = async () => {
  try {
    if (!etherealAccount) {
      etherealAccount = await nodemailer.createTestAccount();
      console.log('✅ Ethereal test account created:');
      console.log('   Email:', etherealAccount.user);
      console.log('   View emails at: https://ethereal.email/login');
    }
    return etherealAccount;
  } catch (error) {
    console.error('❌ Failed to create Ethereal account:', error.message);
    return null;
  }
};

// Get school's SMTP settings from database
const getSchoolSMTPSettings = async (schoolId) => {
  try {
    const result = await db.query(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_password, 
              smtp_from_email, smtp_from_name, smtp_secure, smtp_enabled,
              name as school_name, email as school_email
       FROM schools 
       WHERE id = $1`,
      [schoolId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to get school SMTP settings:', error.message);
    return null;
  }
};

// Create SendGrid transporter for production
const createSendGridTransporter = () => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not set');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY,
    },
  });
};

// Create transporter for a specific school
const createSchoolTransporter = async (schoolId) => {
  // Check cache first
  if (schoolTransporters.has(schoolId)) {
    return schoolTransporters.get(schoolId);
  }

  // Get school SMTP settings
  const smtpSettings = await getSchoolSMTPSettings(schoolId);

  // If school has SMTP configured and enabled, use it (optional override)
  if (smtpSettings && smtpSettings.smtp_enabled && smtpSettings.smtp_host) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpSettings.smtp_host,
        port: smtpSettings.smtp_port || 587,
        secure: smtpSettings.smtp_secure || false,
        auth: {
          user: smtpSettings.smtp_user,
          pass: smtpSettings.smtp_password,
        },
      });

      // Verify connection
      await transporter.verify();
      console.log(`✅ School SMTP connected: ${smtpSettings.school_name}`);
      
      // Cache transporter
      schoolTransporters.set(schoolId, transporter);
      
      return transporter;
    } catch (error) {
      console.error(`❌ School SMTP failed for ${schoolId}:`, error.message);
      console.log('   Falling back to E-tab SendGrid...');
    }
  }

  // Default: Use centralized E-tab email (SendGrid or Ethereal)
  return await createDefaultTransporter();
};

// Create default transporter (SendGrid for production, Ethereal for dev)
const createDefaultTransporter = async () => {
  const emailService = process.env.EMAIL_SERVICE || 'ethereal';
  
  // Production: SendGrid
  if (emailService === 'sendgrid') {
    return createSendGridTransporter();
  }
  
  // Alternative: Gmail
  if (emailService === 'gmail') {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('❌ Gmail config missing');
      return null;
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  
  // Development: Ethereal Email
  const account = await createEtherealAccount();
  if (account) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  }
  
  return null;
};

// Get centralized E-tab from address (all emails from E-tab platform)
const getEtabFromAddress = () => {
  return {
    name: process.env.EMAIL_FROM_NAME || 'E-tab Education',
    email: process.env.EMAIL_FROM_ADDRESS || 'noreply@etab.co.za',
    replyTo: process.env.EMAIL_SUPPORT_ADDRESS || 'support@etab.co.za',
  };
};

// Get from address for a school (fallback for school-specific SMTP if enabled)
const getSchoolFromAddress = async (schoolId) => {
  // First check if school has custom SMTP configured
  const smtpSettings = await getSchoolSMTPSettings(schoolId);
  
  if (smtpSettings && smtpSettings.smtp_enabled && smtpSettings.smtp_from_email) {
    // School has their own SMTP - use it
    return {
      email: smtpSettings.smtp_from_email,
      name: smtpSettings.smtp_from_name || smtpSettings.school_name,
      replyTo: smtpSettings.smtp_from_email,
    };
  }
  
  // Default: Use centralized E-tab email
  return getEtabFromAddress();
};

// Send welcome email to new learners
const sendWelcomeEmail = async (userData) => {
  try {
    const { firstName, lastName, email, role, schoolId, schoolName, grade, isFET, enrolledCount } = userData;
    
    // Get transporter (SendGrid/Ethereal)
    const transporter = await createSchoolTransporter(schoolId);
    
    // Use centralized E-tab from address
    const fromAddress = getEtabFromAddress();
    
    // School name for personalization
    const schoolDisplayName = schoolName || 'your school';
    
    // Log for development
    if (!transporter) {
      console.log('\n📧 [WELCOME EMAIL - SIMULATED]');
      console.log('   To:', email);
      console.log('   From:', `${fromAddress.name} <${fromAddress.email}>`);
      console.log('   Reply-To:', fromAddress.replyTo);
      console.log('   School:', schoolDisplayName);
      console.log('   User:', firstName, lastName);
      console.log('   Grade:', grade);
      console.log('   Is FET:', isFET);
      return { success: true, simulated: true };
    }
    
    // Build FET-specific content
    let fetContent = '';
    if (isFET) {
      fetContent = `
        <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #92400e; margin-top: 0;">🎓 Important: Select Your Optional Subjects</h3>
          <p style="color: #78350f; margin: 5px 0;">
            You've been enrolled in ${enrolledCount} compulsory subjects: <strong>Home Language, First Additional Language, and Life Orientation</strong>.
          </p>
          <p style="color: #78350f; margin: 5px 0;">
            <strong>Next Step:</strong> Please log in and select up to <strong>4 optional subjects</strong> from your dashboard to complete your registration.
          </p>
          <div style="text-align: center; margin-top: 15px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/subjects" 
               style="background: #f59e0b; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Select Optional Subjects
            </a>
          </div>
        </div>
      `;
    }
    
    const mailOptions = {
      from: `"${fromAddress.name}" <${fromAddress.email}>`,
      replyTo: `"${schoolDisplayName}" <${fromAddress.replyTo}>`,
      to: email,
      subject: `Welcome to E-tab Education! 🎓`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to E-tab Education!</h1>
            <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">${schoolDisplayName}</p>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #1e293b;">Hi ${firstName} ${lastName},</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Welcome to ${fromAddress.name}! You've been registered at <strong>${schoolDisplayName}</strong>. 
              We're excited to have you join our digital learning community.
            </p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1e293b; margin-top: 0;">Your Account Details:</h3>
              <p style="color: #475569; margin: 5px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
              <p style="color: #475569; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              <p style="color: #475569; margin: 5px 0;"><strong>Role:</strong> ${role === 'learner' ? 'Student' : role}</p>
              ${grade ? `<p style="color: #475569; margin: 5px 0;"><strong>Grade:</strong> ${grade}</p>` : ''}
            </div>
            
            ${fetContent}
            
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              With our platform, you can:
            </p>
            <ul style="color: #475569; line-height: 1.8;">
              <li>Access your assignments and learning materials</li>
              <li>Track your progress and grades</li>
              <li>Communicate with teachers and classmates</li>
              <li>Get real-time notifications</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                 style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            <p style="color: #64748b; font-size: 14px;">
              If you have any questions, feel free to contact our support team.
            </p>
            <p style="color: #64748b; font-size: 14px;">
              Best regards,<br>
              The ${fromAddress.name} Team
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ${fromAddress.name}. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.EMAIL_SERVICE === 'ethereal' || !process.env.EMAIL_SERVICE) {
      console.log('✅ Welcome email sent (Ethereal):', info.messageId);
      console.log('   Preview URL:', nodemailer.getTestMessageUrl(info));
    } else {
      console.log('✅ Welcome email sent from', fromAddress.email);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send password change notification
const sendPasswordChangeNotification = async (userData) => {
  try {
    const { firstName, lastName, email, schoolId } = userData;
    
    const transporter = await createSchoolTransporter(schoolId);
    
    // Use centralized E-tab from address
    const fromAddress = getEtabFromAddress();
    
    if (!transporter) {
      console.log('\n📧 [PASSWORD CHANGE EMAIL - SIMULATED]');
      console.log('   To:', email);
      return { success: true, simulated: true };
    }
    
    const mailOptions = {
      from: `"${fromAddress.name} Security" <${fromAddress.email}>`,
      replyTo: fromAddress.replyTo,
      to: email,
      subject: 'Your Password Has Been Changed 🔒',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Security Alert</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #1e293b;">Hi ${firstName} ${lastName},</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your password for ${fromAddress.name} has been successfully changed.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #dc2626; margin: 0; font-weight: bold;">
                ⚠️ If you didn't make this change, please contact support immediately.
              </p>
            </div>
            <p style="color: #475569; font-size: 14px;">
              <strong>Time:</strong> ${new Date().toLocaleString()}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings" 
                 style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Account Security
              </a>
            </div>
          </div>
        </div>
      `,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password change notification sent');
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send password change notification:', error.message);
    return { success: false, error: error.message };
  }
};

// Send 2FA code for password change verification
const send2FACode = async (userData, code) => {
  try {
    const { firstName, email, schoolId } = userData;
    
    // Always log code for development
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║              🔐 2FA VERIFICATION CODE 🔐                  ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  To:', email.padEnd(50, ' ') + '║');
    console.log('║  Code:', code.padEnd(48, ' ') + '║');
    console.log('║  Expires: 10 minutes' + ' '.repeat(34) + '║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    const transporter = await createSchoolTransporter(schoolId);
    
    // Use centralized E-tab from address
    const fromAddress = getEtabFromAddress();
    
    if (!transporter) {
      console.log('   (Email service not configured - use code above)');
      return { success: true, simulated: true, code };
    }
    
    const mailOptions = {
      from: `"${fromAddress.name} Security" <${fromAddress.email}>`,
      replyTo: fromAddress.replyTo,
      to: email,
      subject: 'Your Password Change Verification Code 🔐',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Verification Required</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #1e293b;">Hi ${firstName},</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              You requested to change your password. Please use the verification code below to complete the process.
            </p>
            <div style="background: #f1f5f9; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">Your verification code:</p>
              <h1 style="color: #3b82f6; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: monospace;">${code}</h1>
            </div>
            <p style="color: #475569; font-size: 14px;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #dc2626; margin: 0; font-size: 13px;">
                If you didn't request this change, please ignore this email and ensure your account is secure.
              </p>
            </div>
          </div>
        </div>
      `,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ 2FA code sent to:', email);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send 2FA code:', error.message);
    return { success: false, error: error.message };
  }
};

// Send profile update notification
const sendProfileUpdateNotification = async (userData, changes) => {
  try {
    const { firstName, lastName, email, schoolId } = userData;
    
    const transporter = await createSchoolTransporter(schoolId);
    
    // Use centralized E-tab from address
    const fromAddress = getEtabFromAddress();
    
    if (!transporter) {
      console.log('\n📧 [PROFILE UPDATE EMAIL - SIMULATED]');
      console.log('   To:', email);
      return { success: true, simulated: true };
    }
    
    const changesList = changes.map(change => `<li>${change}</li>`).join('');
    
    const mailOptions = {
      from: `"${fromAddress.name}" <${fromAddress.email}>`,
      replyTo: fromAddress.replyTo,
      to: email,
      subject: 'Your Profile Has Been Updated ✏️',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #3b82f6; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Profile Updated</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #1e293b;">Hi ${firstName} ${lastName},</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
              Your profile information has been updated successfully.
            </p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1e293b; margin-top: 0;">Changes Made:</h3>
              <ul style="color: #475569; line-height: 1.8;">
                ${changesList}
              </ul>
            </div>
            <p style="color: #475569; font-size: 14px;">
              <strong>Time:</strong> ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Profile update notification sent');
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send profile update notification:', error.message);
    return { success: false, error: error.message };
  }
};

// Clear transporter cache (useful when school updates SMTP settings)
const clearSchoolTransporter = (schoolId) => {
  schoolTransporters.delete(schoolId);
  console.log(`✅ Cleared SMTP cache for school: ${schoolId}`);
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordChangeNotification,
  send2FACode,
  sendProfileUpdateNotification,
  clearSchoolTransporter,
  getSchoolSMTPSettings,
  getEtabFromAddress,
  createDefaultTransporter,
};
