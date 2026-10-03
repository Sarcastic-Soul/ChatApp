import type { Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { magicReplySchema } from "../validation/schemas.ts";

// Groq's free tier allows 8K tokens a minute on this model, and one draft
// uses a few hundred, so the limit is not a problem at this app's scale.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const generateMagicReply = async (req: ValidatedRequest<typeof magicReplySchema>, res: Response) => {
    try {
        const { messages, requestedTone } = req.body;

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: "Groq API key is missing." });
        }
        // magicReplySchema keeps only the last 10 messages, 500 characters
        // each, so a single draft stays well under the token limit
        const conversationContext = messages
            .map((msg) => `${msg.sender}: ${msg.text}`)
            .join("\n");

        const toneRule =
            requestedTone !== "Auto"
                ? `Use this tone: ${requestedTone}. Follow it strictly.`
                : "Match the tone, formality and style of the conversation.";

        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You help a user write their next message in a chat app. The user is "Me". Write only the next message "Me" should send: short, natural and fitting the conversation. Return the exact text to send, with no quotes, labels or extra commentary. ${toneRule}`,
                    },
                    { role: "user", content: conversationContext },
                ],
                reasoning_effort: "low",
                include_reasoning: false,
                max_completion_tokens: 512,
                temperature: 0.7,
            }),
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            const detail = await response.text();
            console.error("Groq error:", response.status, detail);
            if (response.status === 429) {
                return res
                    .status(429)
                    .json({ error: "Too many AI requests right now. Try again in a minute." });
            }
            return res.status(502).json({ error: "Failed to generate reply" });
        }

        const data = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        const replyText = (data.choices?.[0]?.message?.content || "")
            .trim()
            .replace(/^["']|["']$/g, "");

        if (!replyText) {
            return res.status(502).json({ error: "Failed to generate reply" });
        }

        res.json({ reply: replyText });
    } catch (error) {
        console.error("Error generating magic reply:", error);
        res.status(500).json({ error: "Failed to generate reply" });
    }
};
