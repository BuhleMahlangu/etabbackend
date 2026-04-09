# Serve Frontend from Backend (Single Domain Setup)

This setup serves both frontend and backend from the same Railway instance.

## Architecture

```
etab.co.za (Railway)
├── /api/* → Backend API
├── /assets/* → Frontend JS/CSS
└── /* → Frontend React app
```

## Step 1: Build Frontend & Copy to Backend

```bash
cd etabfrontend
npm run build

# Copy dist files to backend public folder
mkdir -p ../etabbackend/public
cp -r dist/* ../etabbackend/public/

cd ../etabbackend
```

## Step 2: Modify server.js

Add this to your server.js BEFORE the routes:

```javascript
// Serve static files from public folder (frontend)
app.use(express.static('public'));

// API routes come BEFORE the catch-all
app.use('/api', yourRoutes);

// Catch-all: serve index.html for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

## Step 3: Update package.json

Add this to etabbackend/package.json scripts:
```json
{
  "scripts": {
    "build:frontend": "cd ../etabfrontend && npm run build && cp -r dist/* ../etabbackend/public/",
    "postinstall": "mkdir -p public"
  }
}
```

## Step 4: Deploy to Railway

```bash
git add public/
git commit -m "Add frontend build"
git push origin main
```

Railway will deploy both frontend and backend together!

## Step 5: Update Environment Variables

In Railway, update:
- `CORS_ORIGIN` = `https://etab.co.za` (or leave empty since same origin)
- `FRONTEND_URL` = `https://etab.co.za`

## Advantages
- ✅ Single domain (no CORS issues)
- ✅ Single Railway project (cheaper)
- ✅ Easier to manage
- ✅ Better performance

## Disadvantages
- ✅ Frontend updates require backend redeploy
