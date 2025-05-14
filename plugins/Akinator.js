import { proto } from '@whiskeysockets/baileys';

// --- Constantes de Juego ---
const MIN_SCORE_TO_KEEP = -50; // Personajes por debajo de esta puntuación se eliminan
const MIN_GUESS_SCORE = 100; // Puntuación mínima para intentar adivinar
const SCORE_DIFF_FOR_GUESS = 50; // Diferencia de puntuación con el segundo mejor para adivinar
const MAX_QUESTIONS = 25; // Límite de preguntas antes de rendirse o adivinar forzosamente

// --- Base de Datos de Personajes (EJEMPLO PEQUEÑO Y DIVERSO) ---
// Las propiedades deben coincidir con las claves de las preguntas
const characters = [
    {
        name: "Superman",
        description: "El Hombre de Acero",
        properties: {
            is_fictional: 4, is_human: 0, has_superpowers: 4, from_movie_tv: 4, is_animated: 2,
            gender: 'male', is_real: 0, wears_cape: 4, from_dc: 4, from_marvel: 0,
            is_animal: 0, is_videogame: 0, wears_mask: 0
        }
    },
    {
        name: "Harry Potter",
        description: "El niño que vivió",
        properties: {
            is_fictional: 4, is_human: 4, has_superpowers: 3, from_movie_tv: 4, is_animated: 0,
            gender: 'male', is_real: 0, wears_cape: 3, from_dc: 0, from_marvel: 0,
            is_animal: 0, is_videogame: 3, wears_mask: 0
        }
    },
    {
        name: "Pikachu",
        description: "Un Pokémon icónico",
        properties: {
            is_fictional: 4, is_human: 0, has_superpowers: 4, from_movie_tv: 4, is_animated: 4,
            gender: 'male', is_real: 0, wears_cape: 0, from_dc: 0, from_marvel: 0,
             is_animal: 4, is_videogame: 4, wears_mask: 0
        }
    },
     {
        name: "Albert Einstein",
        description: "Científico famoso",
        properties: {
            is_fictional: 0, is_human: 4, has_superpowers: 0, from_movie_tv: 2, is_animated: 0,
            gender: 'male', is_real: 4, wears_cape: 0, from_dc: 0, from_marvel: 0,
            is_animal: 0, is_videogame: 0, wears_mask: 0
        }
    },
    {
        name: "Spider-Man (Peter Parker)",
        description: "Tu amigable vecino arácnido",
        properties: {
            is_fictional: 4, is_human: 4, has_superpowers: 4, from_movie_tv: 4, is_animated: 2,
            gender: 'male', is_real: 0, wears_cape: 0, from_dc: 0, from_marvel: 4,
            is_animal: 0, is_videogame: 4, wears_mask: 4
        }
    },
     {
        name: "Mickey Mouse",
        description: "Ícono de Disney",
        properties: {
            is_fictional: 4, is_human: 0, has_superpowers: 0, from_movie_tv: 4, is_animated: 4,
            gender: 'male', is_real: 0, wears_cape: 0, from_dc: 0, from_marvel: 0,
             is_animal: 4, is_videogame: 4, wears_mask: 0
        }
    },
     {
        name: "Julio César",
        description: "Emperador romano",
        properties: {
            is_fictional: 0, is_human: 4, has_superpowers: 0, from_movie_tv: 2, is_animated: 0,
            gender: 'male', is_real: 4, wears_cape: 0, from_dc: 0, from_marvel: 0,
            is_animal: 0, is_videogame: 0, wears_mask: 0
        }
    }
];

