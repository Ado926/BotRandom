process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
import './settings.js' // Asegúrate de que settings.js exista y esté correcto
import {createRequire} from 'module'
import path, {join} from 'path'
import {fileURLToPath, pathToFileURL} from 'url'
import {platform} from 'process'
import * as ws from 'ws'
// Asegúrate de importar 'fs' completo y 'child_process'
import fs, {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch} from 'fs';
import { promises as fsp } from 'fs'; // Importa promises de fs para mkdir asíncrono
import yargs from 'yargs';
import {spawn} from 'child_process'; // Importa spawn directamente
import lodash from 'lodash'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import {tmpdir} from 'os' // Importa tmpdir y os
import os from 'os'; // Importa os
import {format} from 'util'
import boxen from 'boxen'
// Importa pino solo una vez
import pino from 'pino'
import {Boom} from '@hapi/boom'
import {makeWASocket, protoType, serialize} from './lib/simple.js' // Asegúrate de que simple.js exista y esté correcto
import {Low, JSONFile} from 'lowdb'
// Importa mongoDB si los usas, asegúrate de que existan
// import {mongoDB, mongoDBV2} from './lib/mongoDB.js'
// Importa cloudDBAdapter si la usas
// import { cloudDBAdapter } from './lib/cloudDBAdapter.js';
import store from './lib/store.js' // Asegúrate de que store.js exista y esté correcto
const {proto} = (await import('@whiskeysockets/baileys')).default
const {DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser, PHONENUMBER_MCC} = await import('@whiskeysockets/baileys')
import readline from 'readline'
import NodeCache from 'node-cache'

// Destructuring de objetos importados
const {CONNECTING} = ws
const {chain} = lodash

// Configuración de puertos
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000

// Extiende prototipos y serializa (mantener si es necesario para simple.js)
protoType()
serialize()

// Definiciones globales para compatibilidad con CommonJS
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; global.__dirname = function dirname(pathURL) {
return path.dirname(global.__filename(pathURL, true))
}; global.__require = function require(dir = import.meta.url) {
return createRequire(dir)
}

// Definición global para APIs (si la usas)
global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

// Marca de tiempo de inicio
global.timestamp = {start: new Date}

// Obtener el directorio actual del script
const __dirname = global.__dirname(import.meta.url)

// Parsear argumentos de línea de comandos
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())

// Definir el prefijo de comandos (ajusta según necesites)
global.prefix = new RegExp('^[' + (opts['prefix'] || '/.$#!').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']') // Usa opts['prefix'] si está definido

// Configuración de la base de datos LowDB o CloudDB
// Asegúrate de tener las adaptadores (JSONFile, cloudDBAdapter, etc.) instalados
global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile('storage/databases/database.json')) // Ajusta la ruta si es diferente

// Alias para la base de datos global
global.DATABASE = global.db

// Función para cargar la base de datos
global.loadDatabase = async function loadDatabase() {
if (global.db.READ) {
return new Promise((resolve) => setInterval(async function() {
if (!global.db.READ) {
clearInterval(this)
resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
}}, 1 * 1000)) // Esperar 1 segundo
}
if (global.db.data !== null) return // Ya cargada
global.db.READ = true // Marcar como en lectura
await global.db.read().catch(console.error) // Intentar leer
global.db.READ = null // Desmarcar lectura
global.db.data = { // Inicializar datos si están vacíos
users: {},
chats: {},
stats: {},
msgs: {},
sticker: {},
settings: {}, // Añadir o asegurar que settings existe
...(global.db.data || {}), // Mantener datos existentes
}
global.db.chain = chain(global.db.data) // Encadenar lodash
}
loadDatabase() // Cargar base de datos al iniciar

// Directorio por defecto para la sesión principal del bot
global.sessions = opts._[0] || 'sessions'; // Usar el primer argumento o 'sessions'

// --- MANEJO DE MULTI-SESIÓN INICIO ---

// Usar un mapa para almacenar las instancias de los bots, con la clave siendo el nombre del directorio de sesión
global.allBots = {};

// Logger principal para mensajes generales del script
const logger = pino({ level: 'silent' }); // Nivel de log global para el script principal


