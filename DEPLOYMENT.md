# 🚀 CraveCompass Deployment Guide

Deploy CraveCompass on the recommended free-tier stack:
- **Database**: MongoDB Atlas (Free M0 Cluster)
- **Backend**: Render (Free Web Service)
- **Frontend**: Vercel (Free Next.js Hosting)

---

## Step 1: Set Up Cloud Database (MongoDB Atlas)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in / register.
2. Click **Create Deployment** → Select **M0 Free Tier** (AWS, choose closest region e.g., Mumbai `ap-south-1` or Singapore).
3. **Database Access**:
   - Create a username & password (e.g. user: `crave_admin`, choose a strong password).
4. **Network Access**:
   - Go to **Network Access** in the left sidebar → Click **Add IP Address** → Choose **Allow Access from Anywhere** (`0.0.0.0/0`) → Confirm.
5. **Get Connection String**:
   - In **Database Deployments**, click **Connect** → Choose **Drivers (Node.js)**.
   - Copy the connection URI:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cravecompass?retryWrites=true&w=majority
     ```
6. **Seed Cloud Database with all 43 Dhaka Restaurants**:
   - In your local terminal, run:
     ```bash
     cd backend
     MONGODB_URI="your_mongodb_atlas_connection_string" npm run seed
     ```
   *(Or temporarily paste the URI in `backend/.env` and run `npm run seed`)*

---

## Step 2: Push Your Project to GitHub

1. If you haven't already created a GitHub repository, create a new private or public repository on [GitHub](https://github.com/new) named `CraveCompass`.
2. Push your project from root:
   ```bash
   git init
   git add .
   git commit -m "feat: complete CraveCompass with Dhaka restaurants, animated UI, and cloud deployment config"
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/CraveCompass.git
   git push -u origin main
   ```
*(Note: `.env`, `.env.local`, and `node_modules` are automatically ignored by `.gitignore`)*

---

## Step 3: Deploy Backend on Render

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Connect your GitHub account and select your `CraveCompass` repository.
3. Configure the settings:
   - **Name**: `cravecompass-backend` (or your choice)
   - **Region**: Singapore or Frankfurt
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Add **Environment Variables** (under Advanced):
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` |
   | `MONGODB_URI` | *Your MongoDB Atlas connection string from Step 1* |
   | `CLIENT_URL` | `*` *(or update to your Vercel URL once deployed)* |
5. Click **Deploy Web Service**.
6. When deployment finishes, copy your Render service URL:
   `https://cravecompass-backend.onrender.com`

---

## Step 4: Deploy Frontend on Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** → **Project**.
2. Select your `CraveCompass` GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `frontend`
4. Expand **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://your-render-backend-url.onrender.com/api` |
   *(Note: OpenStreetMap does not require any map API token!)*
5. Click **Deploy**.
6. Vercel will build and deploy your app in under 60 seconds with a production URL:
   `https://cravecompass.vercel.app`

---

## 🎉 Verification Checklist

- [ ] Open the Vercel URL in your browser.
- [ ] Verify the map loads centered on Dhaka with interactive pins.
- [ ] Click **Pizza 🍕** and **Burgers 🍔** to verify live filtering.
- [ ] Click **Find Near Me** or search for any Dhaka location.
- [ ] Click any restaurant card to view the sliding detail panel with photos and reviews.
