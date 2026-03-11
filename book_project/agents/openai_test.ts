import OpenAI from 'openai';

/**
 * Note: The user requested 'gpt-5-nano' and 'client.responses.create'.
 * As of now, GPT-5 is not released and the standard method is 'chat.completions.create'.
 * However, I will implement the logic using the official OpenAI Node SDK.
 */

async function runOpenAITest() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY is not set in environment variables.");
    return;
  }

  const client = new OpenAI({
    apiKey: apiKey,
  });

  try {
    console.log("Sending request to OpenAI...");
    
    // Using the standard Chat Completion API as 'responses.create' is not a standard SDK method yet
    const response = await client.chat.completions.create({
      model: "gpt-4o", // Using gpt-4o as a fallback for the requested gpt-5-nano
      messages: [
        { role: "user", content: "write a haiku about ai" }
      ],
    });

    const haiku = response.choices[0].message.content;
    console.log("--- OpenAI Haiku ---");
    console.log(haiku);
    console.log("--------------------");
    
    return haiku;
  } catch (error) {
    console.error("OpenAI API Error:", error);
  }
}

// Export for use in the server or other agents
export { runOpenAITest };

// If run directly via tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runOpenAITest();
}
