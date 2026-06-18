const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memoriaJugadores = new Map();

const LLAVE_ROBLOX = "key_prod_a8F3kLm92XqP7vNzR5tYwU1BcDhE6GsK4Mj";
const UNIVERSE_ID = "10109347231";

app.post('/chat', async (req, res) => {
    try {
        const llaveRecibida = req.headers['x-api-key'];
        const universeRecibido = req.headers['x-universe-id'];
        
        if (llaveRecibida !== LLAVE_ROBLOX) return res.status(401).json({ error: "Llave inválida." });
        if (universeRecibido !== UNIVERSE_ID) return res.status(403).json({ error: "Universo incorrecto." });

        // 1. Extraemos los datos enviados desde el Cerebro Avanzado de Roblox
        const { mensaje, systemPrompt, userId, npcId, nombre } = req.body;

        // 2. Creamos una memoria aislada para este Jugador + Este NPC específico
        const sessionId = `${userId}_${npcId}`;
        if (!memoriaJugadores.has(sessionId)) {
            memoriaJugadores.set(sessionId, []);
        }
        const historial = memoriaJugadores.get(sessionId);

        // 3. FUSIÓN: Usamos la personalidad del NPC, pero OBLIGAMOS el formato de Físicas (||)
        const PROMPT_DINAMICO = `${systemPrompt} Estás hablando con el jugador ${nombre}.

🚨 REGLA DE FORMATO INQUEBRANTABLE (SUBTÍTULOS RÁPIDOS) 🚨
Tu respuesta debe mostrarse como subtítulos cortos de TikTok para un motor de físicas en 3D. 
- DEBES usar el separador "||" constantemente en tus respuestas.
- ESTÁ ESTRICTAMENTE PROHIBIDO poner más de 6 palabras juntas sin el separador "||".
- Cero asteriscos (*), no describas acciones físicas, habla solo con diálogos directos.

EJEMPLO OBLIGATORIO:
"Hola, ${nombre}.||¿Qué estás haciendo aquí?||Me alegra verte.||Espero que tengas tiempo."`;

        // 4. Construimos la conversación
        const mensajesParaOpenAI = [
            { role: "system", content: PROMPT_DINAMICO },
            ...historial,
            { role: "user", content: mensaje }
        ];

        // 5. Llamada a OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: mensajesParaOpenAI,
            max_tokens: 100,
            temperature: 0.6 // Temperatura baja para que respete los "||"
        });

        const respuestaIA = completion.choices[0].message.content;

        // 6. Guardamos en memoria
        historial.push({ role: "user", content: mensaje });
        historial.push({ role: "assistant", content: respuestaIA });
        if (historial.length > 8) {
            historial.shift();
            historial.shift();
        }

        res.json({ respuesta: respuestaIA, emocion: "NORMAL" }); 

    } catch (error) {
        console.error("Error con OpenAI:", error);
        res.status(500).json({ respuesta: "¡Rayos!||Algo falló en mi cabeza.||¿Puedes repetirlo?", emocion: "TRISTE" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor FUSIONADO corriendo en puerto ${PORT}`));
