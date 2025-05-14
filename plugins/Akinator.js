import { proto } from '@whiskeysockets/baileys';

// --- Base de Datos de Personajes (EJEMPLO PEQUEÑO) ---
// Las propiedades deben coincidir con las claves de las preguntas
const characters = [
    {
        name: "Superman",
        description: "El Hombre de Acero",
        properties: {
            is_fictional: 4, // Sí
            is_human: 0,     // No (es kryptoniano)
            has_superpowers: 4, // Sí
            from_movie: 4,   // Sí
            is_animated: 2,  // No sé (ha estado en animado y live-action)
            gender: 'male',
            is_real: 0,
             wears_cape: 4,
             from_dc: 4,
             from_marvel: 0
        }
    },
    {
        name: "Harry Potter",
        description: "El niño que vivió",
        properties: {
            is_fictional: 4,
            is_human: 4,
            has_superpowers: 3, // Tiene magia, no 'superpoderes' típicos
            from_movie: 4,
            is_animated: 0,
            gender: 'male',
            is_real: 0,
            wears_cape: 3, // A veces usa túnicas
             from_dc: 0,
             from_marvel: 0
        }
    },
    {
        name: "Pikachu",
        description: "Un Pokémon icónico",
        properties: {
            is_fictional: 4,
            is_human: 0,
            has_superpowers: 4, // Poderes eléctricos
            from_movie: 4,
            is_animated: 4,
            gender: 'male', // Generalmente presentado como masculino
            is_real: 0,
            wears_cape: 0,
             from_dc: 0,
             from_marvel: 0
        }
    },
     {
        name: "Albert Einstein",
        description: "Científico famoso",
        properties: {
            is_fictional: 0, // No
            is_human: 4,     // Sí
            has_superpowers: 0, // No
            from_movie: 2,   // Ha aparecido en películas, pero no *es* de una película
            is_animated: 0,
            gender: 'male',
            is_real: 4,
            wears_cape: 0,
             from_dc: 0,
             from_marvel: 0
        }
    },
    {
        name: "Spider-Man (Peter Parker)",
        description: "Tu amigable vecino arácnido",
        properties: {
            is_fictional: 4,
            is_human: 4,
            has_superpowers: 4,
            from_movie: 4,
            is_animated: 2, // Animado y live-action
            gender: 'male',
            is_real: 0,
            wears_cape: 0,
             from_dc: 0,
             from_marvel: 4
        }
    }
];

// --- Lista de Preguntas ---
// La clave (key) debe coincidir con las propiedades en los personajes
const questions = [
    { key: "is_fictional", text: "¿Tu personaje es ficticio?" },
    { key: "is_human", text: "¿Tu personaje es humano?" },
    { key: "has_superpowers", text: "¿Tu personaje tiene superpoderes?" },
    { key: "from_movie", text: "¿Tu personaje es conocido principalmente por películas?" },
    { key: "is_animated", text: "¿Tu personaje es animado o de dibujos animados?" },
    { key: "gender", text: "¿Tu personaje es masculino?" }, // Simplificado: ¿Es hombre?
    { key: "is_real", text: "¿Tu personaje es una persona real que existió/existe?"},
    { key: "wears_cape", text: "¿Tu personaje usa capa?"},
     { key: "from_dc", text: "¿Tu personaje es del universo DC?"},
      { key: "from_marvel", text: "¿Tu personaje es del universo Marvel?"}

    // Añade más preguntas aquí
];

// --- Gestión de Sesiones de Akinator ---
// Mapa para guardar el estado del juego por chat
const akinatorSessions = new Map();
// Estado del juego: { possibleCharacters: Character[], askedQuestions: string[], currentQuestionKey: string | null, totalQuestions: number }

// --- Lógica de Akinator ---

// Función para filtrar personajes basados en una respuesta
const filterCharacters = (currentPossible, questionKey, answerValue) => {
    return currentPossible.filter(char => {
        const charAnswer = char.properties[questionKey];

        // Lógica de filtrado simplificada (ajustar para mayor precisión)
        // Si el usuario dice SÍ (4), mantenemos personajes que son SÍ (4) o PROBABLEMENTE SÍ (3)
        if (answerValue === 4) return charAnswer === 4 || charAnswer === 3;
        // Si el usuario dice PROBABLEMENTE SÍ (3), mantenemos SÍ (4), PROBABLEMENTE SÍ (3) o NO SÉ (2)
        if (answerValue === 3) return charAnswer === 4 || charAnswer === 3 || charAnswer === 2;
        // Si el usuario dice NO SÉ (2), mantenemos a TODOS (este answer no elimina a nadie)
        if (answerValue === 2) return true;
        // Si el usuario dice PROBABLEMENTE NO (1), mantenemos NO (0), PROBABLEMENTE NO (1) o NO SÉ (2)
        if (answerValue === 1) return charAnswer === 0 || charAnswer === 1 || charAnswer === 2;
        // Si el usuario dice NO (0), mantenemos personajes que son NO (0) o PROBABLEMENTE NO (1)
        if (answerValue === 0) return charAnswer === 0 || charAnswer === 1;

        return false; // Si la respuesta es inválida, no filtra nada (debería ser validada antes)
    });
};

