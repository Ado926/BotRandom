import { proto } from '@whiskeysockets/baileys';

// Lista de verdades (más interesantes)
const verdades = [
    "¿Alguna vez has stalkeado a alguien en redes sociales por más de una hora?",
    "¿Qué es lo más tonto que has hecho por impresionar a alguien?",
    "¿Cuál es la mentira más grande que has dicho a tus padres?",
    "Si pudieras cambiar algo de tu pasado, ¿qué sería?",
    "¿Qué es lo más extraño que has encontrado en la casa de otra persona?",
    "¿Alguna vez has 'tomado prestado' algo sin devolverlo?",
    "¿Cuál es tu opinión real sobre [menciona un tema controversial o una persona famosa]? (Si aplica, puedes mencionar un tema al azar o pedirle que lo haga el bot)",
    "¿Has leído el diario de alguien o mensajes privados sin permiso?",
    "¿Qué es lo peor que has comido por cortesía?",
    "¿Cuál es tu peor hábito secreto?",
    "¿Alguna vez te has reído en un momento muy serio o inapropiado?",
    "¿Qué es lo más caro que has roto?",
    "¿Cuál es tu placer culposo más grande (serie, música, comida)?",
    "¿Alguna vez te has enamorado de la persona equivocada?",
    "¿Qué es lo más vergonzoso que te ha pasado en una cita?",
    "¿Has fantaseado alguna vez con alguien en este chat (si es un chat de amigos cercanos)?", // Usar con cuidado
    "¿Qué es lo más valiente que has hecho?",
    "¿Alguna vez has fingido que te gustaba algo o alguien para encajar?",
    "¿Cuál es el sueño más extraño que has tenido?",
    "Si pudieras tener una cena con cualquier persona (viva o muerta), ¿quién sería y por qué?",
    "¿Qué es lo primero que harías si fueras invisible por un día?",
    "¿Cuál es tu mayor manía o TOC (trastorno obsesivo-compulsivo menor)?",
    "¿Qué es lo que más te molesta de las redes sociales?",
    "¿Alguna vez has enviado un mensaje vergonzoso a la persona equivocada?",
    "¿Cuál es el comentario más hiriente que has recibido?",
    "¿Qué es algo que te asusta mucho de envejecer?",
    "Si pudieras cambiar una ley en tu país, ¿cuál sería?",
    "¿Qué superpoder te gustaría tener y cómo lo usarías para hacer travesuras?",
    "¿Cuál es tu peor excusa para llegar tarde?",
    "¿Qué es lo más ridículo que has vestido?",
    "¿Alguna vez has espiado a tus vecinos?",
    "¿Cuál es la broma pesada más elaborada que has hecho?",
    "¿Qué es lo que más te da vergüenza que tus amigos o familia sepan de ti?",
    "¿Has tenido alguna experiencia paranormal?",
    "¿Qué es lo más raro que tienes guardado?",
    "¿Cuál es tu mayor extravagancia o gusto caro?",
    "¿Qué prefieres: no bañarte en una semana o no lavarte los dientes en una semana?",
    "¿Cuál es el error más grande que has cometido en el trabajo o estudio?",
    "¿Alguna vez has deseado que alguien se metiera en problemas?",
    "¿Qué es lo más infantil que sigues haciendo?",
    "¿Cuál es tu mayor inseguridad física?",
    "¿Qué cosa te hace sentir incómodo rápidamente?",
    "¿Alguna vez has cantado karaoke sobrio?",
    "¿Qué es lo más romántico que has hecho por alguien?",
    "¿Cuál es tu mayor meta en la vida?",
    "¿Qué es algo que te da mucha envidia de los demás?",
    "¿Has probado alguna droga ilegal?", // Usar con precaución dependiendo del contexto del bot
    "¿Cuál es el chisme más jugoso que sabes?",
    "¿Qué es lo más raro que has buscado en Google?",
    "¿Alguna vez has fingido estar enfermo para no ir a trabajar o estudiar?",
    "¿Cuál es tu mayor miedo en las relaciones personales?",
    "¿Qué cosa te saca de quicio instantáneamente?",
    "¿Has robado alguna vez (aunque sea algo pequeño)?",
    "¿Qué es lo más loco que has hecho en una fiesta?",
    "¿Cuál es tu opinión impopular?",
    "¿Qué es lo más extraño que te parece atractivo de alguien?",
    "¿Alguna vez te has colado en algún sitio?",
    "¿Cuál es tu mayor adicción?",
    "¿Qué es lo más humillante que te ha pasado?",
    "¿Si pudieras vivir la vida de otra persona por un día, quién sería?"
];

