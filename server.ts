import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const dbPath = path.join(process.cwd(), "results.db");
console.log("Initializing database at:", dbPath);
const db = new Database(dbPath);

// Initialize database table
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentName TEXT NOT NULL,
    className TEXT NOT NULL,
    score REAL NOT NULL,
    assessment TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

const TEACHER_PASSWORD = "admin"; // Simple password as requested

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth
  app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === TEACHER_PASSWORD) {
      res.json({ success: true, role: "teacher" });
    } else {
      res.status(401).json({ success: false, message: "Sai mật khẩu" });
    }
  });

  // Content (Lessons & Quiz)
  app.get("/api/content", (req, res) => {
    try {
      const lecture = db.prepare("SELECT data FROM content WHERE id = 'lecture'").get() as { data: string } | undefined;
      const quiz = db.prepare("SELECT data FROM content WHERE id = 'quiz'").get() as { data: string } | undefined;
      
      console.log("Fetching content - Lecture found:", !!lecture, "Quiz found:", !!quiz);
      
      res.json({
        lessons: lecture ? JSON.parse(lecture.data) : [],
        quiz: quiz ? JSON.parse(quiz.data) : null
      });
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/content", (req, res) => {
    const { lessons, quiz } = req.body;
    try {
      if (lessons) {
        console.log("Saving lessons to DB...");
        db.prepare("INSERT OR REPLACE INTO content (id, data) VALUES ('lecture', ?)").run(JSON.stringify(lessons));
      }
      if (quiz) {
        console.log("Saving quiz to DB...");
        db.prepare("INSERT OR REPLACE INTO content (id, data) VALUES ('quiz', ?)").run(JSON.stringify(quiz));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving content:", error);
      res.status(500).json({ error: "Failed to save content" });
    }
  });

  // API Routes
  app.get("/api/results", (req, res) => {
    try {
      const results = db.prepare("SELECT * FROM results ORDER BY timestamp DESC").all();
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  app.post("/api/results", (req, res) => {
    const { studentName, className, score, assessment } = req.body;
    try {
      const stmt = db.prepare(
        "INSERT INTO results (studentName, className, score, assessment) VALUES (?, ?, ?, ?)"
      );
      const info = stmt.run(studentName, className, score, assessment);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to save result" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
