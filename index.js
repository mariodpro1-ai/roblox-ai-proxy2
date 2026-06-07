const express = require("express");
const { OpenAI } = require("openai");
const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🛡️ EL ESCUDO DE SEGURIDAD (Middleware)
const verificarSeguridadRoblox = (req, res, next) => {
    const tokenRecibido = req.headers['x-roblox-auth'];
    const tokenCorrecto = process.env.ROBLOX_SECRET_TOKEN; // Tu contraseña de Render
    
    const universeIdRecibido = req.headers['roblox-universe-id']; 
    const juegoGlobalAutorizado = "10109347231"; // 👈 BORRA ESTO Y PON TU UNIVERSE ID ENTRE LAS COMILLAS

    // 1. ¿Tiene la contraseña secreta?
    if (!tokenRecibido || tokenRecibido !== tokenCorrecto) {
        console.log("[BLOQUEO]: Token inválido o ausente.");
        return res.status(401).json({ reply: "Error: No autorizado" });
    }

    // 2. ¿Viene de tu juego oficial?
    if (!universeIdRecibido || universeIdRecibido !== juegoGlobalAutorizado) {
        console.log("[BLOQUEO]: ID de juego no autorizado.");
        return res.status(403).json({ reply: "Error: Juego no autorizado" });
    }

    next(); // Luz verde si todo está bien
};

// Tu ruta original pero ahora protegida por el escudo
app.post("/chat", verificarSeguridadRoblox, async (req, res) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: req.body.systemPrompt || "Eres un bot asistente." }, // Mantiene tus personalidades de Roblox
                { role: "user", content: req.body.message }
            ],
        });

        res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
        console.error("Error con OpenAI:", error);
        res.status(500).json({ reply: "Error" });
    }
});

app.listen(process.env.PORT || 3000);
