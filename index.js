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

// Nuestra memoria RAM segura
const memoriaJugadores = new Map();
const TIEMPO_EXPIRACION = 10 * 60 * 1000; // 10 minutos en milisegundos

// 🛡️ Tu Middleware de seguridad clásico
const verificarSeguridadRoblox = (req, res, next) => {
    const tokenRecibido = req.headers['x-roblox-auth'];
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

// 🧠 FUNCIÓN EXCLUSIVA: Extrae datos importantes para la memoria a largo plazo
async function actualizarPerfilJugador(textoJugador, perfilActual) {
    try {
        const respuesta = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu único trabajo es leer el mensaje del usuario y actualizar el perfil JSON del jugador si descubres nueva información relevante. Retorna ESTRICTAMENTE el JSON actualizado.
                    Perfil Actual: ${JSON.stringify(perfilActual)}` 
                },
                { role: "user", content: textoJugador }
            ],
            max_tokens: 60,
            temperature: 0.1
        });
        return JSON.parse(respuesta.choices[0].message.content);
    } catch (e) {
        return perfilActual;
    }
}

app.post("/chat", verificarSeguridadRoblox, async (req, res) => {
    const { message, mensaje, systemPrompt, userId, npcId, nombre } = req.body;
    const textoDelJugador = mensaje || message || "";

    const identifier = npcId || crypto.createHash('md5').update(systemPrompt || "").digest('hex').substring(0, 8);
    const sessionId = `${userId}_${identifier}`;

    // Si el jugador no existe o su memoria fue borrada por inactividad, lo recreamos
    if (!memoriaJugadores.has(sessionId)) {
        memoriaJugadores.set(sessionId, { 
            historial: [], 
            perfil: { 
                nombre: nombre || "Jugador",
                datosRecordados: "Ninguno todavía.",
                estadoRelacion: "Neutral"
            },
            temporizador: null // Guardaremos el reloj aquí
        });
        console.log(`[RAM] 🟢 Creada nueva memoria para la sesión: ${sessionId}`);
    }
    
    const sesion = memoriaJugadores.get(sessionId);

    // 🛡️ REINICIAR EL TEMPORIZADOR DE LIMPIEZA (La clave para cuidar la RAM)
    if (sesion.temporizador) {
        clearTimeout(sesion.temporizador); // Cancela el borrado anterior porque el jugador sigue hablando
    }
    
    // Programamos un nuevo borrado para dentro de 10 minutos
    sesion.temporizador = setTimeout(() => {
        memoriaJugadores.delete(sessionId);
        console.log(`[RAM] 🧹 Memoria borrada por inactividad de 10 min: ${sessionId}`);
    }, TIEMPO_EXPIRACION);

    // 🧠 Paso 1: Analizar el mensaje en segundo plano para extraer recuerdos
    if (textoDelJugador.length > 2) {
        sesion.perfil = await actualizarPerfilJugador(textoDelJugador, sesion.perfil);
    }

    // 🧠 Paso 2: Inyectar los datos memorizados de forma indestructible en el prompt
    const PROMPT_DINAMICO = `${systemPrompt}
    
🧠 MEMORIA A LARGO PLAZO DEL JUGADOR:
- Nombre del usuario: ${sesion.perfil.nombre}
- Hechos memorizados: ${sesion.perfil.datosRecordados}
- Estado de la relación: ${sesion.perfil.estadoRelacion}

🚨 REGLA DE FORMATO INQUEBRANTABLE (SUBTÍTULOS RÁPIDOS) 🚨
Tu respuesta debe mostrarse como subtítulos cortos de TikTok para un motor de físicas en 3D. 
- DEBES usar el separador "||" constantemente en tus respuestas.
- ESTÁ ESTRICTAMENTE PROHIBIDO poner más de 6 palabras juntas sin el separador "||".
- Cero asteriscos (*), habla solo con diálogos directos.`;

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
            temperature: 0.7
        });

        const respuestaIA = completion.choices[0].message.content;

        sesion.historial.push({ role: "assistant", content: respuestaIA });
        if (sesion.historial.length > 8) sesion.historial.shift();

        // Selector dinámico de emociones básico basado en el texto
        let emocionFinal = "NORMAL";
        if (npcId === "Gojo" && (respuestaIA.includes("😏") || respuestaIA.includes("🥱"))) {
            emocionFinal = "OBSESIVO";
        }

        res.json({ reply: respuestaIA, respuesta: respuestaIA, emocion: emocionFinal });
        
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ reply: "¡Rayos!||Algo falló en la conexión.||¿Qué decías?" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor con Auto-Limpieza de RAM corriendo en puerto ${PORT}`);
});
