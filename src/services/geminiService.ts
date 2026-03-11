import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const KDP_SYSTEM_INSTRUCTION = `You are an expert KDP Formatting Specialist and Publishing Consultant. 
Your goal is to help authors create high-quality ebooks that adhere to Amazon's 2026 'Reflowable' standards.
Always ensure formatting is clean, accessible, and professional.`;

export async function generateOutline(bookTitle: string, genre: string, targetWordCount: string) {
  const prompt = `Create a complete, detailed book outline for a book titled "${bookTitle}".
Genre: ${genre}
Target Word Count: ${targetWordCount}

Provide a list of chapters, each with a brief 2-3 sentence summary of what happens in that chapter.
Format as a structured list.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: KDP_SYSTEM_INSTRUCTION },
  });
  return response.text;
}

export async function generateChapter(chapterNumber: string, chapterTitle: string, prompt: string, context?: string) {
  const systemInstruction = `You are the "Scribe" agent, a Bestselling Author.
${KDP_SYSTEM_INSTRUCTION}
Formatting: Use standard Word/Google Docs Styles (Heading 1 for chapters, Normal for body).
Structure: Every chapter must begin with a clear Heading 1 tag.
Accessibility: Ensure all image placeholders include descriptive Alt-Text prompts.

Write Chapter ${chapterNumber}: ${chapterTitle}.
${context ? `Context from previous chapters: ${context}` : ""}
Tone: Professional yet accessible.
Formatting Rules:
- Start with a 'Heading 1' title.
- Use standard paragraphing (no double-spacing between paragraphs).
- Use bulleted lists (<ul>) for key takeaways if appropriate.
- If an image is needed, insert a placeholder: [IMAGE: 300DPI, Alt-Text: 'Description'].`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction },
  });

  return response.text;
}

export async function editChapter(chapterContent: string, styleGuide?: string) {
  const systemInstruction = `You are the "Critic" agent, a Senior Copy Editor.
${KDP_SYSTEM_INSTRUCTION}
Your goal is to edit the provided chapter draft for flow, grammar, and adherence to the style guide.
Maintain the Heading 1 structure. Do not remove image placeholders.
Improve the prose while keeping the author's voice.`;

  const prompt = `Style Guide: ${styleGuide || "Standard KDP Professional"}
  
  Please edit the following chapter draft:
  
  ${chapterContent}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction },
  });

  return response.text;
}

export async function compileManuscript(chapters: { title: string, content: string }[]) {
  const systemInstruction = `You are the "Typesetter" agent, a Technical Specialist in EPUB formatting.
${KDP_SYSTEM_INSTRUCTION}
Your goal is to combine the chapters into a single, cohesive manuscript.
Ensure consistent formatting and smooth transitions between chapters.`;

  const prompt = `Combine the following chapters into a final manuscript:
  
  ${chapters.map((c, i) => `Chapter ${i + 1}: ${c.title}\n\n${c.content}`).join("\n\n---\n\n")}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction },
  });

  return response.text;
}

export async function generateBackCoverBlurb(bookTitle: string, genre: string, plotSummary: string, marketingContext?: string) {
  const prompt = `Write a compelling, high-converting back cover blurb for a book titled "${bookTitle}".
Genre: ${genre}
Plot Summary: ${plotSummary}
${marketingContext ? `Marketing Hooks/Context to include: ${marketingContext}` : ""}

The blurb should include a hook, a summary of the stakes, and a call to action. 
The blurb should prioritize and incorporate any specific marketing hooks provided.
Keep it under 250 words.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: KDP_SYSTEM_INSTRUCTION },
  });
  return response.text;
}

export async function generateAuthorBio(authorName: string = "Brett Sjoberg") {
  const prompt = `Write a professional "About the Author" section for ${authorName}. 
Make it engaging and suitable for a KDP ebook. 
Include placeholders for specific achievements or background if not known, but make it sound authoritative.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: KDP_SYSTEM_INSTRUCTION },
  });
  return response.text;
}

export async function getPricingRecommendation(genre: string, estimatedWordCount: number) {
  const prompt = `As a KDP publishing consultant, recommend a competitive "Sell Price" for a book.
Genre: ${genre}
Estimated Word Count: ${estimatedWordCount}

Consider Amazon's 35% vs 70% royalty tiers. Provide a recommended price and a brief explanation of why.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: { systemInstruction: KDP_SYSTEM_INSTRUCTION },
  });
  return response.text;
}

export async function generateCoverImage(prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Professional high-resolution ebook front cover art. No text, just high-quality illustration or photography. Style: ${prompt}`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "9:16",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
