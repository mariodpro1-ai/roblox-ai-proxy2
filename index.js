const express = require("express");
const { OpenAI } = require("openai");
const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memoriaJugadores = new Map(); // Aquí vivirá la memoria

// 🛡️ ESCUDO DE SEGURIDAD (Se mantiene igual)
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
    
    // Inicializar memoria si es nuevo
    if (!memoriaJugadores.has(userId)) {
        memoriaJugadores.set(userId, { historial: [], perfil: { nombre: "", comida: "", color: "" } });
    }
    const sesion = memoriaJugadores.get(userId);

    // 1. Memoria corta: Agregar mensaje y mantener máximo 8 (4 usuario + 4 IA)
    sesion.historial.push({ role: "user", content: message });
    
    // 2. Memoria ligera: Intentar detectar datos básicos
    const detectarDatos = `Analiza si en este mensaje el usuario dice su nombre, comida favorita o color favorito. Responde solo con JSON: {"nombre": "...", "comida": "...", "color": "..."} o usa "desconocido". Mensaje: "${message}"`;
    // (Nota: Esto es una simplificación, en producción se suele usar una llamada dedicada o un proceso asíncrono)

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `${systemPrompt} Recuerda esto del jugador: ${JSON.stringify(sesion.perfil)}` },
                ...sesion.historial.slice(-8)
            ],
            max_tokens: 100 // 👈 Límite estricto de gasto
        });

        const respuestaIA = completion.choices[0].message.content;
        
        // Guardar respuesta en historial
        sesion.historial.push({ role: "assistant", content: respuestaIA });
        if (sesion.historial.length > 8) sesion.historial.shift();

        res.json({ reply: respuestaIA });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ reply: "Error al procesar IA" });
    }
});

app.listen(process.env.PORT || 3000);