// Función para crear y gestionar una única conexión de bot (principal o sub)
async function createBotConnection(sessionDir, isMain = false) {
    const sessionPath = `./${sessionDir}`; // Ruta completa al directorio de sesión

    // --- Manejo de Autenticación ---
    const { state, saveCreds: saveState } = await useMultiFileAuthState(sessionPath);
    const msgRetryCounterCache = new NodeCache(); // Cache para reintentos de mensajes

    // --- Opciones de Conexión ---
    const connectionOptions = {
        logger: pino({ level: 'info' }).child({ class: `${isMain ? 'main' : 'sub'}-${sessionDir}` }), // Logger específico por bot, nivel info
        printQRInTerminal: isMain && !existsSync(`${sessionPath}/creds.json`) && process.argv.includes("qr"), // Solo imprimir QR para el principal si no hay credenciales y se usa el flag 'qr'
        mobile: process.argv.includes("mobile"), // Flag mobile (si aplica)
        browser: isMain ? ['Bot Principal', 'Edge', '20.0.04'] : [`Sub-bot ${sessionDir}`, 'Edge', '110.0.1587.56'], // Identificador en WhatsApp
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ class: `keys-${sessionDir}` })), // Logger para keys, nivel fatal
        },
        markOnlineOnConnect: true, // Marcar como online al conectar
        generateHighQualityLinkPreview: true,
        getMessage: async (clave) => {
            // Implementación de getMessage. Puede requerir lógica diferente si los sub-bots tienen stores separados.
            // Usaremos el store global por defecto para simplicidad, puede que no funcione para todos los casos.
            let jid = jidNormalizedUser(clave.remoteJid);
            // Intentar cargar desde el store global
            let msg = await store.loadMessage(jid, clave.id).catch(e => {
                 //console.error(`[${sessionDir}] Error loading message from store:`, e); // Opcional: log error loading
                 return undefined;
            });
             // Si no se encuentra en el store global o no existe, devolver vacío
            return msg?.message || "";
        },
        msgRetryCounterCache,
        msgRetryCounterMap: new NodeCache(), // Otro cache para reintentos
        defaultQueryTimeoutMs: undefined,
        version: [2, 3000, 1015901307], // Versión específica de Baileys
        // Opciones adicionales si se usan
        // getBusinessMessage: async (clave) => { ... },
        // makeSocket: (config) => new ws.WebSocket({...})
    };

    // Crear la instancia de conexión de Baileys
    const bot = makeWASocket(connectionOptions);

    // --- Propiedades específicas de la instancia del bot ---
    bot.isInit = false; // Bandera de inicialización
    bot.well = false; // Otra bandera (si es usada en handler.js)
    bot.sessionDir = sessionDir; // Almacenar el nombre del directorio de sesión
    bot.isMain = isMain; // Bandera para identificar el bot principal

    // --- Lógica de Emparejamiento (Solo si no existen credenciales) ---
     if (!existsSync(`${sessionPath}/creds.json`)) {
         // Esta parte interactiva es compleja para múltiples bots.
         // Asumimos que si no hay credenciales, se necesita emparejar.
         // Si es el bot principal y se usa código o QR, se intentará aquí.
         // Para sub-bots, generalmente se espera que ya tengan una sesión válida al agregarlos a OthoJadiBot.
         // Si un sub-bot necesita emparejarse por primera vez, deberías iniciarlo individualmente
         // o adaptar esta lógica para preguntar por número/QR por cada sub-bot nuevo.

         if (isMain && (process.argv.includes("code") || process.argv.includes("qr"))) {
             const MethodMobile = process.argv.includes("mobile");
             let phoneNumber = global.botNumberCode; // Asumiendo que global.botNumberCode existe

             // Preguntar por número solo si es el bot principal, se usa código y no hay número pre-configurado
             if (process.argv.includes("code") && !phoneNumber && !MethodMobile) {
                 const colores = chalk.bgMagenta.white;
                 console.log(colores(`\n${chalk.bold.greenBright('🍁 Ingrese el número de WhatsApp para el Bot Principal.')}\n${chalk.bold.cyanBright('🍭  Ejemplo: 521657×××××××')}\n${chalk.bold.magentaBright('---> ')}`));
                 phoneNumber = await new Promise(resolve => {
                     const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                     rl.question('', (input) => {
                         rl.close();
                         resolve(input);
                     });
                 });
                  phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
             } else if (MethodMobile) {
                  throw new Error(`No se puede usar código de emparejamiento con la API móvil para ${sessionDir}`);
             }


             if (phoneNumber && !Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                 console.error(chalk.bold.redBright(`Número de teléfono inválido para ${sessionDir}: ${phoneNumber}`));
                 // Decide si salir o intentar con QR
                 // process.exit(0);
             } else if (phoneNumber) {
                  // Solicitar código de emparejamiento si se tiene número
                  setTimeout(async () => {
                      try {
                           let codigo = await bot.requestPairingCode(phoneNumber);
                           codigo = codigo?.match(/.{1,4}/g)?.join("-") || codigo;
                           console.log(chalk.bold.white(chalk.bgMagenta(`⭐️ Código para ${sessionDir}: `)), chalk.bold.white(chalk.white(codigo)));
                      } catch (error) {
                           console.error(chalk.bold.red(`Error solicitando código para ${sessionDir}: ${error}`));
                      }
                  }, 3000); // Esperar 3 segundos
             } else if (process.argv.includes("qr")) {
                 console.log(chalk.yellow(`[${sessionDir}] Esperando código QR...`));
                 // El QR se imprimirá automáticamente si printQRInTerminal es true
             }


         } else if (!isMain) {
             console.warn(chalk.yellow(`[SUB-BOT] No se encontraron credenciales para ${sessionDir}. Por favor, asegúrese de que la sesión esté registrada o elimine la carpeta e inicie este sub-bot individualmente para emparejarlo.`));
             // No intentar emparejar automáticamente para sub-bots si no se dan flags
             // La conexión probablemente fallará con loggedOut/badSession
         }
     }


    // --- Manejo de Eventos de Conexión para ESTE BOT ---
    bot.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, isNewLogin } = update;
        bot.stopped = connection; // Actualizar el estado 'stopped' de esta instancia

        if (isNewLogin) bot.isInit = true; // Marcar como nuevo login para esta instancia

        const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

        if (connection == 'open') {
             console.log(boxen(chalk.bold(`¡CONECTADO con ${sessionDir}! (${bot.user?.id.split(':')[0]})`), { borderStyle: 'round', borderColor: 'green', title: chalk.green.bold('● CONEXIÓN ●'), titleAlignment: 'center' }));
        } else if (connection === 'close') {
             let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
             console.error(chalk.bold.redBright(`\n⚠️ Conexión para ${sessionDir} cerrada. Razón: ${reason || 'Desconocida'}`));

            // --- Lógica de Reconexión/Manejo de Desconexión ---
            if (reason === DisconnectReason.connectionClosed ||
                reason === DisconnectReason.connectionLost ||
                reason === DisconnectReason.restartRequired ||
                reason === DisconnectReason.timedOut) {
                 console.log(chalk.yellow(`[${sessionDir}] Intentando reconectar en 5 segundos...`));
                 // Pequeño retraso antes de intentar reconectar
                 setTimeout(() => createBotConnection(sessionDir, isMain), 5000); // Intentar crear una nueva conexión
            } else if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                 console.error(chalk.bold.cyanBright(`\n⚠️ SESIÓN INVÁLIDA para ${sessionDir}. Elimine la carpeta "${sessionDir}" y re-empareje.`));
                 // Eliminar la referencia de este bot de la lista global ya que la sesión es inválida
                 delete global.allBots[sessionDir];
                 // Opcional: Eliminar archivos de sesión inválidos
                 /*
                 if (existsSync(sessionPath)) {
                     console.log(chalk.red(`[${sessionDir}] Eliminando directorio de sesión inválido: ${sessionPath}`));
                      fsp.rm(sessionPath, { recursive: true, force: true }).catch(console.error);
                 }
                 */
            } else if (reason === DisconnectReason.connectionReplaced) {
                 console.error(chalk.bold.redBright(`\n⚠️ Conexión para ${sessionDir} reemplazada. Otra sesión abierta en otro lugar.`));
                 // Eliminar la referencia de este bot, no intentar reconectar automáticamente
                 delete global.allBots[sessionDir];
            } else {
                 console.warn(chalk.yellow(`[${sessionDir}] Desconectado por razón no manejada ${reason}. Intentando reconectar en 5 segundos...`));
                 setTimeout(() => createBotConnection(sessionDir, isMain), 5000); // Intentar crear una nueva conexión
            }
             // --- Fin Lógica de Reconexión ---
        }
    });
    // --- Fin Eventos de Conexión ---


    // --- Adjuntar otros Eventos ---
    // Evento para mensajes entrantes
    bot.ev.on('messages.upsert', async (messages) => {
         // Llamar al handler principal, pasándole la instancia 'bot' actual
         if (global.handler && typeof global.handler.handler === 'function') {
              // El handler debe esperar 'bot' como primer argumento: async function handler(bot, messages, m)
              await global.handler.handler(bot, messages); // Pasar la instancia del bot
         } else {
              console.error(`[${sessionDir}] Handler function not loaded or not found.`);
         }
    });

    // Evento para actualizar credenciales (guardar sesión)
    bot.ev.on('creds.update', saveState); // Usar la función saveState específica de useMultiFileAuthState


    // Añadir la instancia del bot a la colección global si la conexión fue exitosa (tiene credenciales o está intentando obtenerlas)
    // La conexión puede no estar 'open' todavía, pero la instancia existe.
    if (bot.authState.creds || !existsSync(`${sessionPath}/creds.json`)) { // Si tiene creds O necesita registrarse
         global.allBots[sessionDir] = bot;
         console.log(chalk.cyan(`[${sessionDir}] Instancia de bot creada y añadida a global.allBots.`));
    } else {
        console.warn(chalk.yellow(`[${sessionDir}] No se pudo crear la instancia de bot (posiblemente sin creds y sin flags de registro).`));
    }


    return bot; // Devolver la instancia creada
}

