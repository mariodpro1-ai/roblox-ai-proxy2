const express = require("express");
const { OpenAI } = require("openai");
const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: req.body.systemPrompt },
        { role: "user", content: req.body.message }
      ],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ reply: "Error" });
  }
});

app.listen(process.env.PORT || 3000);