// --- Lista de Preguntas ---
const questions = [
    { key: "is_fictional", text: "¿Tu personaje es ficticio?" },
    { key: "is_human", text: "¿Tu personaje es humano?" },
    { key: "has_superpowers", text: "¿Tu personaje tiene superpoderes o habilidades mágicas?" },
    { key: "from_movie_tv", text: "¿Tu personaje es conocido por aparecer en películas o series de televisión?" },
    { key: "is_animated", text: "¿Tu personaje es un dibujo animado?" },
    { key: "gender", text: "¿Tu personaje es masculino?" },
    { key: "is_real", text: "¿Tu personaje es una persona real que existió/existe?"},
    { key: "wears_cape", text: "¿Tu personaje usa capa?"},
    { key: "from_dc", text: "¿Tu personaje es del universo DC (Superman, Batman, etc.)?"},
    { key: "from_marvel", text: "¿Tu personaje es del universo Marvel (Spider-Man, Iron Man, etc.)?"},
    { key: "is_animal", text: "¿Tu personaje es un animal (o criatura similar)?"},
    { key: "is_videogame", text: "¿Tu personaje es conocido por aparecer en videojuegos?"},
    { key: "wears_mask", text: "¿Tu personaje usa máscara?"}
    // Añade muchas más preguntas aquí con sus claves correspondientes
];

// --- Gestión de Sesiones de Akinator ---
// Mapa para guardar el estado del juego por chat
const akinatorSessions = new Map();
/* Estado del juego:
{
    possibleCharacters: Array<{ character: Character, score: number }>,
    askedQuestions: string[], // Keys de preguntas
    currentQuestionKey: string | null,
    totalQuestions: number,
    guessedCharacters: string[] // Nombres de personajes ya adivinados (y negados)
}
*/

// --- Lógica de Puntuación ---
const getScoreChange = (charAnswer, userAnswer) => {
    if (userAnswer === 4) { // Sí
        if (charAnswer === 4) return 20;
        if (charAnswer === 3) return 10;
        if (charAnswer === 2) return 0;
        if (charAnswer === 1) return -10;
        if (charAnswer === 0) return -20;
    } else if (userAnswer === 3) { // Probablemente Sí
        if (charAnswer === 4) return 10;
        if (charAnswer === 3) return 15;
        if (charAnswer === 2) return 5;
        if (charAnswer === 1) return -10;
        if (charAnswer === 0) return -15;
    } else if (userAnswer === 2) { // No sé
        return 0; // No cambia la puntuación
    } else if (userAnswer === 1) { // Probablemente No
        if (charAnswer === 4) return -15;
        if (charAnswer === 3) return -10;
        if (charAnswer === 2) return 5;
        if (charAnswer === 1) return 15;
        if (charAnswer === 0) return 10;
    } else if (userAnswer === 0) { // No
        if (charAnswer === 4) return -20;
        if (charAnswer === 3) return -10;
        if (charAnswer === 2) return 0;
        if (charAnswer === 1) return 10;
        if (charAnswer === 0) return 20;
    }
    return 0; // Respuesta inválida
};

const updateScores = (possibleCharsWithScores, questionKey, userAnswer) => {
    possibleCharsWithScores.forEach(item => {
        const charAnswer = item.character.properties[questionKey];
        const scoreChange = getScoreChange(charAnswer, userAnswer);
        item.score = Math.max(MIN_SCORE_TO_KEEP -10, item.score + scoreChange); // Asegurar que la puntuación no baje demasiado violentamente
    });
     // Filtrar personajes con puntuación muy baja
    return possibleCharsWithScores.filter(item => item.score >= MIN_SCORE_TO_KEEP);
};

// --- Lógica de Selección de Preguntas ---

