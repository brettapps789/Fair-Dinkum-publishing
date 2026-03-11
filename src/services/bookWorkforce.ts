import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs";
import path from "path";

export interface BookState {
  topic: string;
  title: string;
  status: 'idle' | 'outlining' | 'writing' | 'editing' | 'compiling' | 'completed' | 'error';
  currentChapter: number;
  totalChapters: number;
  logs: string[];
  outline: string;
  chapters: { title: string; content: string }[];
}

class BookProductionWorkforce {
  private llm: ChatOpenAI;
  private state: BookState;
  private baseDir: string;

  constructor(topic: string, title: string) {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    this.state = {
      topic,
      title,
      status: 'idle',
      currentChapter: 0,
      totalChapters: 0,
      logs: [],
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

  async runOutlinePhase() {
    this.state.status = 'outlining';
    this.log(`Starting Outline Phase for: ${this.state.title}`);

    const prompt = PromptTemplate.fromTemplate(`
      You are a Senior Book Architect. 
      Goal: Create a comprehensive book outline and style guide for a book titled "{title}" about "{topic}".
      
      Style: Write in the style of [Brett Sjoberg] and Fair Dinkum Books.
      
      1. Define the Target Audience and Tone.
      2. Create a 'Style Guide' (voice, vocabulary, formatting rules).
      3. Create a Chapter-by-Chapter outline. 
         Format each chapter as: "Chapter X: [Title] - [3-sentence summary]"
      
      Output the result in Markdown.
    `);

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const result = await chain.invoke({ title: this.state.title, topic: this.state.topic });
    
    this.state.outline = result;
    fs.writeFileSync(path.join(this.baseDir, 'outline.md'), result);
    this.log("Outline generated and saved.");
    
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
      You are a Lead Author.
      Goal: Write the full content for "{chapterTitle}".
      
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

export const createWorkforce = (topic: string, title: string) => new BookProductionWorkforce(topic, title);
