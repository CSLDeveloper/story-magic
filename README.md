# Story Magic ✨

A magical AI-powered children's story generator. Children answer 7 fun questions and Claude writes them a personalized 12-page adventure story.

## Setup

### 1. Get an Anthropic API Key
- Go to https://console.anthropic.com
- Sign up / log in
- Click API Keys → Create Key
- Copy the key

### 2. Add Environment Variable
Create a file called `.env.local` in the root of this project:
```
ANTHROPIC_API_KEY=your-api-key-here
```

### 3. Install & Run Locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy to Render

1. Push this repo to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set these values:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variable:** `ANTHROPIC_API_KEY` = your key
5. Click Deploy

Your app will be live at `https://your-app-name.onrender.com`

## Cost
- Render free tier: $0/month
- Anthropic API: ~$0.01-0.02 per story generated