// Selecciona la "mejor" pregunta (la que más diferencia a los personajes restantes)
const selectStrategicQuestion = (session) => {
    const availableQuestions = questions.filter(q => !session.askedQuestions.includes(q.key));

    let bestQuestionKey = null;
    let minScoreDiff = Infinity; // Queremos minimizar la diferencia entre el grupo "Sí" y "No"

    for (const q of availableQuestions) {
        let yesishCount = 0; // 3, 4
        let noishCount = 0;  // 0, 1
        let unknownCount = 0; // 2
        let totalUseful = 0; // 0, 1, 3, 4

        // Contar las respuestas entre los personajes posibles
        for (const item of session.possibleCharacters) {
            const charAnswer = item.character.properties[q.key];
            if (charAnswer === 4 || charAnswer === 3) yesishCount++;
            else if (charAnswer === 0 || charAnswer === 1) noishCount++;
            else unknownCount++;

            if (charAnswer !== 2) totalUseful++; // Contar si la respuesta no es "No sé"
        }

        // Si todos responden lo mismo o todos responden "No sé", la pregunta no es útil
        if (totalUseful === 0 || yesishCount === session.possibleCharacters.length || noishCount === session.possibleCharacters.length) {
             continue; // Saltar esta pregunta, no diferencia
        }

        // Estrategia simple: Minimizar la diferencia entre los grupos "Sí" y "No" (ignorando "No sé" para el balance principal)
        const currentScoreDiff = Math.abs(yesishCount - noishCount);

        // Si encontramos una pregunta que divide mejor al grupo
        if (currentScoreDiff < minScoreDiff) {
            minScoreDiff = currentScoreDiff;
            bestQuestionKey = q.key;
        }
    }

    return bestQuestionKey; // Retorna la clave de la mejor pregunta o null si no hay útiles
};

// --- Lógica de Adivinanza ---

const checkGuessCondition = (session) => {
    if (session.possibleCharacters.length === 0) {
        return { shouldGuess: false, reason: 'no_characters' };
    }

    // Ordenar por puntuación descendente
    const sortedPossible = [...session.possibleCharacters].sort((a, b) => b.score - a.score);

    const topCharacter = sortedPossible[0];

    // Condición 1: Solo queda 1 personaje
    if (sortedPossible.length === 1) {
        return { shouldGuess: true, character: topCharacter.character, reason: 'only_one' };
    }

    // Condición 2: Puntuación alta y diferencia significativa con el segundo
    if (topCharacter.score >= MIN_GUESS_SCORE && sortedPossible.length > 1) {
         const secondCharacter = sortedPossible[1];
         if (topCharacter.score - secondCharacter.score >= SCORE_DIFF_FOR_GUESS) {
             return { shouldGuess: true, character: topCharacter.character, reason: 'high_confidence' };
         }
    }

    // Condición 3: Alcanzó el límite de preguntas y aún quedan posibles (adivinar el mejor)
    if (session.totalQuestions >= MAX_QUESTIONS && sortedPossible.length > 0) {
         return { shouldGuess: true, character: topCharacter.character, reason: 'max_questions' };
    }


    return { shouldGuess: false }; // No cumple las condiciones para adivinar aún
};


