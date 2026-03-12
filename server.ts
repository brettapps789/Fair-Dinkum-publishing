import dotenv from "dotenv";
dotenv.config();

import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import bodyParser from "body-parser";
import epub from "epub-gen-memory";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { marked } from "marked";
import { runOpenAITest } from "./book_project/agents/openai_test.js";
import { createWorkforce } from "./src/services/bookWorkforce.js";
import { googleService } from "./src/services/googleService.js";

let currentWorkforce: any = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'kdp-master-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true
    }
  }));

  app.use(bodyParser.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

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

  // DOCX Generation Endpoint
  app.post("/api/export/docx", async (req, res) => {
    try {
      const { title, author, chapters } = req.body;

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: title || "Untitled Book",
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                text: `Author: ${author || "Unknown Author"}`,
                heading: HeadingLevel.HEADING_2,
              }),
              ...chapters.flatMap((ch: any) => [
                new Paragraph({
                  text: ch.title,
                  heading: HeadingLevel.HEADING_1,
                  pageBreakBefore: true,
                }),
                ...ch.content.split("\n").map((line: string) => {
                  // Simple markdown to text conversion for docx
                  const cleanLine = line.replace(/[#*`]/g, "").trim();
                  if (!cleanLine) return new Paragraph({ text: "" });
                  return new Paragraph({
                    children: [new TextRun(cleanLine)],
                  });
                }),
              ]),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.docx"`);
      res.send(buffer);
    } catch (error) {
      console.error("DOCX Generation Error:", error);
      res.status(500).json({ error: "Failed to generate DOCX" });
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

  // Google Sheets OAuth Endpoints
  app.get("/api/auth/google/url", (req, res) => {
    try {
      const state = Math.random().toString(36).substring(2);
      (req.session as any).state = state;
      const url = googleService.getAuthUrl(state);
      res.json({ url });
    } catch (error: any) {
      console.error("Failed to generate Auth URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code, state } = req.query;
    const savedState = (req.session as any).state;

    if (state !== savedState) {
      return res.status(403).send("Invalid state parameter");
    }

    if (code) {
      try {
        const tokens = await googleService.setTokens(code as string);
        
        // Store credentials in session as requested
        (req.session as any).credentials = {
          token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          granted_scopes: tokens.scope
        };

        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. This window should close automatically.</p>
            </body>
          </html>
        `);
      } catch (error) {
        console.error("Auth error:", error);
        res.status(500).send("Authentication failed");
      }
    } else {
      res.status(400).send("No code provided");
    }
  });

  app.get("/api/auth/google/status", (req, res) => {
    try {
      res.json({ connected: googleService.isConnected() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Drive Endpoints
  app.get("/api/google/drive/files", async (req, res) => {
    try {
      const files = await googleService.listFiles();
      res.json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Docs Endpoints
  app.post("/api/google/docs/create", async (req, res) => {
    const { title, content } = req.body;
    try {
      const docId = await googleService.createDoc(title, content);
      res.json({ docId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Gmail Endpoints
  app.post("/api/google/gmail/send", async (req, res) => {
    const { to, subject, body } = req.body;
    try {
      await googleService.sendEmail(to, subject, body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Google Chat Endpoints
  app.get("/api/google/chat/spaces", async (req, res) => {
    try {
      const spaces = await googleService.listChatSpaces();
      res.json({ spaces });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Book Workforce Endpoints
  app.post("/api/workforce/start", async (req, res) => {
    const { topic, title, isAiGenerated } = req.body;
    currentWorkforce = createWorkforce(topic, title, isAiGenerated);
    res.json({ success: true, message: "Workforce initialized" });
  });

  app.get("/api/workforce/status", (req, res) => {
    console.log("GET /api/workforce/status - currentWorkforce:", !!currentWorkforce);
    if (!currentWorkforce) return res.status(404).json({ error: "No active workforce" });
    res.json(currentWorkforce.getState());
  });

  app.post("/api/workforce/step/research", async (req, res) => {
    if (!currentWorkforce) return res.status(404).json({ error: "No active workforce" });
    try {
      await currentWorkforce.runResearchPhase();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
  
  // 404 handler for API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global error handler:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
    });
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