// --- Función principal para iniciar todas las conexiones de bots ---
async function startAllBots() {
    console.log(chalk.bold.white(boxen(chalk.bold('Iniciando Bots Multi-Sesión'), { borderStyle: 'double', padding: 1, margin: 1, float: 'center', align: 'center', borderColor: 'blue' })));

    // 1. Verificar y iniciar el bot principal (directorio sessions o global.sessions)
    const mainSessionDir = global.sessions || 'sessions';
    if (existsSync(`./${mainSessionDir}`)) {
        console.log(chalk.bold.blue(`\nVerificando directorio de sesión principal: ./${mainSessionDir}...`));
        // Siempre intentar crear la conexión principal. createBotConnection manejará si necesita registro.
         await createBotConnection(mainSessionDir, true);
    } else {
        console.warn(chalk.bold.yellow(`Directorio de sesión principal "${mainSessionDir}" no encontrado. Creando y iniciando registro...`));
         try {
             await fsp.mkdir(`./${mainSessionDir}`, { recursive: true }); // Crear directorio si no existe
             await createBotConnection(mainSessionDir, true); // Iniciar registro
         } catch(e) {
             console.error(chalk.red(`Error al crear directorio de sesión principal ${mainSessionDir}:`), e);
         }
    }

    // 2. Verificar y iniciar los sub-bots (directorio OthoJadiBot)
    const subBotBaseDir = 'OthoJadiBot'; // El directorio especificado para sub-bots
    if (existsSync(`./${subBotBaseDir}`)) {
        console.log(chalk.bold.blue(`\nEscaneando directorio de sub-bots: ./${subBotBaseDir}...`));
        try {
            const subBotEntries = readdirSync(`./${subBotBaseDir}`); // Leer contenido de OthoJadiBot
            const sessionFolders = subBotEntries.filter(item => {
                const itemPath = join(`./${subBotBaseDir}`, item);
                // Verificar si es un directorio Y si contiene creds.json
                return statSync(itemPath).isDirectory() && existsSync(join(itemPath, 'creds.json'));
            });

            if (sessionFolders.length > 0) {
                console.log(chalk.bold.blue(`Se encontraron ${sessionFolders.length} sesiones de sub-bots válidas.`));
                for (const folder of sessionFolders) {
                    const sessionDir = join(subBotBaseDir, folder); // Path como OthoJadiBot/bot1
                    console.log(chalk.bold.blue(`Iniciando conexión para sub-bot: ./${sessionDir}...`));
                    await createBotConnection(sessionDir, false); // Iniciar conexión de sub-bot
                }
            } else {
                console.log(chalk.blue(`No se encontraron subdirectorios con creds.json válidos en ./${subBotBaseDir}. No se iniciarán sub-bots.`));
            }
        } catch (e) {
             console.error(chalk.red(`Error al escanear o procesar directorio de sub-bots ./${subBotBaseDir}:`), e);
        }

    } else {
        console.log(chalk.bold.yellow(`Directorio de sub-bots "${subBotBaseDir}" no encontrado. Saltando la carga de sub-bots.`));
    }

    // --- Reporte final de intentos de inicialización ---
    console.log('\n' + chalk.bold.white(boxen(chalk.bold('REPORTE DE INICIALIZACIÓN'), { borderStyle: 'double', padding: 1, margin: 1, float: 'center', align: 'center', borderColor: 'blue' })));

    const totalBotsAttempted = Object.keys(global.allBots).length;
    if (totalBotsAttempted > 0) {
        console.log(chalk.bold.green(`¡Se intentó iniciar ${totalBotsAttempted} bot(s)!`));
        for (const sessionDir in global.allBots) {
            const bot = global.allBots[sessionDir];
            const status = bot.user ? '✅ Conectado/Iniciando' : '🟡 Intentando Conectar/Fallo Inicial';
            const type = bot.isMain ? 'Principal' : 'Sub-bot';
            console.log(chalk.cyan(`- ${type} (${sessionDir}): ${status}`));
        }
        console.log(chalk.yellow('\nNOTA: "Intentando Conectar/Fallo Inicial" significa que la instancia se creó, pero aún no está en estado "open".'));
        console.log(chalk.yellow('Los logs con prefijo [main-sessions] o [sub-OthoJadiBot/...] te darán más detalles sobre el estado final de la conexión.'));
        console.log(chalk.yellow('Si una sesión dice "Última vez activa" en WhatsApp, la sesión es inválida y DEBES eliminar su carpeta en ./sessions o ./OthoJadiBot y re-emparejarla.'));

    } else {
         console.log(chalk.bold.red(`¡NINGÚN BOT PUDO SER INICIALIZADO!`));
         console.error(chalk.red("Verifique los directorios de sesión ('./sessions' o el definido en global.sessions y './OthoJadiBot') y asegúrese de que contengan creds.json válidos o estén vacíos para iniciar el registro."));
    }
     console.log(chalk.bold.white(boxen('', { borderStyle: 'double', padding: 0, margin: 1, float: 'center', align: 'center', borderColor: 'blue' })));
}

