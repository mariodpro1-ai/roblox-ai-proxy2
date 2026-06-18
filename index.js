const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const crypto = require("crypto");
const app = express();

app.use(cors());
app.use(express.json());

// Escudo anti-crash por si la llave de OpenAI tarda en cargar
let openai;
try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "llave_falsa" });
} catch (error) {
    console.error("Error iniciando OpenAI:", error);
}

const memoriaJugadores = new Map();

// 🛡️ Tu Middleware de seguridad clásico
const verificarSeguridadRoblox = (req, res, next) => {
    const tokenRecibido = req.headers['x-roblox-auth'];
    // Toma la contraseña de las variables de entorno, o usa tu AKI_ por defecto
    const tokenCorrecto = process.env.ROBLOX_SECRET_TOKEN || "AKI_7FvQm92XkLpR5tNzWc4HdJ8sByE1gUaM6rTf3YqX9oCiKpV2nL8wZj";
    const universeIdRecibido = req.headers['roblox-universe-id'];
    const juegoGlobalAutorizado = "10109347231";

    if (!tokenRecibido || tokenRecibido !== tokenCorrecto) {
        return res.status(401).json({ reply: "Error de red.||No autorizado." });
    }
    if (!universeIdRecibido || universeIdRecibido !== juegoGlobalAutorizado) {
        return res.status(403).json({ reply: "Error de red.||Juego no autorizado." });
    }
    next();
};

app.post("/chat", verificarSeguridadRoblox, async (req, res) => {
    // Extraemos 'mensaje' (nuevo script) o 'message' (viejo script) para ser 100% compatibles
    const { message, mensaje, systemPrompt, userId, npcId, nombre } = req.body;
    const textoDelJugador = mensaje || message || "";

    const identifier = npcId || crypto.createHash('md5').update(systemPrompt || "").digest('hex').substring(0, 8);
    const sessionId = `${userId}_${identifier}`;

    // Tu estructura de memoria clásica
    if (!memoriaJugadores.has(sessionId)) {
        memoriaJugadores.set(sessionId, { historial: [], perfil: { nombre: nombre || "Jugador", comida: "", color: "" } });
    }
    const sesion = memoriaJugadores.get(sessionId);

    // 🚨 FUSIÓN: Le inyectamos la regla de las Físicas a tu Prompt
    const PROMPT_DINAMICO = `${systemPrompt} Recuerda esto del jugador: ${JSON.stringify(sesion.perfil)}

🚨 REGLA DE FORMATO INQUEBRANTABLE (SUBTÍTULOS RÁPIDOS) 🚨
Tu respuesta debe mostrarse como subtítulos cortos de TikTok para un motor de físicas en 3D. 
- DEBES usar el separador "||" constantemente en tus respuestas.
- ESTÁ ESTRICTAMENTE PROHIBIDO poner más de 6 palabras juntas sin el separador "||".
- Cero asteriscos (*), no describas acciones físicas, habla solo con diálogos directos.

EJEMPLO OBLIGATORIO:
"Hola, ${nombre || "amigo"}.||¿Qué estás haciendo aquí?||Me alegra verte.||Espero que tengas tiempo."`;

    sesion.historial.push({ role: "user", content: textoDelJugador });
    if (sesion.historial.length > 8) sesion.historial.shift();

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: PROMPT_DINAMICO },
                ...sesion.historial
            ],
            max_tokens: 100,
            temperature: 0.6 // Temperatura baja para obligar a la IA a usar los ||
        });

        const respuestaIA = completion.choices[0].message.content;

        sesion.historial.push({ role: "assistant", content: respuestaIA });
        if (sesion.historial.length > 8) sesion.historial.shift();

        // Enviamos 'reply' (tu formato) y 'respuesta' por si acaso
        res.json({ reply: respuestaIA, respuesta: respuestaIA, emocion: npcId === "Gojo" ? "OBSESIVO" : "NORMAL" });
        
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ reply: "¡Rayos!||Algo falló en la conexión.||¿Qué decías?" });
    }
});

// Cambiado a 10000 para que Render no falle al encender
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor clásico fusionado con físicas corriendo en puerto ${PORT}`);
});
