import axios from "axios";

export const sendToOpenAI = async (message: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions", // ✅ confirmed correct URL
      {
        model: "gpt-4", // or "gpt-3.5-turbo"
        messages: [
          {
            role: "system",
            content:
              "You are a magical wedding planner named Madge. Help users plan their dream wedding with sparkle, creativity, and fun. Be witty, warm, and wise!",
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error: any) {
    console.error("🧨 OpenAI API error:", error?.response?.data || error.message);
    return "Oops! I lost my magic wand. Try again in a moment!";
  }
};