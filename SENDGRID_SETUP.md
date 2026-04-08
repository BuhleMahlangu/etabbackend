# SendGrid Email Setup Guide

SendGrid is the recommended email service for production. It offers:
- **100 emails/day free** (sufficient for small schools)
- **High deliverability** (emails land in inbox, not spam)
- **Real-time analytics** (track opens, clicks, bounces)

---

## Step 1: Create SendGrid Account

1. Go to [https://signup.sendgrid.com/](https://signup.sendgrid.com/)
2. Sign up with your email
3. Verify your email address
4. Complete the account setup wizard

---

## Step 2: Verify Sender Identity

SendGrid requires you to verify your sender identity before sending emails.

### Option A: Single Sender Verification (Easiest for Testing)

1. In SendGrid Dashboard, go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender**
3. Fill in the form:
   - **From Name**: Your School Name (e.g., "KHS School")
   - **From Email**: noreply@yourdomain.com (or your Gmail)
   - **Reply To**: support@yourdomain.com
   - **Company**: Your School Name
   - **Address**: Your school's physical address
4. Click **Create**
5. Check your email and click the verification link

### Option B: Domain Authentication (Recommended for Production)

If you have a custom domain (e.g., `khsschool.edu`):

1. Go to **Settings** → **Sender Authentication** → **Domain Authentication**
2. Click **Authenticate Your Domain**
3. Select your DNS host (or "Other Host" if not listed)
4. Enter your domain: `yourdomain.com`
5. SendGrid will provide DNS records to add
6. Add these records to your domain's DNS settings
7. Click **Verify**

---

## Step 3: Create API Key

1. In SendGrid Dashboard, go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Give it a name: `E-tab Production`
4. Select **Full Access** (or restrict to "Mail Send" only)
5. Click **Create & View**
6. **COPY THE API KEY IMMEDIATELY** (you can't see it again!)

---

## Step 4: Configure E-tab

Add to your `.env` file:

```env
# Email Configuration - SendGrid
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.your_actual_api_key_here
EMAIL_FROM=Your School Name <noreply@yourdomain.com>
FRONTEND_URL=https://yourdomain.com
```

---

## Step 5: Test Email Sending

### Test via API (using curl):

```bash
curl --request POST \
  --url https://api.sendgrid.com/v3/mail/send \
  --header "Authorization: Bearer SG.your_api_key" \
  --header 'Content-Type: application/json' \
  --data '{
    "personalizations": [
      {
        "to": [
          {
            "email": "your-email@example.com"
          }
        ]
      }
    ],
    "from": {
      "email": "noreply@yourdomain.com",
      "name": "Your School"
    },
    "subject": "Test Email from E-tab",
    "content": [
      {
        "type": "text/plain",
        "value": "This is a test email from your E-tab system!"
      }
    ]
  }'
```

### Test via E-tab:

1. Register a new learner account
2. Check if welcome email is received
3. Check SendGrid Dashboard → Activity (for delivery status)

---

## Step 6: Monitor Email Activity

SendGrid Dashboard provides:
- **Activity Feed**: See all sent emails
- **Stats**: Delivery rates, opens, clicks
- **Suppressions**: Bounces, spam reports, unsubscribes

Go to: **Statistics** → **Overview**

---

## Troubleshooting

### Issue: "Forbidden" error when sending

**Cause**: Single sender not verified or domain not authenticated

**Solution**: Complete Step 2 above

### Issue: Emails going to spam

**Solutions**:
1. Use domain authentication (not single sender)
2. Set up SPF and DKIM records
3. Warm up your sending reputation (start with low volume)

### Issue: "Unauthorized" error

**Cause**: Invalid API key

**Solution**: 
1. Generate a new API key
2. Ensure no extra spaces when copying
3. Key should start with `SG.`

---

## Pricing (as of 2024)

| Plan | Emails/Month | Price |
|------|--------------|-------|
| Free | 100/day (3,000/month) | $0 |
| Essentials | 50,000 | $19.95/month |
| Pro | 200,000 | $89.95/month |

**For most schools, the Free tier is sufficient.**

---

## Alternative: Gmail SMTP (Not Recommended)

If you absolutely cannot use SendGrid:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-school@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

**Limitations**:
- 500 emails/day limit
- Higher chance of emails going to spam
- Requires 2FA enabled on Gmail account
- Less reliable for transactional emails

---

## Next Steps

After setting up SendGrid:
1. Test all email flows (welcome, password reset, 2FA)
2. Set up email templates in SendGrid (optional)
3. Configure webhooks for bounce handling (advanced)

For help, contact SendGrid Support: https://support.sendgrid.com/
