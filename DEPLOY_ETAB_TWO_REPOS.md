# 🚀 Deploy E-tab with Frontend + Backend (Two Repos)

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│      FRONTEND           │         │       BACKEND           │
│   (Vercel/Railway)      │◄───────►│      (Railway)          │
│    etab.co.za           │  API    │   api.etab.co.za        │
│   React + Vite          │         │   Node.js + Express     │
└─────────────────────────┘         └─────────────────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  PostgreSQL (DB)    │
                                    │    (Railway)        │
                                    └─────────────────────┘
```

---

## 📦 PART 1: Deploy Backend (etabbackend)

### Step 1: Backend .env.production

Create `.env.production` in your **etabbackend** folder:

```env
# ============================================
# E-tab Backend - Production
# ============================================
NODE_ENV=production
PORT=5000

# Database (Railway provides this)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# JWT Secrets (use your generated ones)
JWT_SECRET=9547428ca6b3bf7d776d245ee840e2929c0dcb43571bc95e59eb4ffc41e1eafe1765548ec6df17c1c4cb903f469922958688d77584f3cba7a81c55f04cd12e20
JWT_REFRESH_SECRET=a369be507ef781a14ff8c54317a6279ba8da9c39e831e69c5a4a0a8e517f3fab21ed0c85f7642498c61b0c9623741849f15dc1855389aaade84fb9597960a6ae
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Cloudinary (keep your current)
CLOUDINARY_CLOUD_NAME=diaqpzqox
CLOUDINARY_API_KEY=125642996148815
CLOUDINARY_API_SECRET=9pTzTWZk-sBA-8UNI1FXgv5ytik

# Gemini AI
GEMINI_API_KEY=AIzaSyD_g28v--B1fEwEtVEYZ0NXivT0NSAvPaU

# CORS - Allow frontend domain
FRONTEND_URL=https://etab.co.za
CORS_ORIGIN=https://etab.co.za

# Email - SendGrid
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
EMAIL_FROM_NAME=E-tab Education
EMAIL_FROM_ADDRESS=noreply@etab.co.za
EMAIL_SUPPORT_ADDRESS=support@etab.co.za

# Security
SESSION_SECRET=17a7f9d03fc38a04ed80d6e728eb8f8b44db13aec24c8034b983e31603b816e4
CSRF_SECRET=2bedc25aa9545f066f0d71c4642ca1a5adfd4bc50f681e0ad604c79d59074fad
API_KEY_SALT=af6332eeec8a791d9bcb5ad4604e31dc
ENABLE_SECURITY_HEADERS=true

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=pdf,doc,docx,ppt,pptx,xls,xlsx,mp4,webm,zip

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 2: Deploy Backend to Railway

1. **Push etabbackend to GitHub** (if not already)
   ```bash
   cd etabbackend
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Go to https://railway.app**
   - Sign up with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose **etabbackend**

3. **Add PostgreSQL**
   - Click "New" → "Database" → "Add PostgreSQL"

4. **Add Environment Variables**
   - Go to Variables tab
   - Click "Raw Editor"
   - Copy everything from `.env.production` above
   - Paste and Save

5. **Get Backend URL**
   - After deploy, copy your URL: `https://etabbackend-production.up.railway.app`
   - **Save this!** You'll need it for frontend

---

## 📦 PART 2: Deploy Frontend (etabfrontend)

### Step 1: Update Frontend API URL

In your **etabfrontend** code, find where you set the API URL (usually in a config file or `.env`):

**Option A: If using Vite (most likely)**
Create `.env.production` in etabfrontend:
```env
VITE_API_URL=https://etabbackend-production.up.railway.app
```

**Option B: If using create-react-app**
Create `.env.production`:
```env
REACT_APP_API_URL=https://etabbackend-production.up.railway.app
```

**Option C: If hardcoded in a config file**
Update your `config.js` or similar:
```javascript
// config.js
export const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://etabbackend-production.up.railway.app'
  : 'http://localhost:5000';
```

### Step 2: Deploy Frontend to Vercel (Recommended)

**Why Vercel for frontend?**
- ✅ FREE for static sites
- ✅ Super fast global CDN
- ✅ Auto-deploy from GitHub
- ✅ Perfect for React/Vite

1. **Push etabfrontend to GitHub**
   ```bash
   cd etabfrontend
   git add .
   git commit -m "Production API URL configured"
   git push origin main
   ```