// --- Handler Principal ---
const akinatorHandler = async (m, { conn, command, args, usedPrefix }) => {
    const chat = m.chat;
    const commandArgs = args.map(arg => arg.toLowerCase());
    const action = commandArgs[0];
    const actionArg = commandArgs[1];

    let session = akinatorSessions.get(chat);

    // --- Manejar !akinator (sin args) o !akinator start ---
    if (!action || action === 'start') {
         if (session) {
              // Ya hay un juego, preguntar si reiniciar
               await conn.reply(chat, `⚠️ Ya hay un juego de Akinator en curso en este chat. ¿Quieres empezar uno nuevo y perder el progreso actual?`, m, {
                   buttons: [
                       { buttonId: `${usedPrefix}${command} stop`, buttonText: { displayText: "✅ Sí, terminar juego actual" }, type: 1 },
                       { buttonId: `${usedPrefix}${command} current`, buttonText: { displayText: "❌ No, mostrar pregunta actual" }, type: 1 } // Botón para reenviar pregunta actual
                   ],
                   viewOnce: true
               });
         } else {
             // Iniciar nuevo juego
             const initialPossible = characters.map(char => ({ character: char, score: 0 })); // Iniciar con puntuación 0

             akinatorSessions.set(chat, {
                 possibleCharacters: initialPossible,
                 askedQuestions: [],
                 currentQuestionKey: null,
                 totalQuestions: 0,
                 guessedCharacters: []
             });
             session = akinatorSessions.get(chat);

             const firstQuestionKey = selectStrategicQuestion(session);

             if (!firstQuestionKey) {
                  await conn.reply(chat, "🤖 Ups, no tengo preguntas para empezar. ¡Algo salió mal o mi base de datos está vacía!", m);
                  akinatorSessions.delete(chat);
                  return;
             }

             session.currentQuestionKey = firstQuestionKey;
             const firstQuestion = questions.find(q => q.key === firstQuestionKey);

              const caption = `
🧠✨ *¡Akinator, el Genio de la Web!* ✨🧠

Piensa en un personaje (real o ficticio) famoso. Intentaré adivinarlo.

Responde mis preguntas con la opción que mejor se ajuste. Usa *${usedPrefix}${command} stop* para rendirte.

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
             akinatorSessions.set(chat, session); // Guardar estado inicial
         }
         return;
    }

    // --- Manejar comando !akinator current (mostrar pregunta actual) ---
     if (action === 'current') {
         if (session && session.currentQuestionKey) {
              const currentQ = questions.find(q => q.key === session.currentQuestionKey);
              const caption = `
Continuando juego...
*Pregunta ${session.totalQuestions + 1}:* ${currentQ.text}
`.trim();
               const buttons = [
                   { buttonId: `${usedPrefix}${command} answer 4`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                   { buttonId: `${usedPrefix}${command} answer 3`, buttonText: { displayText: "👍 Probablemente Sí" }, type: 1 },
                   { buttonId: `${usedPrefix}${command} answer 2`, buttonText: { displayText: "🤷‍♀️ No sé" }, type: 1 },
                   { buttonId: `${usedPrefix}${command} answer 1`, buttonText: { displayText: "👎 Probablemente No" }, type: 1 },
                   { buttonId: `${usedPrefix}${command} answer 0`, buttonText: { displayText: "❌ No" }, type: 1 }
               ];
               await conn.sendMessage(chat, { text: caption, buttons: buttons, viewOnce: true }, { quoted: m });
         } else if (session && session.possibleCharacters.length > 0) {
             // No hay pregunta activa, pero sí hay personajes, quizás está en estado de adivinanza anterior o atascado
             await conn.reply(chat, `Hmm, no hay una pregunta activa ahora mismo. ¿Intentamos adivinar o empezamos de nuevo?`, m, {
                  buttons: [
                      { buttonId: `${usedPrefix}${command} guess_force`, buttonText: { displayText: "🔮 Intentar Adivinar" }, type: 1 },
                       { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Empezar de nuevo" }, type: 1 }
                  ],
                   viewOnce: true
             });
         }
          else {
              await conn.reply(chat, `⚠️ No hay un juego de Akinator en curso. Usa *${usedPrefix}${command}* para empezar.`, m);
         }
         return;
     }


    // --- Manejar otras acciones solo si hay una sesión activa ---
     if (!session && action !== 'start' && action !== 'current' && action !== 'stop') {
         await conn.reply(chat, `⚠️ No hay un juego de Akinator en curso. Usa *${usedPrefix}${command}* para empezar.`, m);
         return;
     }


    switch (action) {
        case 'answer':
            if (!session || !session.currentQuestionKey) {
                await conn.reply(chat, `⚠️ No hay una pregunta activa. Usa *${usedPrefix}${command} current* para verla o *${usedPrefix}${command} start* para empezar.`, m);
                return;
            }

            const answerValue = parseInt(actionArg, 10);
            if (isNaN(answerValue) || answerValue < 0 || answerValue > 4) {
                await conn.reply(chat, `❌ Respuesta inválida. Usa los botones para responder (Sí, No, etc.).`, m);
                return;
            }

            const currentQKey = session.currentQuestionKey;

            // 1. Actualizar puntuaciones y filtrar
            session.possibleCharacters = updateScores(session.possibleCharacters, currentQKey, answerValue);

            // 2. Marcar pregunta como respondida
            session.askedQuestions.push(currentQKey);
            session.totalQuestions++;
            session.currentQuestionKey = null; // Resetear currentQuestionKey

            // Ordenar por puntuación después de actualizar
            session.possibleCharacters.sort((a, b) => b.score - a.score);


            // 3. Evaluar estado del juego: ¿Adivinar? ¿Seguir? ¿Perdido?
            const guessCheck = checkGuessCondition(session);

            if (guessCheck.shouldGuess) {
                // ¡Hora de adivinar!
                 const guessedChar = guessCheck.character;
                  await conn.reply(chat, `🤔 Mi predicción es... ¿Tu personaje podría ser... *${guessedChar.name}* (${guessedChar.description})?`, m, {
                      buttons: [
                          { buttonId: `${usedPrefix}${command} guess_response yes`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                          { buttonId: `${usedPrefix}${command} guess_response no`, buttonText: { displayText: "❌ No" }, type: 1 }
                      ],
                      viewOnce: true
                  });
            } else if (session.possibleCharacters.length === 0) {
                // No quedan personajes posibles
                 await conn.reply(chat, `😞 Vaya, con tus respuestas he descartado a todos los personajes. ¡Me has ganado! Parece que no tengo a tu personaje.`, m, {
                     buttons: [
                          { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                     ],
                      viewOnce: true
                 });
                 akinatorSessions.delete(chat); // Terminar sesión
            }
             else {
                // Continuar preguntando
                const nextQKey = selectStrategicQuestion(session);

                if (nextQKey && session.totalQuestions < MAX_QUESTIONS) {
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
                    // No quedan preguntas útiles o alcanzó el límite sin adivinar con confianza
                     await conn.reply(chat, `😔 No me quedan preguntas que me ayuden a diferenciar más. ¿Podría tu personaje ser alguno de estos principales candidatos?`, m);
                     const topCandidates = session.possibleCharacters.slice(0, 5).map(item => `- ${item.character.name} (Puntuación: ${item.score.toFixed(0)})`).join('\n'); // Mostrar top 5
                     await conn.reply(chat, topCandidates || "No me queda ninguna opción.", m, {
                         buttons: [
                              { buttonId: `${usedPrefix}${command} guess_force`, buttonText: { displayText: "🔮 Forzar Adivinanza (Top 1)" }, type: 1 },
                              { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                         ],
                          viewOnce: true
                     });
                     //akinatorSessions.delete(chat); // No terminar sesión si hay candidatos, permitir forzar adivinar o reiniciar
                }
            }
             // Guardar estado actualizado
            akinatorSessions.set(chat, session);
            break;

        case 'guess_response':
             if (!session) {
                 await conn.reply(chat, `⚠️ Algo salió mal. No estamos en un estado de adivinanza. Usa *${usedPrefix}${command} stop* para terminar y *${usedPrefix}${command}* para empezar de nuevo.`, m);
                 return;
            }
            // Necesitamos saber qué personaje se adivinó. La forma más simple es que sea el top 1 en possibleCharacters en este punto.
            const sortedPossible = [...session.possibleCharacters].sort((a, b) => b.score - a.score);
            if (sortedPossible.length === 0) {
                  await conn.reply(chat, `⚠️ Algo salió mal, no hay personajes para adivinar. Usa *${usedPrefix}${command} start* para empezar de nuevo.`, m);
                  akinatorSessions.delete(chat);
                  return;
            }
            const lastGuessedChar = sortedPossible[0].character; // Asumimos que se adivinó el top 1

            const response = actionArg; // 'yes' o 'no'

            if (response === 'yes') {
                // ¡Ganó el bot!
                 await conn.reply(chat, `🥳 ¡Siiiii! ¡Lo sabía! Tu personaje era *${lastGuessedChar.name}*.\n\n¡Gracias por jugar!`, m, {
                      buttons: [
                           { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                      ],
                       viewOnce: true
                 });
                 akinatorSessions.delete(chat); // Terminar sesión
            } else if (response === 'no') {
                // El bot se equivocó en la adivinanza
                session.guessedCharacters.push(lastGuessedChar.name); // Añadir a lista de adivinados incorrectamente
                 // Eliminar el personaje adivinado incorrectamente de los posibles
                session.possibleCharacters = session.possibleCharacters.filter(item => item.character.name !== lastGuessedChar.name);

                // Intentar seguir preguntando con la lista reducida
                const nextQKey = selectStrategicQuestion(session);

                 if (nextQKey && session.possibleCharacters.length > 0 && session.totalQuestions < MAX_QUESTIONS) {
                     session.currentQuestionKey = nextQKey;
                     const nextQuestion = questions.find(q => q.key === nextQKey);

                      const caption = `
😭 Vaya, me equivoqué. ¡Ayúdame a intentarlo de nuevo!

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
                     akinatorSessions.set(chat, session); // Guardar estado
                 } else if (session.possibleCharacters.length > 0) {
                      // No quedan preguntas útiles o alcanzó límite, pero aún hay candidatos
                      await conn.reply(chat, `😔 Me equivoqué y no me quedan más preguntas útiles para adivinar entre los ${session.possibleCharacters.length} candidatos restantes. ¡Creo que me has ganado!`, m, {
                          buttons: [
                               { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                          ],
                           viewOnce: true
                      });
                      akinatorSessions.delete(chat); // Terminar sesión
                 }
                 else {
                     // No quedan personajes posibles después de eliminar el incorrecto
                      await conn.reply(chat, `😞 Me equivoqué y con tu respuesta he descartado a todos los demás. ¡Me has ganado!`, m, {
                          buttons: [
                               { buttonId: `${usedPrefix}${command} start`, buttonText: { displayText: "🔄 Jugar de nuevo" }, type: 1 }
                          ],
                           viewOnce: true
                      });
                      akinatorSessions.delete(chat); // Terminar sesión
                 }

            } else {
                 await conn.reply(chat, `❌ Respuesta inválida. Usa los botones Sí/No.`, m);
            }
            break;

         case 'guess_force':
             // Forzar adivinar el top 1 actual si no se cumplen las condiciones automáticas
             if (!session || session.possibleCharacters.length === 0) {
                 await conn.reply(chat, `⚠️ No hay personajes para adivinar. Usa *${usedPrefix}${command} start* para empezar.`, m);
                 return;
             }
             session.possibleCharacters.sort((a, b) => b.score - a.score);
             const forcedGuessChar = session.possibleCharacters[0].character;

              await conn.reply(chat, `Okay, forzando la adivinanza... ¿Tu personaje podría ser... *${forcedGuessChar.name}* (${forcedGuessChar.description})?`, m, {
                  buttons: [
                      { buttonId: `${usedPrefix}${command} guess_response yes`, buttonText: { displayText: "✅ Sí" }, type: 1 },
                      { buttonId: `${usedPrefix}${command} guess_response no`, buttonText: { displayText: "❌ No" }, type: 1 }
                  ],
                  viewOnce: true
              });
             akinatorSessions.set(chat, session); // Guardar estado
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
             await conn.reply(chat, `❌ Acción no reconocida. Usa *${usedPrefix}${command}* para empezar, *${usedPrefix}${command} current* para ver la pregunta, *${usedPrefix}${command} stop* para terminar.`, m);
            break;
    }
};

// Configuración del handler
akinatorHandler.help = ['akinator', 'akistop', 'akicurrent'];
akinatorHandler.tags = ['game'];
akinatorHandler.command = /^(akinator|akistop|akicurrent)$/i; // Añadir akicurrent para ver la pregunta

export default akinatorHandler;
