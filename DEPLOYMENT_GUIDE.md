# E-tab Deployment Guide

Complete guide to deploy E-tab to production.

---

## 📋 Pre-Deployment Checklist

- [ ] All secrets generated (run `node scripts/generate-secrets.js`)
- [ ] `.env` file created from `.env.example`
- [ ] SendGrid account created and API key obtained
- [ ] Cloudinary account configured
- [ ] Database credentials ready
- [ ] Frontend URL decided (e.g., https://etab.yourschool.edu)
- [ ] `.env` added to `.gitignore`

---

## 🚀 Option 1: Railway Deployment (Recommended - Easiest)

Railway offers free hosting with PostgreSQL included.

### Step 1: Prepare Your Code

```bash
# 1. Make sure .env is not in git
cat .gitignore | grep -q ".env" || echo ".env" >> .gitignore

# 2. Commit all changes
git add .
git commit -m "Ready for production deployment"

# 3. Push to GitHub
git push origin main
```

### Step 2: Deploy Backend to Railway

1. **Sign up at [Railway.app](https://railway.app)** (use GitHub login)

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL Database**
   - Click "New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will automatically set `DATABASE_URL`

4. **Configure Environment Variables**
   Go to your service → Variables → New Variable:

   ```
   NODE_ENV=production
   JWT_SECRET=paste_generated_secret_here
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   GEMINI_API_KEY=your_gemini_key
   EMAIL_SERVICE=sendgrid
   SENDGRID_API_KEY=SG.your_sendgrid_key
   EMAIL_FROM=Your School <noreply@yourschool.edu>
   FRONTEND_URL=https://your-frontend-url.com
   CORS_ORIGIN=https://your-frontend-url.com
   ```

5. **Deploy**
   - Railway automatically deploys on git push
   - Or click "Deploy" in the dashboard

6. **Get Backend URL**
   - Go to your service → Settings
   - Copy the domain (e.g., `https://etab-backend.up.railway.app`)

### Step 3: Deploy Frontend to Vercel

1. **Sign up at [Vercel.com](https://vercel.com)** (use GitHub login)

2. **Import Project**
   - Click "Add New..." → "Project"
   - Import your frontend repository

3. **Configure Build**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Environment Variables**
   ```
   VITE_API_URL=https://your-railway-backend-url.com/api
   ```

5. **Deploy**
   - Vercel automatically deploys
   - Get your frontend URL (e.g., `https://etab.vercel.app`)

6. **Update CORS**
   - Go back to Railway backend settings
   - Update `FRONTEND_URL` and `CORS_ORIGIN` to your Vercel URL

---

## 🐳 Option 2: Docker Deployment

For self-hosting or other cloud providers.

### Local Testing

```bash
# 1. Create .env file
cp .env.example .env
# Edit .env with your credentials

# 2. Run with Docker Compose
docker-compose up -d

# 3. Check logs
docker-compose logs -f app

# 4. Stop
docker-compose down
```

### Deploy to Any VPS (DigitalOcean, AWS, etc.)

```bash
# 1. SSH into your server
ssh user@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone repository
git clone https://github.com/yourusername/etab-backend.git
cd etab-backend

# 4. Create .env file
nano .env
# Paste your production environment variables

# 5. Run
docker-compose up -d

# 6. Setup reverse proxy (nginx)
sudo apt install nginx
# Configure nginx to proxy to localhost:5000
```

---

## ☁️ Option 3: Render Deployment

Render is another easy alternative to Railway.

### Backend (Web Service)

1. **Sign up at [Render.com](https://render.com)**

2. **New Web Service**
   - Connect your GitHub repo
   - Name: `etab-backend`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add PostgreSQL**
   - New → PostgreSQL
   - Copy the internal connection string

4. **Environment Variables**
   Add all variables from the Railway section above

### Frontend (Static Site)

1. **New Static Site**
   - Connect frontend repo
   - Build Command: `npm run build`
   - Publish Directory: `dist`

2. **Add Environment Variable**
   ```
   VITE_API_URL=https://etab-backend.onrender.com/api
   ```

---

## 📧 Email Setup (SendGrid)

See [SENDGRID_SETUP.md](./SENDGRID_SETUP.md) for detailed instructions.

Quick steps:
1. Sign up at [SendGrid](https://signup.sendgrid.com/)
2. Verify sender identity
3. Create API Key
4. Add to environment variables:
   ```
   EMAIL_SERVICE=sendgrid
   SENDGRID_API_KEY=SG.your_key_here
   ```

---

## 🔒 Security Checklist

- [ ] JWT_SECRET is 64+ characters, random
- [ ] `.env` is in `.gitignore`
- [ ] Old secrets rotated (Cloudinary, Database, etc.)
- [ ] CORS_ORIGIN set to exact frontend URL (not `*`)
- [ ] NODE_ENV=production
- [ ] Rate limiting enabled
- [ ] HTTPS enforced (platforms do this automatically)
- [ ] Database not publicly accessible
- [ ] File upload size limits configured

---

## 🧪 Testing Production

After deployment, test these flows:

1. **Registration**
   ```bash
   curl -X POST https://your-api.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User","role":"learner","grade":"10","schoolCode":"KHS"}'
   ```

2. **Login**
   ```bash
   curl -X POST https://your-api.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'
   ```

3. **Check Email Delivery**
   - Register a learner
   - Check SendGrid Dashboard → Activity
   - Verify email was delivered

4. **File Upload**
   - Login as teacher
   - Upload a material
   - Verify file appears in Cloudinary

---

## 🚨 Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL format
- Verify database is running
- Check network/firewall rules

### "CORS error"
- Verify CORS_ORIGIN matches your frontend URL exactly
- Include `https://` and no trailing slash

### "Emails not sending"
- Check SendGrid API key is correct
- Verify sender identity is authenticated
- Check SendGrid Activity feed for errors

### "JWT errors"
- Ensure JWT_SECRET is set and 64+ characters
- Restart server after changing secrets

---

## 📈 Scaling (When Needed)

### Upgrade Railway Plan
- Go to Project Settings → Billing
- Starter plan ($5/month) for better performance

### Database Optimization
- Add connection pooling (PgBouncer)
- Set up read replicas for reporting queries

### CDN Setup
- Use Cloudflare in front of your frontend
- Cache static assets

### Monitoring
- Add Sentry for error tracking
- Use Railway metrics for performance

---

## 📞 Support

- **Railway Docs**: https://docs.railway.app/
- **Render Docs**: https://render.com/docs
- **SendGrid Support**: https://support.sendgrid.com/
- **Vercel Docs**: https://vercel.com/docs

---

## ✅ Post-Deployment Checklist

- [ ] Website loads on custom domain
- [ ] Registration works
- [ ] Login works
- [ ] Emails are received
- [ ] File uploads work
- [ ] Mobile responsive
- [ ] HTTPS enabled
- [ ] Database backed up
- [ ] Monitoring enabled (optional)

**Congratulations! Your E-tab is now live!** 🎉
