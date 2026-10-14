# AI Planner

An intelligent personal & workspace productivity operating system with AI Copilot, Task Flow, Calendar, Client & Project management, Deep Focus sessions, Study tracks, and Idea vault.

## ✨ Features

- **My Day & Command Center**: Daily agenda, high-priority objectives, and quick task capture.
- **AI Copilot & Assistant**: Context-aware assistant supporting multiple LLM backends (OpenAI, OpenRouter, NVIDIA NIM, Groq).
- **Task Management**: Kanban flow, list views, priority tags, subtasks, and deadlines.
- **Time Blocking & Calendar**: Visual schedule with event and task integration.
- **Projects & Clients**: Client relationship tracking, workspace attribution, and project pipelines.
- **Focus Sessions**: Pomodoro-style distraction-free timer with session logging.
- **Idea Lab & Study Tracks**: Brainstorming canvas with AI expansion and structured study progress.

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Lucide Icons, Sonner.
- **Backend**: Node.js, Hono, tRPC.
- **Database & ORM**: MySQL with Drizzle ORM.
- **AI Integrations**: Vercel AI SDK with OpenAI-compatible providers.

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/NayaniMahdi/Aster-AI-Planner
cd Aster-AI-Planner
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your MySQL database credentials and secrets:
```env
PORT=3000
APP_ID=aiplanner
APP_SECRET=your-secure-secret-here
DATABASE_URL=mysql://user:password@localhost:3306/aiplanner
```

### 4. Setup Database
Push the schema to your MySQL instance:
```bash
npm run db:push
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔒 Privacy & Security

- No sensitive API keys or local database records are committed to version control.
- All secrets are loaded via environment variables (`.env`, which is git-ignored).
- AI credentials can either be supplied in `.env` or saved in your local database via the in-app Settings modal.

## 📄 License
MIT