// Lista de retos (más interesantes)
const retos = [
    "Envía una nota de voz cantando a todo pulmón la primera canción que aparezca en tu lista de reproducción aleatoria.",
    "Haz una torre con 5 objetos que tengas a mano y envía una foto.",
    "Manda un emoji al azar a 10 contactos diferentes ahora mismo.",
    "Ponte 3 prendas de ropa al revés y/o combinadas de forma ridícula y envía una foto.",
    "Envía una foto de tu pie derecho.",
    "Escribe tu nombre completo con el codo y envía la foto.",
    "Haz un video de 15 segundos haciendo una imitación graciosa (persona, animal, personaje).",
    "Llama a alguien (que no sea del chat) y cuéntale un chiste malo con voz seria.",
    "Busca el objeto más extraño que tengas cerca y envía una foto explicando qué es.",
    "Come una cucharada de mostaza o alguna salsa picante (si tienes y te atreves) y envía foto/video de tu reacción.",
    "Haz 15 abdominales o lagartijas y envia un audio de ti jadeando después.",
    "Dibuja un autorretrato con los ojos cerrados y envía la foto.",
    "Envía un audio diciendo 'El otorrinolaringólogo de Parangaricutirimicuaro se quiere desotorrinolaringologar' 3 veces rápido.",
    "Ponte una máscara facial (si tienes) o algo que la simule (papel higiénico, etc.) y envía una foto.",
    "Envía una foto del fondo de pantalla de tu teléfono.",
    "Haz un baile tonto y envía un video corto.",
    "Escribe un mensaje solo usando la fila de en medio de tu teclado (ASDFGHJKLÑ) y envíalo.",
    "Haz un peinado ridículo y envía una foto.",
    "Envía un audio diciendo 'Hola mundo' en el idioma que menos conozcas.",
    "Busca el meme más viejo que tengas guardado y envíalo.",
    "Ponte los zapatos en las manos y envia una foto.",
    "Haz una estatua por 30 segundos en una pose graciosa y envia una foto.",
    "Envía una foto de tu dedo meñique.",
    "Haz 5 saltos de tijera y envia un audio de ti respirando fuerte.",
    "Busca algo de color rosa y envia una foto.",
    "Envía un audio imitando el sonido de un animal de granja.",
    "Escribe un mensaje a la persona anterior en este chat (o una aleatoria) diciéndole que tiene una mosca en el hombro.",
    "Ponte un calcetín en una mano y envía una foto.",
    "Haz como si fueras un robot por 20 segundos (audio o video).",
    "Envía una foto de algo suave que tengas cerca.",
    "Canta el feliz cumpleaños a alguien que no cumple años hoy (nota de voz).",
    "Busca una piedra y envia una foto de ella.",
    "Haz el sonido de un rayo (audio).",
    "Envía una foto de tu oreja izquierda.",
    "Intenta equilibrar una cuchara en tu nariz y envía foto/video si lo logras.",
    "Escribe un acróstico con la palabra 'RETO'.",
    "Envía una foto de la suela de tu zapato.",
    "Haz un sonido de trompeta (audio).",
    "Escribe un tweet que no publicarías en Twitter.",
    "Envía una foto de tus dientes.",
    "Haz el sonido de un coche arrancando (audio).",
    "Escribe un mensaje sin usar la letra 'E'.",
    "Envía una foto de tus pulgares.",
    "Haz un sonido de bostezo muy exagerado (audio).",
    "Busca algo redondo y envia una foto.",
    "Escribe un mensaje al revés (caracter por caracter, no palabra por palabra).",
    "Envía una foto de tu rodilla.",
    "Haz el sonido de un gallo (audio).",
    "Busca algo que brille y envia una foto.",
    "Escribe un mensaje usando solo la primera letra de cada palabra (ej: H e u m c l, = Hola este es un mensaje con letras)."
];


const verdadoretoHandler = async (m, { conn, command, args, usedPrefix }) => {
    const chat = m.chat;

    if (args.length === 0) {
        // Si no hay argumentos, presenta las opciones "Verdad" o "Reto" con botones
        const caption = `
🃏✨ *¡Es hora de Verdad o Reto!* ✨🃏

¡Atrévete a preguntar o a desafiar! Elige tu opción:
`.trim();

        const buttons = [
            {
                buttonId: `${usedPrefix}verdadoreto verdad`,
                buttonText: { displayText: "🤫 Verdad" },
                type: 1
            },
            {
                buttonId: `${usedPrefix}verdadoreto reto`,
                buttonText: { displayText: "💪 Reto" },
                type: 1
            }
        ];

        // Enviar el mensaje con botones
        await conn.sendMessage(
            chat,
            {
                text: caption,
                buttons: buttons,
                viewOnce: true // O false, si prefieres que los botones se queden visibles
            },
            { quoted: m }
        );

    } else {
        // Si hay argumentos, el usuario ha elegido
        const choice = args[0].toLowerCase(); // 'verdad' o 'reto'
        let selectedItem = '';
        let type = '';
        let responseText = '';

        if (choice === 'verdad') {
            // Seleccionar una verdad aleatoria
            const randomIndex = Math.floor(Math.random() * verdades.length);
            selectedItem = verdades[randomIndex];
            type = 'Verdad';
            // Añadir el prefijo exacto para verdad
            responseText = `Okay.\n\nEs verdad que ${selectedItem}`;

        } else if (choice === 'reto') {
            // Seleccionar un reto aleatorio
            const randomIndex = Math.random() < 0.001 ? retos.length -1 : Math.floor(Math.random() * retos.length); // Reto especial para probar
            selectedItem = retos[randomIndex];
            type = 'Reto';
            // Añadir el prefijo exacto para reto
            responseText = `Okay.\n\nTe reto a que ${selectedItem}`;

        } else {
            // Opción no válida
            return conn.reply(chat, `❌ Opción no válida. Usa *${usedPrefix}verdadoreto* para elegir entre Verdad o Reto, o selecciona los botones.`, m);
        }

        // Botón para jugar de nuevo
        const buttons = [
            {
                buttonId: `${usedPrefix}verdadoreto`, // Este buttonId llama al handler sin argumentos
                buttonText: { displayText: "🔄 Nueva Ronda" },
                type: 1
            }
        ];

        // Enviar la verdad o el reto seleccionado con el prefijo y el botón de nueva ronda
        await conn.sendMessage(
            chat,
            {
                text: responseText,
                buttons: buttons,
                viewOnce: true // O false
            },
            { quoted: m }
        );
    }
};

// Configuración del handler
verdadoretoHandler.help = ['verdadoreto'];
verdadoretoHandler.tags = ['fun']; // Puedes cambiar la categoría si lo necesitas
verdadoretoHandler.command = /^(verdadoreto|vyc|v o r)$/i; // Comandos para activarlo (verdadoreto, vyc, v o r)

export default verdadoretoHandler;
