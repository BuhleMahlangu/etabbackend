# 🚀 Deploy E-tab to etab.co.za - Complete Guide

## ✅ Your Current Status

| Item | Status |
|------|--------|
| Domain | ✅ etab.co.za owned |
| SendGrid | ✅ API key configured |
| JWT Secrets | ✅ Secure secrets generated |
| Cloudinary | ✅ Configured |

## 📋 Step-by-Step Deployment

---

## Step 1: Prepare Production Environment

### 1.1 Update Your .env File

Replace your current `.env` with these production values:

```env
# ============================================
# E-tab Production Configuration
# ============================================
NODE_ENV=production
PORT=5000

# ============================================
# DATABASE - Will get from Railway
# ============================================
# Railway will provide this automatically
DATABASE_URL=${{Railway.DATABASE_URL}}

# ============================================
# JWT CONFIGURATION - Your secure secrets
# ============================================
JWT_SECRET=9547428ca6b3bf7d776d245ee840e2929c0dcb43571bc95e59eb4ffc41e1eafe1765548ec6df17c1c4cb903f469922958688d77584f3cba7a81c55f04cd12e20
JWT_REFRESH_SECRET=a369be507ef781a14ff8c54317a6279ba8da9c39e831e69c5a4a0a8e517f3fab21ed0c85f7642498c61b0c9623741849f15dc1855389aaade84fb9597960a6ae
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ============================================
# CLOUDINARY - Keep current
# ============================================
CLOUDINARY_CLOUD_NAME=diaqpzqox
CLOUDINARY_API_KEY=125642996148815
CLOUDINARY_API_SECRET=9pTzTWZk-sBA-8UNI1FXgv5ytik

# ============================================
# AI Tutor - Keep current
# ============================================
GEMINI_API_KEY=AIzaSyD_g28v--B1fEwEtVEYZ0NXivT0NSAvPaU

# ============================================
# CORS - Your production domain
# ============================================
FRONTEND_URL=https://etab.co.za
CORS_ORIGIN=https://etab.co.za

# ============================================
# EMAIL - SendGrid (already configured)
# ============================================
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
EMAIL_FROM_NAME=E-tab Education
EMAIL_FROM_ADDRESS=noreply@yourdomain.co.za
EMAIL_SUPPORT_ADDRESS=support@yourdomain.co.za
EMAIL_REPLY_TO=support@etab.co.za

# ============================================
# FILE UPLOAD
# ============================================
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=pdf,doc,docx,ppt,pptx,xls,xlsx,mp4,webm,zip

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================
# SECURITY
# ============================================
SESSION_SECRET=17a7f9d03fc38a04ed80d6e728eb8f8b44db13aec24c8034b983e31603b816e4
CSRF_SECRET=2bedc25aa9545f066f0d71c4642ca1a5adfd4bc50f681e0ad604c79d59074fad
API_KEY_SALT=af6332eeec8a791d9bcb5ad4604e31dc
ENABLE_SECURITY_HEADERS=true
```

---

## Step 2: Sign Up for Railway

1. Go to https://railway.app
2. Click "Get Started" → Sign up with GitHub
3. Verify your email

---

## Step 3: Push Code to GitHub

```bash
# Make sure .env is NOT committed
git status
# Should NOT show .env

# Add all files
git add .

# Commit
git commit -m "Prepare for production deployment"

# Push to GitHub
git push origin main
```

---

## Step 4: Deploy Backend on Railway

### 4.1 Create New Project
1. Railway Dashboard → "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your E-tab repository

