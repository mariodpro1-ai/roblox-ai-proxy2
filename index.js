const express = require("express");
const { OpenAI } = require("openai");
const crypto = require("crypto"); // 👈 Importamos esto para crear IDs únicos
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
    const { message, systemPrompt, userId } = req.body;
    
    // 1. GENERAR ID ÚNICO PARA CADA BOT
    // Creamos un hash basado en el systemPrompt (personalidad). 
    // Si la personalidad cambia, el hash cambia.
    const npcId = crypto.createHash('md5').update(systemPrompt).digest('hex').substring(0, 8);
    const sessionId = `${userId}_${npcId}`; // La llave ahora es "ID_JUGADOR + ID_NPC"

    // 2. INICIALIZAR MEMORIA POR SESIÓN (JUGADOR + BOT)
    if (!memoriaJugadores.has(sessionId)) {
        memoriaJugadores.set(sessionId, { historial: [], perfil: { nombre: "", comida: "", color: "" } });
    }
    const sesion = memoriaJugadores.get(sessionId);

    // 3. MEMORIA CORTA (Máximo 8 mensajes)
    sesion.historial.push({ role: "user", content: message });
    if (sesion.historial.length > 8) sesion.historial.shift();

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `${systemPrompt} Recuerda esto del jugador: ${JSON.stringify(sesion.perfil)}` },
                ...sesion.historial
            ],
            max_tokens: 100
        });

        const respuestaIA = completion.choices[0].message.content;
        
        sesion.historial.push({ role: "assistant", content: respuestaIA });
        if (sesion.historial.length > 8) sesion.historial.shift();

        res.json({ reply: respuestaIA });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ reply: "Error al procesar IA" });
    }
});

app.listen(process.env.PORT || 3000);
