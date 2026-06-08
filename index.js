const express = require("express");
const { OpenAI } = require("openai");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memoriaJugadores = new Map();

const verificarSeguridadRoblox = (req, res, next) => {
    const tokenRecibido = req.headers['x-roblox-auth'];
    const tokenCorrecto = process.env.ROBLOX_SECRET_TOKEN;
    const universeIdRecibido = req.headers['roblox-universe-id'];
    const juegoGlobalAutorizado = "10109347231";

    if (!tokenRecibido || tokenRecibido !== tokenCorrecto) return res.status(401).json({ reply: "Error: No autorizado" });
    if (!universeIdRecibido || universeIdRecibido !== juegoGlobalAutorizado) return res.status(403).json({ reply: "Error: Juego no autorizado" });
    next();
};

app.post("/chat", verificarSeguridadRoblox, async (req, res) => {
    const { message, systemPrompt, userId, npcId } = req.body;

    const identifier = npcId || crypto.createHash('md5').update(systemPrompt).digest('hex').substring(0, 8);
    const sessionId = `${userId}_${identifier}`;

    if (!memoriaJugadores.has(sessionId)) {
        memoriaJugadores.set(sessionId, { historial: [], perfil: { nombre: "", comida: "", color: "" } });
    }
    const sesion = memoriaJugadores.get(sessionId);

    sesion.historial.push({ role: "user", content: message });
    if (sesion.historial.length > 8) sesion.historial.shift();

    try {
        // --- INICIO DE SEGURIDAD AÑADIDA ---
        const safetyInstruction = " REGLA ORO: No generes contenido sexual, violento, racista, acoso, ni información personal. Mantente siempre dentro de las normas de seguridad de Roblox. Si el usuario pide algo inapropiado, recházalo educadamente.";
        // --- FIN DE SEGURIDAD AÑADIDA ---

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `${systemPrompt} ${safetyInstruction} Recuerda esto del jugador: ${JSON.stringify(sesion.perfil)}` },
                ...sesion.historial
            ],
            max_tokens: 100
        });

        const respuestaIA = completion.choices[0].message.content;

        // --- INICIO DE MODERACIÓN AÑADIDA ---
        const moderacion = await openai.moderations.create({ input: respuestaIA });
        if (moderacion.results[0].flagged) {
            return res.json({ reply: "No puedo responder a eso, lo siento." });
        }
        // --- FIN DE MODERACIÓN AÑADIDA ---

        sesion.historial.push({ role: "assistant", content: respuestaIA });
        if (sesion.historial.length > 8) sesion.historial.shift();

        res.json({ reply: respuestaIA });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ reply: "¡Rayos! Algo falló en la conexión." });
    }
});

app.listen(process.env.PORT || 3000);
