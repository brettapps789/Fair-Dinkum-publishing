import express from "express";
import { createServer as createViteServer } from "vite";
import bodyParser from "body-parser";
import epub from "epub-gen-memory";
import { marked } from "marked";
import { runOpenAITest } from "./book_project/agents/openai_test.js";
import { createWorkforce } from "./src/services/bookWorkforce.js";

let currentWorkforce: any = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(bodyParser.json({ limit: '50mb' }));

  // EPUB Generation Endpoint
  app.post("/api/export/epub", async (req, res) => {
    try {
      const { title, author, content, chapters, coverImage } = req.body;

      const option = {
        title: title || "Untitled Book",
        author: author || "Unknown Author",
        publisher: "KDP Master Suite",
        cover: coverImage || undefined,
        content: chapters.map((ch: any) => ({
          title: ch.title,
          data: marked(ch.content)
        }))
      };

      const archive = await epub(option, []);
      
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.epub"`);
      res.send(archive);
    } catch (error) {
      console.error("EPUB Generation Error:", error);
      res.status(500).json({ error: "Failed to generate EPUB" });
    }
  });

  // OpenAI Test Endpoint
  app.get("/api/test/openai", async (req, res) => {
    try {
      const result = await runOpenAITest();
      res.json({ success: true, output: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Book Workforce Endpoints
  app.post("/api/workforce/start", async (req, res) => {
    const { topic, title } = req.body;
    currentWorkforce = createWorkforce(topic, title);
    res.json({ success: true, message: "Workforce initialized" });
  });

  app.get("/api/workforce/status", (req, res) => {
    if (!currentWorkforce) return res.status(404).json({ error: "No active workforce" });
    res.json(currentWorkforce.getState());
  });

  app.post("/api/workforce/step/outline", async (req, res) => {
    if (!currentWorkforce) return res.status(404).json({ error: "No active workforce" });
    try {
      const outline = await currentWorkforce.runOutlinePhase();
      res.json({ success: true, outline });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/workforce/step/chapter", async (req, res) => {
    const { index, title, context } = req.body;
    if (!currentWorkforce) return res.status(404).json({ error: "No active workforce" });
    try {
      const content = await currentWorkforce.runChapterPhase(index, title, context);
      res.json({ success: true, content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/workforce/step/compile", async (req, res) => {
    if (!currentWorkforce) return res.status(404).json({ error: "No active workforce" });
    try {
      await currentWorkforce.runCompilationPhase();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