2. **Go to https://vercel.com**
   - Sign up with GitHub
   - Click "Add New Project"
   - Import your **etabfrontend** repo

3. **Configure Build**
   - Framework Preset: Select "Vite" (or "Create React App")
   - Build Command: `npm run build` (or `vite build`)
   - Output Directory: `dist` (or `build`)
   - Click "Deploy"

4. **Add Environment Variable**
   - Go to Project Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://etabbackend-production.up.railway.app`
   - Redeploy

5. **Get Frontend URL**
   - Vercel gives you: `https://etabfrontend.vercel.app`
   - **Save this!**

---

## 📦 PART 3: Connect Your Domain (etab.co.za)

### Option A: Simple Setup (Recommended)

Point root domain to Vercel (frontend), subdomain to Railway (backend):

**Frontend: etab.co.za → Vercel**
1. In Vercel Dashboard → Your Project → Domains
2. Add `etab.co.za`
3. Vercel gives you DNS records
4. Add to GoDaddy:
   - Type: A Record
   - Name: @ (root)
   - Value: [Vercel's IP]
   - OR CNAME: `www` → `cname.vercel-dns.com`

**Backend: api.etab.co.za → Railway**
1. In Railway → Your Project → Settings → Domains
2. Add Custom Domain: `api.etab.co.za`
3. Railway gives you CNAME target
4. Add to GoDaddy:
   - Type: CNAME
   - Name: `api`
   - Value: [Railway's CNAME]

### Update Backend CORS

Once domain is connected, update Railway variables:
```
FRONTEND_URL=https://etab.co.za
CORS_ORIGIN=https://etab.co.za
```

---

## 📋 Deployment Checklist

### Backend (Railway)
- [ ] Pushed etabbackend to GitHub
- [ ] Created Railway project
- [ ] Added PostgreSQL
- [ ] Added all environment variables
- [ ] Deployed successfully
- [ ] Got Railway URL

### Frontend (Vercel)
- [ ] Updated API_URL to Railway backend URL
- [ ] Pushed etabfrontend to GitHub
- [ ] Created Vercel project
- [ ] Set build settings (Vite/CRA)
- [ ] Added VITE_API_URL environment variable
- [ ] Deployed successfully

### Domain (GoDaddy)
- [ ] Added DNS records for etab.co.za → Vercel
- [ ] Added DNS records for api.etab.co.za → Railway
- [ ] Waited for DNS propagation (5-30 min)
- [ ] Updated CORS_ORIGIN to production domain

### Testing
- [ ] https://etab.co.za loads frontend
- [ ] https://api.etab.co.za loads backend
- [ ] Can register/login
- [ ] API calls work (no CORS errors)
- [ ] File uploads work
- [ ] Emails send

---

## 🆘 Troubleshooting

### CORS Errors
If you see CORS errors in browser console:
1. Check backend `CORS_ORIGIN` includes your frontend domain
2. Make sure no trailing slash mismatch (`https://etab.co.za` vs `https://etab.co.za/`)
3. Redeploy backend after changing CORS

### API Not Found (404)
- Check `VITE_API_URL` is set correctly in Vercel
- Check backend health: `https://api.etab.co.za/health`

### Build Fails on Vercel
- Check build command matches your setup (`npm run build` for CRA, `vite build` for Vite)
- Check output directory (`build` for CRA, `dist` for Vite)

---

## 💰 Costs

| Service | Cost/Month |
|---------|-----------|
| Railway (Backend + DB) | $5 (~R90) |
| Vercel (Frontend) | FREE |
| Domain (you own) | R0 |
| SendGrid (100 emails/day) | FREE |
| Cloudinary | FREE |
| **TOTAL** | **~R90/month** |

---

## 🚀 Quick Start Commands

```bash
# 1. Push backend
cd etabbackend
git add .
git commit -m "Production deploy"
git push origin main

# 2. Push frontend (after updating API URL)
cd ../etabfrontend
git add .
git commit -m "Production API URL"
git push origin main

# 3. Done! Both auto-deploy.
```

---

## 🎯 Next Steps

**Which part do you want to start with?**

1. **Deploy backend first** → I'll help you set up Railway
2. **I'm ready to push to GitHub** → Tell me when you're at Railway variables
3. **Frontend API config** → Show me your frontend code structure first

**Reply with the number and I'll guide you step-by-step!** 🚀