// Función para seleccionar la siguiente pregunta
const selectNextQuestion = (session) => {
    const remainingQuestions = questions.filter(q => !session.askedQuestions.includes(q.key));

    // Encuentra preguntas que aún ayuden a diferenciar a los posibles personajes
    const usefulQuestions = remainingQuestions.filter(q => {
        // Verifica si todos los personajes restantes tienen la misma respuesta a esta pregunta
        const firstCharAnswer = session.possibleCharacters.length > 0 ? session.possibleCharacters[0].properties[q.key] : undefined;
        return session.possibleCharacters.some(char => char.properties[q.key] !== firstCharAnswer);
    });

    if (usefulQuestions.length > 0) {
        // Podrías implementar una lógica para elegir la "mejor" pregunta (la que más divide al grupo),
        // pero por simplicidad, elegimos una útil al azar.
        const randomIndex = Math.floor(Math.random() * usefulQuestions.length);
        return usefulQuestions[randomIndex].key;
    }

    return null; // No quedan preguntas útiles
};

// --- Handler Principal ---
const akinatorHandler = async (m, { conn, command, args, usedPrefix }) => {
    const chat = m.chat;
    const commandArgs = args.map(arg => arg.toLowerCase()); // Convertir args a minúsculas para fácil comparación

    // Comandos/acciones válidas
    const validActions = ['start', 'answer', 'guess_response', 'stop'];
    const action = commandArgs[0];
    const actionArg = commandArgs[1]; // Ej: '4' para respuesta, 'yes'/'no' para guess_response

    let session = akinatorSessions.get(chat);

    // --- Manejar comando !akinator sin argumentos (iniciar o estado actual) ---
    if (!action) {
         if (session) {
             // Hay un juego en curso, informar al usuario
             await conn.reply(chat, `⚠️ Ya hay un juego de Akinator en curso en este chat. Responde la pregunta actual o usa *${usedPrefix}${command} stop* para terminarlo.`, m);
             // Opcional: Reenviar la pregunta actual
             const currentQ = questions.find(q => q.key === session.currentQuestionKey);
              if (currentQ) {
                const buttons = [
                    { buttonId: `${usedPrefix}${command} answer 4`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 3`, buttonText: { displayText: "👍 Probablemente Sí" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 2`, buttonText: { displayText: "🤷‍♀️ No sé" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 1`, buttonText: { displayText: "👎 Probablemente No" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 0`, buttonText: { displayText: "❌ No" }, type: 1 }
                ];
                await conn.sendMessage(chat, { text: `Pregunta actual (${session.totalQuestions + 1}): ${currentQ.text}`, buttons: buttons, viewOnce: true }, { quoted: m });
              }
         } else {
             // No hay juego, iniciar uno nuevo
             akinatorSessions.set(chat, {
                 possibleCharacters: [...characters], // Copia de la lista completa
                 askedQuestions: [],
                 currentQuestionKey: null,
                 totalQuestions: 0
             });
             session = akinatorSessions.get(chat);

             const firstQuestionKey = selectNextQuestion(session);
             if (!firstQuestionKey) {
                  await conn.reply(chat, "🤖 Ups, no tengo preguntas para empezar. ¡Algo salió mal!", m);
                  akinatorSessions.delete(chat); // Limpiar sesión fallida
                  return;
             }

             session.currentQuestionKey = firstQuestionKey;
             const firstQuestion = questions.find(q => q.key === firstQuestionKey);

              const caption = `
🎮 *¡Bienvenido a Akinator!* 🧠

Piensa en un personaje (real o ficticio). Intentaré adivinarlo haciéndote preguntas.

Responde usando los botones. Usa *${usedPrefix}${command} stop* para terminar.

*Pregunta 1:* ${firstQuestion.text}
`.trim();

            const buttons = [
                { buttonId: `${usedPrefix}${command} answer 4`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                { buttonId: `${usedPrefix}${command} answer 3`, buttonText: { displayText: "👍 Probablemente Sí" }, type: 1 },
                { buttonId: `${usedPrefix}${command} answer 2`, buttonText: { displayText: "🤷‍♀️ No sé" }, type: 1 },
                { buttonId: `${usedPrefix}${command} answer 1`, buttonText: { displayText: "👎 Probablemente No" }, type: 1 },
                { buttonId: `${usedPrefix}${command} answer 0`, buttonText: { displayText: "❌ No" }, type: 1 }
            ];

             await conn.sendMessage(chat, { text: caption, buttons: buttons, viewOnce: true }, { quoted: m });
         }
         return;
    }

    // --- Manejar otras acciones solo si hay una sesión activa ---
     if (!session && action !== 'start') {
         await conn.reply(chat, `⚠️ No hay un juego de Akinator en curso. Usa *${usedPrefix}${command}* para empezar.`, m);
         return;
     }


    switch (action) {
        case 'start':
            // Si ya hay sesión, preguntar si quiere reiniciar, si no, iniciar
             if (session) {
                  await conn.reply(chat, `⚠️ Ya hay un juego en curso. ¿Quieres empezar uno nuevo y perder el progreso actual?`, m, {
                      buttons: [
                          { buttonId: `${usedPrefix}${command} stop`, buttonText: { displayText: "✅ Sí, terminar juego actual" }, type: 1 },
                          { buttonId: `${usedPrefix}${command}`, buttonText: { displayText: "❌ No, continuar juego actual" }, type: 1 } // Volver a enviar estado actual
                      ],
                      viewOnce: true
                  });
             } else {
                 // Iniciar nuevo juego (lógica duplicada del caso !action, refactorizar si es necesario)
                 akinatorSessions.set(chat, {
                     possibleCharacters: [...characters],
                     askedQuestions: [],
                     currentQuestionKey: null,
                     totalQuestions: 0
                 });
                 session = akinatorSessions.get(chat);

                 const firstQuestionKey = selectNextQuestion(session);
                  if (!firstQuestionKey) {
                       await conn.reply(chat, "🤖 Ups, no tengo preguntas para empezar. ¡Algo salió mal!", m);
                       akinatorSessions.delete(chat);
                       return;
                  }

                 session.currentQuestionKey = firstQuestionKey;
                 const firstQuestion = questions.find(q => q.key === firstQuestionKey);

                  const caption = `
🎮 *¡Bienvenido a Akinator!* 🧠

Piensa en un personaje (real o ficticio). Intentaré adivinarlo haciéndote preguntas.

Responde usando los botones. Usa *${usedPrefix}${command} stop* para terminar.

*Pregunta 1:* ${firstQuestion.text}
`.trim();

                const buttons = [
                    { buttonId: `${usedPrefix}${command} answer 4`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 3`, buttonText: { displayText: "👍 Probablemente Sí" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 2`, buttonText: { displayText: "🤷‍♀️ No sé" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 1`, buttonText: { displayText: "👎 Probablemente No" }, type: 1 },
                    { buttonId: `${usedPrefix}${command} answer 0`, buttonText: { displayText: "❌ No" }, type: 1 }
                ];

                 await conn.sendMessage(chat, { text: caption, buttons: buttons, viewOnce: true }, { quoted: m });
             }
            break;

        case 'answer':
            if (!session || !session.currentQuestionKey) {
                await conn.reply(chat, `⚠️ No hay una pregunta activa. Usa *${usedPrefix}${command}* para empezar o reanudar el juego.`, m);
                return;
            }

            const answerValue = parseInt(actionArg, 10);
            if (isNaN(answerValue) || answerValue < 0 || answerValue > 4) {
                await conn.reply(chat, `❌ Respuesta inválida. Usa los botones para responder (Sí, No, etc.).`, m);
                return;
            }

            const currentQKey = session.currentQuestionKey;

            // 1. Filtrar personajes
            session.possibleCharacters = filterCharacters(session.possibleCharacters, currentQKey, answerValue);

            // 2. Marcar pregunta como respondida
            session.askedQuestions.push(currentQKey);
            session.totalQuestions++;
            session.currentQuestionKey = null; // Resetear currentQuestionKey

            // 3. Evaluar estado del juego
            if (session.possibleCharacters.length === 1) {
                // ¡Posiblemente adivinó!
                const guessedChar = session.possibleCharacters[0];
                 await conn.reply(chat, `🤔 ¿Tu personaje podría ser... *${guessedChar.name}* (${guessedChar.description})?`, m, {
                     buttons: [
                         { buttonId: `${usedPrefix}${command} guess_response yes`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                         { buttonId: `${usedPrefix}${command} guess_response no`, buttonText: { displayText: "❌ No" }, type: 1 }
                     ],
                     viewOnce: true
                 });
            } else if (session.possibleCharacters.length === 0) {
                // Personaje no encontrado
                 await conn.reply(chat, `😞 Vaya, parece que no tengo a tu personaje en mi base de datos o me equivoqué. ¡Me has ganado!`, m, {
                     buttons: [
                          { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                     ],
                      viewOnce: true
                 });
                 akinatorSessions.delete(chat); // Terminar sesión
            } else {
                // Continuar preguntando
                const nextQKey = selectNextQuestion(session);

                if (nextQKey && session.totalQuestions < 20) { // Límite de preguntas simple
                    session.currentQuestionKey = nextQKey;
                    const nextQuestion = questions.find(q => q.key === nextQKey);

                     const caption = `
*Pregunta ${session.totalQuestions + 1}:* ${nextQuestion.text}
`.trim();

                    const buttons = [
                        { buttonId: `${usedPrefix}${command} answer 4`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                        { buttonId: `${usedPrefix}${command} answer 3`, buttonText: { displayText: "👍 Probablemente Sí" }, type: 1 },
                        { buttonId: `${usedPrefix}${command} answer 2`, buttonText: { displayText: "🤷‍♀️ No sé" }, type: 1 },
                        { buttonId: `${usedPrefix}${command} answer 1`, buttonText: { displayText: "👎 Probablemente No" }, type: 1 },
                        { buttonId: `${usedPrefix}${command} answer 0`, buttonText: { displayText: "❌ No" }, type: 1 }
                    ];

                    await conn.sendMessage(chat, { text: caption, buttons: buttons, viewOnce: true }, { quoted: m });

                } else {
                    // No quedan preguntas útiles o alcanzó el límite
                     await conn.reply(chat, `😔 No me quedan preguntas que me ayuden. ¿Podría tu personaje ser alguno de estos?`, m);
                     const possibleList = session.possibleCharacters.map(char => `- ${char.name}`).join('\n');
                     await conn.reply(chat, possibleList || "No me queda ninguna opción.", m, {
                         buttons: [
                              { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                         ],
                          viewOnce: true
                     });
                     akinatorSessions.delete(chat); // Terminar sesión
                }
            }
             // No olvidar actualizar la sesión en el mapa después de modificarla
            akinatorSessions.set(chat, session);
            break;

        case 'guess_response':
            if (!session || session.possibleCharacters.length !== 1) {
                 // Esto no debería pasar si el flujo es correcto, pero por si acaso
                 await conn.reply(chat, `⚠️ Algo salió mal. No estamos en un estado de adivinanza. Usa *${usedPrefix}${command} stop* para terminar y *${usedPrefix}${command}* para empezar de nuevo.`, m);
                 return;
            }

            const guessedChar = session.possibleCharacters[0];
            const response = actionArg; // 'yes' o 'no'

            if (response === 'yes') {
                // ¡Ganó el bot!
                 await conn.reply(chat, `🥳 ¡Siiiii! ¡Lo sabía! Tu personaje era *${guessedChar.name}*.\n\n¡Gracias por jugar!`, m, {
                      buttons: [
                           { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                      ],
                       viewOnce: true
                 });
                 akinatorSessions.delete(chat); // Terminar sesión
            } else if (response === 'no') {
                // El bot se equivocó
                 await conn.reply(chat, `😭 ¡Rayos! Me equivoqué. ¡Me has ganado!`, m, {
                     buttons: [
                          { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                     ],
                      viewOnce: true
                 });
                 akinatorSessions.delete(chat); // Terminar sesión (en este ejemplo simple, si falla la única opción, pierde)

                // Lógica más avanzada: si hay más personajes posibles, preguntar más o dar otra oportunidad de adivinar.
                // Por ahora, si falla con la única opción, se considera que el usuario ganó.

            } else {
                 await conn.reply(chat, `❌ Respuesta inválida. Usa los botones Sí/No.`, m);
            }
            break;

         case 'stop':
              if (session) {
                   akinatorSessions.delete(chat);
                   await conn.reply(chat, `🚪 El juego de Akinator ha terminado. Usa *${usedPrefix}${command}* para empezar uno nuevo.`, m);
              } else {
                   await conn.reply(chat, `⚠️ No hay ningún juego de Akinator activo para detener.`, m);
              }
             break;

        default:
            // Comando no reconocido después del prefijo !akinator
             await conn.reply(chat, `❌ Acción no reconocida. Usa *${usedPrefix}${command}* para empezar, *${usedPrefix}${command} stop* para terminar, o responde a la pregunta actual usando los botones.`, m);
            break;
    }
};

// Configuración del handler
akinatorHandler.help = ['akinator', 'akistop'];
akinatorHandler.tags = ['game'];
akinatorHandler.command = /^(akinator|akistop)$/i;

export default akinatorHandler;
