import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs";
import path from "path";
import { googleService } from "./googleService.js";
import { GoogleGenAI } from "@google/genai";

export interface BookState {
  topic: string;
  title: string;
  isAiGenerated: boolean;
  status: 'idle' | 'researching' | 'outlining' | 'writing' | 'editing' | 'compiling' | 'completed' | 'error';
  currentChapter: number;
  totalChapters: number;
  logs: string[];
  research: string;
  outline: string;
  chapters: { title: string; content: string }[];
  spreadsheetId?: string;
}

class BookProductionWorkforce {
  private llm: ChatOpenAI;
  private state: BookState;
  private baseDir: string;

  constructor(topic: string, title: string, isAiGenerated: boolean = true) {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.state = {
      topic,
      title,
      isAiGenerated,
      status: 'idle',
      currentChapter: 0,
      totalChapters: 0,
      logs: [],
      research: '',
      outline: '',
      chapters: [],
    };

    this.baseDir = path.join(process.cwd(), 'book_project');
    this._setupDirectories();
  }

  private _setupDirectories() {
    const dirs = ['chapters', 'output', 'agents'];
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir);
    dirs.forEach(dir => {
      const p = path.join(this.baseDir, dir);
      if (!fs.existsSync(p)) fs.mkdirSync(p);
    });
  }

  private log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    this.state.logs.push(logEntry);
    console.log(logEntry);
  }

  public getState() {
    return this.state;
  }

  async runResearchPhase() {
    this.state.status = 'researching';
    this.log(`Starting Deep Research for: ${this.state.topic}`);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    try {
      // Using the interaction API as suggested by the user's Python snippet
      // We use 'any' to bypass potential type definition gaps for this preview model
      const interaction = await (ai as any).interactions.create({
        model: 'deep-research-pro-preview-12-2025',
        input: `Conduct a deep research for a book about: ${this.state.topic}. 
                Provide a comprehensive report including historical context, key technical details, 
                major figures, current state of the art, and future predictions. 
                This research will be used to outline and write a full book.`,
        config: { background: true }
      });

      this.log(`Research started: ${interaction.id}`);

      if (this.state.spreadsheetId) {
        await googleService.appendRow(this.state.spreadsheetId, 'A:B', ['Research', 'In Progress']);
      }

      while (true) {
        const status = await (ai as any).interactions.get({ id: interaction.id });
        if (status.status === "completed") {
          const researchResult = status.outputs[status.outputs.length - 1].text;
          this.state.research = researchResult;
          fs.writeFileSync(path.join(this.baseDir, 'research.md'), researchResult);
          this.log("Deep Research completed.");
          
          if (this.state.spreadsheetId) {
            await googleService.appendRow(this.state.spreadsheetId, 'A:B', ['Research', 'Completed']);
          }
          break;
        } else if (status.status === "failed") {
          this.log(`Research failed: ${status.error}`);
          throw new Error(`Research failed: ${status.error}`);
        }
        
        this.log(`Research in progress (status: ${status.status})...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    } catch (error) {
      this.log(`Error in Research Phase: ${error}`);
      // Fallback to a standard generation if interactions are not available or fail
      this.log("Falling back to standard research generation...");
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Research the following topic in depth: ${this.state.topic}. Provide a detailed report.`
      });
      this.state.research = response.text || '';
      fs.writeFileSync(path.join(this.baseDir, 'research.md'), this.state.research);
    }
  }

  async runOutlinePhase() {
    this.state.status = 'outlining';
    this.log(`Starting Outline Phase for: ${this.state.title}`);

    // Create Google Sheet if connected
    if (googleService.isConnected() && !this.state.spreadsheetId) {
      try {
        this.state.spreadsheetId = await googleService.createSheet(`Production: ${this.state.title}`);
        this.log(`Created Google Sheet: ${this.state.spreadsheetId}`);
        await googleService.updateSheet(this.state.spreadsheetId, 'A1:B1', [['Phase', 'Status']]);
        await googleService.appendRow(this.state.spreadsheetId, 'A:B', ['Outline', 'In Progress']);
      } catch (e) {
        this.log("Failed to create Google Sheet, continuing without it.");
      }
    }

    const prompt = PromptTemplate.fromTemplate(`
      You are an expert KDP Formatting Specialist and Senior Book Architect. 
      Goal: Create a comprehensive book outline and style guide for a book titled "{title}" about "{topic}".
      
      Style: Write in the style of [Brett Sjoberg] and Fair Dinkum Books.
      
      KDP Compliance Rules (2026):
      - Use standard Word/Google Docs Styles (Heading 1 for chapters, Normal for body).
      - Do not use manual tabs, multiple line breaks, or complex columns.
      - Every chapter must begin with a clear Heading 1 tag.
      - Accessibility: Ensure all image placeholders include descriptive Alt-Text prompts.
      
      1. Define the Target Audience and Tone.
      2. Create a 'Style Guide' (voice, vocabulary, formatting rules).
      3. Use the following Research Data to inform the book structure:
      {research}
      
      4. Create a Chapter-by-Chapter outline. 
         Format each chapter as: "Chapter X: [Title] - [3-sentence summary]"
      
      Output the result in Markdown.
    `);

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const result = await chain.invoke({ 
      title: this.state.title, 
      topic: this.state.topic,
      research: this.state.research
    });
    
    this.state.outline = result;
    fs.writeFileSync(path.join(this.baseDir, 'outline.md'), result);
    this.log("Outline generated and saved.");

    if (this.state.spreadsheetId) {
      await googleService.updateSheet(this.state.spreadsheetId, 'B2', [['Completed']]);
      await googleService.appendRow(this.state.spreadsheetId, 'A:B', ['Chapters', 'Initializing']);
    }
    
    // Parse chapters (simple regex)
    const chapterMatches = result.match(/Chapter \d+: .+/g) || [];
    this.state.totalChapters = chapterMatches.length || 5;
    return result;
  }

  async runChapterPhase(chapterIndex: number, chapterTitle: string, previousContext: string) {
    this.state.status = 'writing';
    this.state.currentChapter = chapterIndex + 1;
    this.log(`Writing Chapter ${this.state.currentChapter}: ${chapterTitle}`);

    // Writing
    const writePrompt = PromptTemplate.fromTemplate(`
      You are a Lead Author specializing in KDP Reflowable standards.
      Goal: Write the full content for "{chapterTitle}".
      
      KDP Formatting Rules:
      - Start with a 'Heading 1' title.
      - Use standard paragraphing (no double-spacing between paragraphs).
      - Use bulleted lists (<ul>) for key takeaways.
      - If an image is needed, insert a placeholder: [IMAGE: 300DPI, Alt-Text: 'Description'].
      - Do not include headers, footers, or page numbers.
      
      Constraints:
      - Minimum 2000 words.
      - Follow the Style Guide: {outline}
      - Do not summarize; write full prose.
      - Context of previous chapters: {context}
      
      Write in Markdown.
    `);

    const writeChain = writePrompt.pipe(this.llm).pipe(new StringOutputParser());
    const draft = await writeChain.invoke({ 
      chapterTitle, 
      outline: this.state.outline, 
      context: previousContext 
    });

    this.state.status = 'editing';
    this.log(`Editing Chapter ${this.state.currentChapter}...`);

    // Editing
    const editPrompt = PromptTemplate.fromTemplate(`
      You are a Senior Copy Editor.
      Goal: Polish the following text for flow, grammar, and continuity.
      
      Text:
      {draft}
      
      Output only the final polished Markdown content.
    `);

    const editChain = editPrompt.pipe(this.llm).pipe(new StringOutputParser());
    const polished = await editChain.invoke({ draft });

    const chapterData = { title: chapterTitle, content: polished };
    this.state.chapters.push(chapterData);
    
    if (this.state.spreadsheetId) {
      await googleService.appendRow(this.state.spreadsheetId, 'A:C', [
        `Chapter ${this.state.currentChapter}`, 
        'Completed', 
        `${polished.split(/\s+/).length} words`
      ]);
    }

    const filename = `chapter_${String(this.state.currentChapter).padStart(2, '0')}.md`;
    fs.writeFileSync(path.join(this.baseDir, 'chapters', filename), polished);
    
    this.log(`Chapter ${this.state.currentChapter} completed.`);
    return polished;
  }

  async runCompilationPhase() {
    this.state.status = 'compiling';
    this.log("Compiling manuscript...");

    let fullManuscript = `# ${this.state.title}\n\n`;
    this.state.chapters.forEach(ch => {
      fullManuscript += `## ${ch.title}\n\n${ch.content}\n\n---\n\n`;
    });

    fs.writeFileSync(path.join(this.baseDir, 'output', 'manuscript.md'), fullManuscript);
    this.state.status = 'completed';
    this.log("Book production completed successfully!");
  }
}

export const createWorkforce = (topic: string, title: string, isAiGenerated: boolean = true) => new BookProductionWorkforce(topic, title, isAiGenerated);