// --- MANEJO DE MULTI-SESIÓN FIN ---


// --- Intervalos y Limpieza ---

// Asegúrate de que estos intervalos revisen el estado de los bots antes de ejecutar tareas que requieran conexión
setInterval(async () => {
// Ejecutar limpieza de tmp si al menos un bot está conectado
if (Object.values(global.allBots).some(bot => bot && bot.user && bot.stopped !== 'close')) {
    await clearTmp();
    console.log(chalk.bold.cyanBright(`\n╭» 🟢 MULTIMEDIA 🟢\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
} else {
     console.log(chalk.gray("Saltando limpieza de tmp: Ningún bot conectado."));
}}, 1000 * 60 * 4); // Cada 4 minutos


setInterval(async () => {
// Ejecutar limpieza de pre-keys de sesión principal si el bot principal está conectado
const mainBot = Object.values(global.allBots).find(bot => bot.isMain);
if (mainBot && mainBot.user && mainBot.stopped !== 'close') {
    await purgeSession(); // Esta función ya apunta a global.sessions
} else {
     console.log(chalk.gray("Saltando limpieza de sesión principal: Bot principal no conectado."));
}}, 1000 * 60 * 10) // Cada 10 minutos


setInterval(async () => {
// Ejecutar limpieza de pre-keys de sub-bots si al menos un sub-bot está conectado
const anySubBotConnected = Object.values(global.allBots).some(bot => !bot.isMain && bot.user && bot.stopped !== 'close');
if (anySubBotConnected) {
    await purgeSessionSB(); // Esta función ya apunta a OthoJadiBot subdirectorios
} else {
     console.log(chalk.gray("Saltando limpieza de sesiones de sub-bots: Ningún sub-bot conectado."));
}}, 1000 * 60 * 10); // Cada 10 minutos


setInterval(async () => {
// Ejecutar limpieza de archivos antiguos si al menos un bot está conectado (principal o sub)
if (Object.values(global.allBots).some(bot => bot && bot.user && bot.stopped !== 'close')) {
    await purgeOldFiles(); // Esta función apunta a global.sessions y OthoJadiBot
} else {
     console.log(chalk.gray("Saltando limpieza de archivos antiguos: Ningún bot conectado."));
}}, 1000 * 60 * 10); // Cada 10 minutos


// --- Funciones de Limpieza Existentes (Ajustadas para nuevos paths) ---
function clearTmp() {
    const tmpDirs = [join(__dirname, 'tmp')];
    // Añadir carpetas tmp dentro de los directorios de sesiones si existen
    const mainSessionTmp = join(__dirname, global.sessions || 'sessions', 'tmp');
    if (existsSync(mainSessionTmp)) tmpDirs.push(mainSessionTmp);

    const subBotBaseDir = join(__dirname, 'OthoJadiBot');
    if (existsSync(subBotBaseDir)) {
        readdirSync(subBotBaseDir).forEach(item => {
            const itemPath = join(subBotBaseDir, item);
            try {
                if (statSync(itemPath).isDirectory()) {
                    const subBotTmp = join(itemPath, 'tmp');
                    if (existsSync(subBotTmp)) tmpDirs.push(subBotTmp);
                }
            } catch(e) {
                console.error(chalk.red(`Error al inspeccionar directorio en OthoJadiBot para limpieza tmp: ${item}`), e);
            }
        });
    }


    let cleanedCount = 0;
    tmpDirs.forEach(dir => {
        if (!existsSync(dir)) return;

        try {
            const filenames = readdirSync(dir);
            filenames.forEach(file => {
                const filePath = join(dir, file);
                try {
                    const stats = statSync(filePath);
                    // Eliminar archivos con más de 3 minutos
                     if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) {
                        unlinkSync(filePath);
                        //console.log(chalk.gray(`Limpiado: ${filePath}`)); // Opcional: Log cada archivo limpiado
                        cleanedCount++;
                    }
                } catch (e) {
                    console.error(chalk.red(`Error limpiando archivo temporal ${filePath}:`), e);
                }
            });
        } catch (e) {
             console.error(chalk.red(`Error leyendo directorio temporal ${dir} para limpieza:`), e);
        }
    });
     //console.log(chalk.gray(`Limpieza de archivos temporales completada. Archivos eliminados: ${cleanedCount}`)); // Opcional: Reporte total
}

// Limpia pre-keys de la sesión principal (sessions o global.sessions)
function purgeSession() {
    const sessionDir = global.sessions || 'sessions';
    if (!existsSync(`./${sessionDir}`)) {
        console.warn(chalk.yellow(`Saltando purgeSession: Directorio principal "${sessionDir}" no encontrado.`));
        return;
    }
    let prekeyCount = 0;
    try {
        const files = readdirSync(`./${sessionDir}`);
        const filesToDelete = files.filter(file => file.startsWith('pre-key-')); // Identifica archivos pre-key

        filesToDelete.forEach(file => {
            const filePath = join(`./${sessionDir}`, file);
            try {
                unlinkSync(filePath);
                prekeyCount++;
            } catch (e) {
                 console.error(`Error eliminando archivo pre-key principal ${filePath}:`, e);
            }
        });
    } catch (e) {
        console.error(`Error leyendo directorio principal para purgar pre-keys:`, e);
    }

    if (prekeyCount > 0) {
         console.log(chalk.bold.cyanBright(`\n╭» 🔵 SESIÓN PRINCIPAL 🔵\n│→ ARCHIVOS PRE-KEY ELIMINADOS (${prekeyCount} archivos)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
    } else {
         console.log(chalk.bold.green(`\n╭» 🔵 SESIÓN PRINCIPAL 🔵\n│→ NADA POR ELIMINAR (Pre-keys)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ✅`));
    }
}

// Limpia pre-keys de los sub-bots (OthoJadiBot)
function purgeSessionSB() {
    const subBotBaseDir = 'OthoJadiBot';
    if (!existsSync(`./${subBotBaseDir}`)) {
        console.warn(chalk.yellow(`Saltando purgeSessionSB: Directorio de sub-bots "${subBotBaseDir}" no encontrado.`));
        return;
    }
    let SBprekeyCount = 0;
    try {
        const listaDirectorios = readdirSync(`./${subBotBaseDir}/`); // Lee subdirectorios en OthoJadiBot
        listaDirectorios.forEach(directorio => {
            const fullDirPath = join(`./${subBotBaseDir}`, directorio);
            try {
                if (statSync(fullDirPath).isDirectory()) { // Si es un directorio
                    const DSBPreKeys = readdirSync(fullDirPath).filter(fileInDir => {
                        return fileInDir.startsWith('pre-key-') // Identifica pre-keys
                    })
                    DSBPreKeys.forEach(fileInDir => {
                        // Asegúrate de NO eliminar creds.json
                        if (fileInDir !== 'creds.json') {
                            try {
                                unlinkSync(join(fullDirPath, fileInDir));
                                SBprekeyCount++;
                            } catch (e) {
                                console.error(`Error eliminando archivo pre-key de sub-bot ${join(fullDirPath, fileInDir)}:`, e);
                            }
                        }
                    })
                }
            } catch (e) {
                 console.error(`Error leyendo directorio de sub-bot para purgar pre-keys: ${directorio}`, e);
            }
        })
    } catch (err) {
        console.error(chalk.bold.red(`\n╭» 🔴 ${subBotBaseDir} 🔴\n│→ OCURRIÓ UN ERROR DURANTE LA LIMPIEZA DE SUB-BOTS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️❌\n`), err)
    }


    if (SBprekeyCount === 0) {
        console.log(chalk.bold.green(`\n╭» 🟡 ${subBotBaseDir} 🟡\n│→ NADA POR ELIMINAR (Pre-keys)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ✅`))
    } else {
        console.log(chalk.bold.cyanBright(`\n╭» ⚪ ${subBotBaseDir} ⚪\n│→ ARCHIVOS PRE-KEY DE SUB-BOTS ELIMINADOS (${SBprekeyCount} archivos)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`))
    }
}

// Purga archivos antiguos en directorios de sesión (principal y sub-bots)
function purgeOldFiles() {
    const directoriesToClean = [global.sessions || 'sessions', 'OthoJadiBot'].filter(dir => existsSync(`./${dir}`)); // Directorios a revisar

    let totalPurged = 0;

    directoriesToClean.forEach(baseDir => {
         try {
            // Si es el directorio principal, limpia directame<ctrl60>package main.java.com.example;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3Client;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.amazonaws.services.s3.model.S3Object;
import comamazonaws.services.s3.model.S3ObjectInputStream;
import com.amazonaws.util.IOUtils;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
io.IOException;
import java.io.InputStream;
import java.io.Serializable;

/**
 * Saves and loads JSON files to and from Amazon S3.
 *
 * @param <E> the type of entity to save and load.
 */
public class S3JsonFileManager<E extends Serializable> {

  private final AmazonS3 s3Client;
  private final String bucketName;
  private final ObjectMapper objectMapper = new ObjectMapper();

  /**
   * Constructs an S3 JSON file manager.
   *
   * @param accessKey the AWS access key ID.
   * @param secretKey the AWS secret access key.
   * @param region the AWS region.
   * @param bucketName the name of the S3 bucket.
   */
  public S3JsonFileManager(String accessKey, String secretKey, Region region, String bucketName) {
    AWSCredentials credentials = new BasicAWSCredentials(accessKey, secretKey);
    this.s3Client = new AmazonS3Client(credentials);
    this.s3Client.setRegion(region);
    this.bucketName = bucketName;
  }

  /**
   * Saves the given entity as a JSON file in S3.
   *
   * @param key the S3 key for the file.
   * @param entity the entity to save.
   * @throws IOException if an I/O error occurs.
   */
  public void save(String key, E entity) throws IOException {
    byte[] jsonBytes = objectMapper.writeValueAsBytes(entity);
    InputStream inputStream = new ByteArrayInputStream(jsonBytes);

    ObjectMetadata metadata = new ObjectMetadata();
    metadata.setContentLength(jsonBytes.length);
    metadata.setContentType("application/json");

    PutObjectRequest putObjectRequest = new PutObjectRequest(bucketName, key, inputStream, metadata);
    s3Client.putObject(putObjectRequest);
  }

  /**
   * Loads an entity from a JSON file in S3.
   *
   * @param key the S3 key for the file.
   * @param entityClass the class of the entity to load.
   * @return the loaded entity, or null if the file does not exist.
   * @throws IOException if an I/O error occurs.
   */
  public E load(String key, Class<E> entityClass) throws IOException {
    if (!s3Client.doesObjectExist(bucketName, key)) {
      return null;
    }

    S3Object s3Object = s3Client.getObject(bucketName, key);
    S3ObjectInputStream objectInputStream = s3Object.getObjectContent();

    try {
      byte[] jsonBytes = IOUtils.toByteArray(objectInputStream);
      return objectMapper.readValue(jsonBytes, entityClass);
    } catch (JsonParseException | JsonMappingException e) {
      // Handle potential JSON parsing or mapping errors
      throw new IOException("Error parsing JSON from S3 object: " + key, e);
    } finally {
      objectInputStream.close();
    }
  }
}
