# 🔐 2FA Verification Code Not Received - Troubleshooting

## ✅ Backend Status: WORKING

The diagnostic shows your backend is correctly sending emails:
- ✅ SendGrid API key is configured
- ✅ Email sent successfully (Message ID received)
- ✅ No errors in email sending

**If the backend is working but users don't receive emails, the issue is one of these:**

---

## 🔍 Most Common Causes (Check in Order)

### 1. **Emails Going to SPAM Folder** ⭐ MOST COMMON

**Check:** Ask the user to check their Spam/Junk folder.

**Why this happens:**
- New domain reputation (etab.co.za is new)
- SendGrid IP needs warming up
- Email content triggers spam filters

**Fix:**
- Tell users to check Spam folder
- Mark email as "Not Spam" in Gmail/Outlook
- Add `noreply@etab.co.za` to contacts
- Wait 1-2 weeks for domain reputation to build

---

### 2. **SendGrid Domain Not Verified**

**Check:** Go to https://app.sendgrid.com/settings/sender_auth

**Look for:**
- ✅ Domain "etab.co.za" should show "Verified"
- ❌ If it says "Pending" or "Failed" → DNS records not correct

**Fix:**
1. Re-add the CNAME records in GoDaddy
2. Click "Verify" in SendGrid
3. Wait 5-30 minutes

---

### 3. **Email Address Incorrect in Database**

**Check:** Verify the user's email in your database

```sql
SELECT email, first_name FROM users WHERE email = 'user@example.com';
```

**Fix:**
- Update email if wrong: `UPDATE users SET email = 'correct@example.com' WHERE id = 'user-id';`

---

### 4. **SendGrid Email Suppressed**

**Check:** Go to https://app.sendgrid.com/suppressions/bounces

**Look for:**
- User's email in Bounces list
- User's email in Blocks list
- User's email in Spam Reports

**Fix:**
- Remove email from suppression list if it was added by mistake
- If email is invalid, user needs to update their email

---

### 5. **Frontend Not Calling API Correctly**

**Check:** Look at browser console when user clicks "Change Password"

**Should see:**
```
POST /api/settings/request-password-change 200 OK
```

**If you see errors:**
- 401 Unauthorized → User not logged in
- 500 Server Error → Check server logs
- Network Error → Backend not running

**Fix:**
- Make sure user is logged in
- Check backend is running
- Check API URL is correct in frontend

---

## 🧪 Quick Test Steps

### Test 1: Check Email Delivery

1. Go to https://app.sendgrid.com/email_activity
2. Look for recent emails
3. You should see entries for your test user
4. Check status:
   - ✅ **Delivered** → Email reached inbox
   - ❌ **Dropped** → Email was rejected
   - ❌ **Bounced** → Invalid email address
   - ❌ **Deferred** → Temporary delay

### Test 2: Send Test Email Manually

```bash
node scripts/diagnose-2fa.js
```

Then check if the user received it (or check spam).

### Test 3: Check Server Logs

When user requests password change, you should see:
```
[requestPasswordChange] Password change requested for user: xxx
🔐 [2FA VERIFICATION CODE]
   To: user@example.com
   Code: 123456
✅ 2FA code sent to: user@example.com
```

**If you DON'T see these logs:**
- Frontend not calling API
- Wrong API endpoint
- User not authenticated

---

## 🔧 Immediate Solutions

### Option 1: Show Code in UI (Temporary Workaround)

While you fix email delivery, show the code in the browser console:

In `src/controllers/settingsController.js`, line 144, add:
```javascript
console.log('[2FA CODE FOR DEBUG]:', verificationCode);
```

Then tell users to press F12 → Console to see their code.

### Option 2: Use Gmail Instead (Quick Fix)

If SendGrid isn't working, switch to Gmail temporarily:

1. Create a Gmail account: `etabplatform@gmail.com`
2. Enable 2FA on Gmail
3. Generate App Password
4. Update `.env`:
```env
EMAIL_SERVICE=gmail
EMAIL_USER=etabplatform@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

### Option 3: Disable 2FA Temporarily

Remove 2FA for now (not recommended for production):

In `settingsController.js`, skip the email and return code directly:
```javascript
// Instead of sending email, return code in response (TEMPORARY ONLY)
res.json({
  success: true,
  message: 'Verification code generated',
  code: verificationCode, // ⚠️ Only for testing!
  expiresIn: 600
});
```

---

## 📧 How to Check if Email Was Sent

### Method 1: Server Console
Look for this output when user requests password change:
```
✅ 2FA code sent to: user@example.com
```

### Method 2: SendGrid Dashboard
1. https://app.sendgrid.com/email_activity
2. Filter by recipient email
3. Check status column

### Method 3: Ethereal (Development Mode)
If `SENDGRID_API_KEY` is not set, emails go to Ethereal:
```
✅ 2FA code sent to: user@example.com
Preview URL: https://ethereal.email/message/xxx
```
Click the URL to view the email.

---

## 🎯 Most Likely Fix

Based on the diagnostic, your emails ARE being sent. The issue is almost certainly:

1. **Emails in Spam folder** → Tell users to check spam
2. **Domain reputation** → Wait 1-2 weeks for reputation to build
3. **SendGrid suppression** → Check https://app.sendgrid.com/suppressions

**Next steps:**
1. Ask a user to check their Spam folder RIGHT NOW
2. Check SendGrid Email Activity for their email
3. If you see "Delivered" in SendGrid but user doesn't see it = Spam folder
4. If you see "Dropped" or "Bounced" in SendGrid = Email/suppression issue

---

## 🆘 Still Not Working?

Run this and share the output:
```bash
node scripts/diagnose-2fa.js
```

Then check SendGrid dashboard and share:
- Screenshot of Email Activity
- Screenshot of Domain Verification status

---

**Need immediate fix?** Use the Gmail option above - it works instantly! 📧