### 4.2 Add PostgreSQL Database
1. Click "New" → Database → Add PostgreSQL
2. Railway creates database automatically
3. Copy the `DATABASE_URL` (we'll need it)

### 4.3 Add Environment Variables
Go to your project → Variables → New Variable:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (auto-filled) |
| `JWT_SECRET` | `9547428ca6b3bf7d776d245ee840e2929c0dcb43571bc95e59eb4ffc41e1eafe1765548ec6df17c1c4cb903f469922958688d77584f3cba7a81c55f04cd12e20` |
| `JWT_REFRESH_SECRET` | `a369be507ef781a14ff8c54317a6279ba8da9c39e831e69c5a4a0a8e517f3fab21ed0c85f7642498c61b0c9623741849f15dc1855389aaade84fb9597960a6ae` |
| `CLOUDINARY_CLOUD_NAME` | `diaqpzqox` |
| `CLOUDINARY_API_KEY` | `125642996148815` |
| `CLOUDINARY_API_SECRET` | `9pTzTWZk-sBA-8UNI1FXgv5ytik` |
| `GEMINI_API_KEY` | `AIzaSyD_g28v--B1fEwEtVEYZ0NXivT0NSAvPaU` |
| `FRONTEND_URL` | `https://etab.co.za` |
| `CORS_ORIGIN` | `https://etab.co.za` |
| `EMAIL_SERVICE` | `sendgrid` |
| `SENDGRID_API_KEY` | `SG.your_sendgrid_api_key_here` |
| `EMAIL_FROM_NAME` | `E-tab Education` |
| `EMAIL_FROM_ADDRESS` | `noreply@etab.co.za` |
| `EMAIL_SUPPORT_ADDRESS` | `support@etab.co.za` |

### 4.4 Deploy
Railway auto-deploys when you add variables!

### 4.5 Get Your Backend URL
After deployment:
1. Go to your Railway project
2. Click on your service
3. Look for "Public Domain" (e.g., `etab.up.railway.app`)
4. Copy this URL - you'll need it!

---

## Step 5: Deploy Frontend

You have 2 options:

### Option A: Deploy Frontend on Railway (Same Project)

1. In Railway, add another service
2. Select your frontend folder
3. Set build command: `npm run build`
4. Set start command: `npm run preview` (or use a static server)
5. Add environment variable: `VITE_API_URL=https://your-backend.railway.app`

### Option B: Use Vercel for Frontend (Recommended)

1. Go to https://vercel.com
2. Import your GitHub repo
3. Select frontend folder
4. Add environment variable:
   - Name: `VITE_API_URL`
   - Value: `https://your-backend.railway.app`
5. Deploy!

---

## Step 6: Connect Your Domain (etab.co.za)

### 6.1 In Railway (for Backend)
1. Go to your Railway project
2. Click "Settings" → Domains
3. Click "Custom Domain"
4. Enter: `api.etab.co.za` (for backend)
5. Railway gives you a DNS target (e.g., `cname.railway.app`)

### 6.2 In GoDaddy (DNS Setup)
1. Log in to https://godaddy.com
2. Go to My Products → DNS
3. Add CNAME record:
   - Name: `api`
   - Value: `[Railway's CNAME target]`
   - TTL: 1 hour

4. For frontend (if using Vercel):
   - Add CNAME: `www` → `cname.vercel-dns.com`
   - Or add A record for root domain

### 6.3 Wait for DNS
- Usually 5-30 minutes
- Check: https://dnschecker.org

---

## Step 7: Update CORS and Frontend URL

Once your domain is connected, update Railway variables:

| Variable | New Value |
|----------|-----------|
| `FRONTEND_URL` | `https://etab.co.za` |
| `CORS_ORIGIN` | `https://etab.co.za` |

Redeploy (Railway auto-redeploys on variable change).

---

## Step 8: Database Migration

Your local database needs to be migrated to Railway:

### Option 1: Fresh Start (Recommended for New Site)
Just run the setup scripts on Railway:
```bash
# In Railway shell or locally with Railway CLI
railway run node scripts/fix-missing-modules.js
```

### Option 2: Migrate Existing Data
```bash
# Dump local database
pg_dump -h localhost -U my_user E-tab > etab_backup.sql

# Restore to Railway
railway run psql -d $DATABASE_URL -f etab_backup.sql
```

---

## Step 9: Verify Deployment

Checklist:
- [ ] Backend responds at `https://api.etab.co.za/health`
- [ ] Frontend loads at `https://etab.co.za`
- [ ] Can register a new user
- [ ] Can log in
- [ ] Emails send (check SendGrid dashboard)
- [ ] File uploads work

---

## 💰 Expected Costs

| Service | Monthly Cost |
|---------|--------------|
| Railway (Starter) | $5 (~R90) |
| Domain (already owned) | R0 |
| SendGrid (100 emails/day) | FREE |
| Cloudinary | FREE (25GB) |
| Vercel (Frontend) | FREE |
| **Total** | **~R90/month** |

---

## 🚨 Important Notes

1. **Never commit .env to Git** - It's already in .gitignore ✅

2. **Database persists** - Railway PostgreSQL keeps your data

3. **Updates are automatic** - Push to GitHub → Auto redeploy

4. **Monitor usage** - Railway free tier: $5 credit/month

5. **Backups** - Railway has automatic daily backups

---

## 🆘 Need Help?

If something breaks:
1. Check Railway logs (Dashboard → Deployments → Logs)
2. Run checklist: `node scripts/pre-deploy-checklist.js`
3. Test locally with production .env first

---

## 🎯 Ready to Start?

**Let's begin!** Which step do you want to start with:

1. **I need to set up Railway first** → I'll walk you through signup
2. **My code is ready on GitHub** → Let's connect Railway now
3. **I want to test locally first** → Let's update .env for production testing

**Reply with the number or tell me where you are in the process!** 🚀
