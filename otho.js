process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
import './settings.js' // Asegúrate de que settings.js exista y esté correcto con tus configuraciones
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
// Asegúrate de que simple.js exista y esté correcto y exporte makeWASocket, protoType, serialize
import {makeWASocket, protoType, serialize} from './lib/simple.js'
import {Low, JSONFile} from 'lowdb'
// Si usas MongoDB o CloudDB, descomenta e importa los adaptadores necesarios
// import {mongoDB, mongoDBV2} from './lib/mongoDB.js'
// import { cloudDBAdapter } from './lib/cloudDBAdapter.js';
// Asegúrate de que store.js exista y esté correcto
import store from './lib/store.js'
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
// Asegúrate de que protoType y serialize estén implementados en simple.js
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
// Usa opts['prefix'] si está definido, si no, usa el valor por defecto
global.prefix = new RegExp('^[' + (opts['prefix'] || '/.$#!').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

// Configuración de la base de datos LowDB o CloudDB
// Asegúrate de tener las adaptadores (JSONFile, cloudDBAdapter, etc.) instalados
// Si usas CloudDB, descomenta la siguiente línea y ajusta el import
// global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile('storage/databases/database.json'))
// Si usas solo JSONFile, usa esta línea
global.db = new Low(new JSONFile('storage/databases/database.json')) // Ajusta la ruta si es diferente

// Alias para la base de datos global
global.DATABASE = global.db

// Función para cargar la base de datos
global.loadDatabase = async function loadDatabase() {
if (global.db.READ) {
return new Promise((resolve) => setInterval(async function() {
if (!global.db.READ) {
clearInterval(this)
resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
}}, 1 * 1000)) // Esperar 1 segundo para que termine la lectura si ya está en curso
}
if (global.db.data !== null) return // Ya cargada, salir
global.db.READ = true // Marcar como en lectura para evitar lecturas múltiples
await global.db.read().catch(console.error) // Intentar leer desde el archivo/fuente
global.db.READ = null // Desmarcar lectura al terminar (éxito o error)
global.db.data = { // Inicializar datos si están vacíos o cargar los existentes
users: {},
chats: {},
stats: {},
msgs: {},
sticker: {},
settings: {}, // Añadir o asegurar que settings existe
...(global.db.data || {}), // Mantener datos existentes cargados
}
global.db.chain = chain(global.db.data) // Encadenar lodash para consultas más sencillas
}
loadDatabase() // Cargar base de datos al iniciar el script

// Directorio por defecto para la sesión principal del bot (puede ser sobreescrito por opts)
global.sessions = opts._[0] || 'sessions'; // Usar el primer argumento de línea de comandos o 'sessions'

// Directorio para los sub-bots (especificado por el usuario)
global.subBotsDir = 'OthoJadiBot'; // Nombre del directorio para sub-bots

// --- MANEJO DE MULTI-SESIÓN INICIO ---

// Objeto global para almacenar *todas* las instancias de los bots (principal y sub-bots)
// La clave será el nombre del directorio de sesión (ej: 'sessions', 'OthoJadiBot/bot1')
global.allBots = {};

// Logger principal para mensajes generales del script que no son específicos de un bot
const logger = pino({ level: 'silent' }); // Nivel de log global (silencioso por defecto)


// Función para crear y gestionar una única conexión de bot (principal o sub)
async function createBotConnection(sessionDir, isMain = false) {
    const sessionPath = `./${sessionDir}`; // Ruta completa al directorio de sesión

    // --- Manejo de Autenticación Específica para este Bot ---
    const { state, saveCreds: saveState } = await useMultiFileAuthState(sessionPath);
    const msgRetryCounterCache = new NodeCache(); // Cache para reintentos de mensajes para ESTE bot

    // --- Opciones de Conexión para ESTE BOT ---
    const connectionOptions = {
        // Logger específico para esta instancia de bot, nivel info para ver detalles
        logger: pino({ level: 'info' }).child({ class: `${isMain ? 'main' : 'sub'}-${sessionDir}` }),
        // Imprimir QR solo para el bot principal si no hay credenciales y se usó el flag 'qr'
        printQRInTerminal: isMain && !existsSync(`${sessionPath}/creds.json`) && process.argv.includes("qr"),
        mobile: process.argv.includes("mobile"), // Flag mobile (si aplica a ESTE bot)
        // Identificador en WhatsApp
        browser: isMain ? ['Bot Principal', 'Edge', '20.0.04'] : [`Sub-bot ${sessionDir.split('/').pop()}`, 'Edge', '110.0.1587.56'], // Usar solo el nombre de la carpeta para sub-bots
        auth: {
            creds: state.creds, // Credenciales de ESTE bot
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ class: `keys-${sessionDir}` })), // Logger para keys, nivel fatal
        },
        markOnlineOnConnect: true, // Marcar como online al conectar
        generateHighQualityLinkPreview: true,
        getMessage: async (clave) => {
            // Implementación de getMessage para ESTE bot. Puede requerir lógica diferente si los sub-bots tienen stores separados.
            // Usaremos el store global por defecto para simplicidad, puede que no funcione para todos los casos.
            let jid = jidNormalizedUser(clave.remoteJid);
            // Intentar cargar desde el store global (asumiendo que store maneja múltiples bots o es compartido)
            let msg = await store.loadMessage(jid, clave.id).catch(e => {
                 // console.error(`[${sessionDir}] Error loading message from store:`, e); // Opcional: log error loading
                 return undefined; // Devolver undefined si hay error al cargar
            });
             // Si no se encuentra en el store global o no existe, devolver vacío para evitar errores
            return msg?.message || "";
        },
        msgRetryCounterCache, // Cache para reintentos de ESTE bot
        msgRetryCounterMap: new NodeCache(), // Otro cache para reintentos de ESTE bot
        defaultQueryTimeoutMs: undefined,
        version: [2, 3000, 1015901307], // Versión específica de Baileys (puede actualizarse si es necesario)
        // Opciones adicionales si se usan
        // getBusinessMessage: async (clave) => { ... },
        // makeSocket: (config) => new ws.WebSocket({...})
    };

    // Crear la instancia de conexión de Baileys para ESTE bot
    const bot = makeWASocket(connectionOptions);

    // --- Propiedades específicas de la instancia de ESTE bot ---
    bot.isInit = false; // Bandera de inicialización de ESTE bot
    bot.well = false; // Otra bandera (si es usada en handler.js) de ESTE bot
    bot.sessionDir = sessionDir; // Almacenar el nombre del directorio de sesión de ESTE bot
    bot.isMain = isMain; // Bandera para identificar si ESTE es el bot principal

    // --- Lógica de Emparejamiento Inicial (Solo si no existen credenciales) ---
     if (!existsSync(`${sessionPath}/creds.json`)) {
         // Esta parte interactiva es compleja para múltiples bots iniciando por primera vez simultáneamente.
         // Se mantendrá principalmente funcional para el bot principal si necesita registro.
         // Para sub-bots, generalmente se espera que ya tengan una sesión válida al agregarlos a OthoJadiBot.
         // Si un sub-bot necesita emparejarse por primera vez, deberías iniciarlo individualmente
         // o adaptar esta lógica para preguntar por número/QR por cada sub-bot nuevo que detecte sin creds.

         const MethodMobile = process.argv.includes("mobile"); // Verificar flag mobile
         let phoneNumber = global.botNumberCode; // Asumiendo que global.botNumberCode existe para el principal

         // Lógica para emparejar con CÓDIGO (si se usa el flag 'code')
         if (process.argv.includes("code") && !MethodMobile) {
             if (!bot.authState.creds.registered) { // Solo si aún no está registrado ESTE bot
                 // Preguntar por número solo si es el bot principal Y no hay número pre-configurado
                 if (isMain && !phoneNumber) {
                     const colores = chalk.bgMagenta.white;
                     console.log(colores(`\n${chalk.bold.greenBright('🍁 Ingrese el número de WhatsApp para el Bot Principal.')}\n${chalk.bold.cyanBright('🍭  Ejemplo: 521657×××××××')}\n${chalk.bold.magentaBright('---> ')}`));
                     phoneNumber = await new Promise(resolve => {
                         const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                         rl.question('', (input) => {
                             rl.close(); // Cerrar readline después de obtener el número
                             resolve(input);
                         });
                     });
                      phoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Limpiar número
                 } else if (phoneNumber) {
                      phoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Limpiar número si ya estaba pre-configurado
                 }

                 // Solicitar código de emparejamiento si se tiene un número válido
                 if (phoneNumber && Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
                      setTimeout(async () => {
                          try {
                               let codigo = await bot.requestPairingCode(phoneNumber);
                               codigo = codigo?.match(/.{1,4}/g)?.join("-") || codigo;
                               console.log(chalk.bold.white(chalk.bgMagenta(`⭐️ Código para ${sessionDir}: `)), chalk.bold.white(chalk.white(codigo)));
                          } catch (error) {
                               console.error(chalk.bold.red(`Error solicitando código para ${sessionDir}: ${error}`));
                               // Manejar error en la solicitud del código
                          }
                      }, 3000); // Esperar 3 segundos
                 } else if (phoneNumber) { // Si se ingresó número pero es inválido según MCC
                      console.error(chalk.bold.redBright(`Número de teléfono inválido para ${sessionDir}: ${phoneNumber}`));
                 } else { // Si no se pudo obtener número (no pre-configurado y no se preguntó/ingresó)
                      console.warn(chalk.yellow(`[${sessionDir}] No se pudo obtener un número válido para emparejar por código.`));
                 }
             }
         } else if (process.argv.includes("qr")) {
              // Lógica para emparejar con QR (si se usa el flag 'qr')
              // El QR se imprimirá automáticamente por Baileys si printQRInTerminal es true
              console.log(chalk.yellow(`[${sessionDir}] Esperando código QR...`));
         } else if (!isMain) {
              // Si es un sub-bot, no tiene creds y no se usaron flags de registro
              console.warn(chalk.yellow(`[SUB-BOT] No se encontraron credenciales para ${sessionDir} y no se especificó QR/Código. Por favor, asegúrese de que la sesión esté registrada o elimine la carpeta e inicie este sub-bot individualmente para emparejarlo.`));
         } else {
              // Si es el bot principal, no tiene creds, y no se usaron flags de registro
               console.warn(chalk.yellow(`[BOT PRINCIPAL] No se encontraron credenciales para ${sessionDir} y no se especificó QR/Código. Por favor, use los flags 'qr' o 'code' al iniciar.`));
         }
     }


    // --- Manejo de Eventos de Conexión para ESTE BOT ---
    // Este listener maneja el estado de conexión (connecting, open, close) para ESTA instancia
    bot.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, isNewLogin } = update;
        bot.stopped = connection; // Actualizar el estado 'stopped' de ESTA instancia

        if (isNewLogin) bot.isInit = true; // Marcar como nuevo login para ESTA instancia

        const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

        if (connection == 'open') {
             console.log(boxen(chalk.bold(`¡CONECTADO con ${sessionDir}! (${bot.user?.id.split(':')[0]})`), { borderStyle: 'round', borderColor: 'green', title: chalk.green.bold('● CONEXIÓN ●'), titleAlignment: 'center' }));
        } else if (connection === 'close') {
             let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
             console.error(chalk.bold.redBright(`\n⚠️ Conexión para ${sessionDir} cerrada. Razón: ${reason || 'Desconocida'}`));

            // --- Lógica de Reconexión/Manejo de Desconexión para ESTE BOT ---
            if (reason === DisconnectReason.connectionClosed ||
                reason === DisconnectReason.connectionLost ||
                reason === DisconnectReason.restartRequired ||
                reason === DisconnectReason.timedOut) {
                 console.log(chalk.yellow(`[${sessionDir}] Intentando reconectar en 5 segundos...`));
                 // Pequeño retraso antes de intentar reconectar
                 setTimeout(() => createBotConnection(sessionDir, isMain), 5000); // Intentar crear una *nueva* conexión para esta sesión
            } else if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                 // Estas razones suelen significar que la sesión es inválida y necesita re-emparejarse manualmente
                 console.error(chalk.bold.cyanBright(`\n⚠️ SESIÓN INVÁLIDA para ${sessionDir}. Elimine la carpeta "${sessionDir}" y re-empareje.`));
                 // Eliminar la referencia de este bot de la lista global ya que la sesión es inválida y no se reconectará automáticamente
                 if (global.allBots[sessionDir]) {
                     console.log(chalk.red(`[${sessionDir}] Removiendo instancia inválida de global.allBots.`));
                     delete global.allBots[sessionDir];
                 }
                 // Opcional: Eliminar archivos de sesión inválidos (habilitar con precaución)
                 /*
                 if (existsSync(sessionPath)) {
                     console.log(chalk.red(`[${sessionDir}] Eliminando directorio de sesión inválido: ${sessionPath}`));
                      fsp.rm(sessionPath, { recursive: true, force: true }).catch(console.error);
                 }
                 */
            } else if (reason === DisconnectReason.connectionReplaced) {
                 console.error(chalk.bold.redBright(`\n⚠️ Conexión para ${sessionDir} reemplazada. Otra sesión abierta en otro lugar.`));
                 // Eliminar la referencia de este bot, no intentar reconectar automáticamente
                 if (global.allBots[sessionDir]) {
                     console.log(chalk.red(`[${sessionDir}] Removiendo instancia reemplazada de global.allBots.`));
                     delete global.allBots[sessionDir];
                 }
            } else {
                 // Otras razones no manejadas, intentar reconectar por si acaso
                 console.warn(chalk.yellow(`[${sessionDir}] Desconectado por razón no manejada ${reason}. Intentando reconectar en 5 segundos...`));
                 setTimeout(() => createBotConnection(sessionDir, isMain), 5000); // Intentar crear una *nueva* conexión
            }
             // --- Fin Lógica de Reconexión ---
        }
    });
    // --- Fin Eventos de Conexión ---


    // --- Adjuntar otros Eventos para ESTE BOT ---

    // Evento para mensajes entrantes. Creamos una función wrapper para pasar la instancia `bot`.
    // Almacenamos la referencia del wrapper para poder removerla al recargar el handler.
    bot.__messagesUpsertListener = async (messages) => {
         // Llamar al handler principal, pasándole la instancia 'bot' actual
         if (global.handler && typeof global.handler.handler === 'function') {
              // El handler debe esperar 'bot' como primer argumento: async function handler(bot, messages, m)
              try {
                  await global.handler.handler(bot, messages); // Pasar la instancia del bot y los mensajes
              } catch (e) {
                   console.error(chalk.red(`[${sessionDir}] Error en handler para mensaje:`), e);
              }
         } else {
              console.error(chalk.red(`[${sessionDir}] Handler function not loaded or not found.`));
         }
    };
    // Adjuntar el listener messages.upsert a ESTA instancia
    bot.ev.on('messages.upsert', bot.__messagesUpsertListener);


    // Evento para actualizar credenciales (guardar sesión) para ESTE BOT
    bot.ev.on('creds.update', saveState); // Usar la función saveState específica de useMultiFileAuthState para ESTE bot


    // Añadir la instancia del bot a la colección global. Se añade aquí porque la instancia ya existe,
    // aunque la conexión aún no esté 'open'. Los listeners ya están adjuntos.
    // Si la creación falló fatalmente antes, no llegará a este punto.
    global.allBots[sessionDir] = bot;
    console.log(chalk.cyan(`[${sessionDir}] Instancia de bot creada y añadida a global.allBots.`));


    return bot; // Devolver la instancia creada
}

// --- Función principal para iniciar todas las conexiones de bots ---
async function startAllBots() {
    console.log(chalk.bold.white(boxen(chalk.bold('Iniciando Bots Multi-Sesión'), { borderStyle: 'double', padding: 1, margin: 1, float: 'center', align: 'center', borderColor: 'blue' })));

    // --- 1. Verificar y iniciar el bot principal ---
    const mainSessionDir = global.sessions || 'sessions'; // Directorio de sesión principal

    if (existsSync(`./${mainSessionDir}`)) {
        console.log(chalk.bold.blue(`\nVerificando directorio de sesión principal: ./${mainSessionDir}...`));
        // Siempre intentar crear la conexión principal. createBotConnection manejará si necesita registro.
         await createBotConnection(mainSessionDir, true);
    } else {
        console.warn(chalk.bold.yellow(`Directorio de sesión principal "${mainSessionDir}" no encontrado. Creando y iniciando registro...`));
         try {
             await fsp.mkdir(`./${mainSessionDir}`, { recursive: true }); // Crear directorio si no existe de forma asíncrona
             await createBotConnection(mainSessionDir, true); // Iniciar registro en el nuevo directorio
         } catch(e) {
             console.error(chalk.red(`Error al crear directorio de sesión principal ${mainSessionDir}:`), e);
         }
    }

    // --- 2. Verificar y iniciar los sub-bots ---
    const subBotBaseDir = 'OthoJadiBot'; // Directorio base para sub-bots
    if (existsSync(`./${subBotBaseDir}`)) {
        console.log(chalk.bold.blue(`\nEscaneando directorio de sub-bots: ./${subBotBaseDir}...`));
        try {
            const subBotEntries = readdirSync(`./${subBotBaseDir}`); // Leer contenido de OthoJadiBot (síncrono)
            const sessionFolders = subBotEntries.filter(item => {
                const itemPath = join(`./${subBotBaseDir}`, item);
                // Verificar si es un directorio Y si contiene creds.json
                try {
                    return statSync(itemPath).isDirectory() && existsSync(join(itemPath, 'creds.json'));
                } catch(e) {
                     console.error(chalk.red(`Error al verificar entrada en sub-bots: ${itemPath}`), e);
                     return false; // Si hay error, no considerar como directorio de sesión
                }
            });

            if (sessionFolders.length > 0) {
                console.log(chalk.bold.blue(`Se encontraron ${sessionFolders.length} sesiones de sub-bots válidas.`));
                for (const folder of sessionFolders) {
                    const sessionDir = join(subBotBaseDir, folder); // Path completo como OthoJadiBot/bot1
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
            // Verificar si la instancia es válida antes de acceder a sus propiedades
            const status = (bot && bot.user && bot.stopped !== 'close') ? '✅ Conectado/Iniciando' : '🟡 Intentando Conectar/Fallo Inicial';
            const type = bot?.isMain ? 'Principal' : 'Sub-bot';
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


// --- Manejo de Errores No Capturados ---
process.on('uncaughtException', console.error)


// --- Carga Inicial y Recarga de Handler ---

// Cargar el archivo handler.js (inicialmente y para recargas)
let handler = null; // Inicializar handler como null
try {
    handler = await import('./handler.js'); // Intentar importar handler.js inicialmente
    console.log(chalk.green('handler.js cargado exitosamente al inicio.'));
} catch (e) {
    console.error(chalk.red("Error al cargar handler.js inicial:"), e);
    // El script continuará, pero los mensajes no serán procesados sin handler
}


// --- Función para recargar el handler.js y re-adjuntar listeners a TODOS los bots ---
global.reloadHandler = async function(restatConn = false) { // restatConn (reiniciar conexión principal) es opcional
  console.log(chalk.yellow('Recargando handler y re-adjuntando listeners a todos los bots...'));
  try {
    // Importar handler.js usando un query param único para evitar caché del módulo
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(e => {
         console.error(chalk.red("Error al recargar handler.js:"), e);
         return null; // Devolver null si hay error en la recarga
    });
    // Si la recarga fue exitosa y exporta algo, actualizar la referencia global del handler
    if (Handler && typeof Handler.handler === 'function') { // Verificar si la recarga es válida y tiene la función handler
         global.handler = Handler;
         console.log(chalk.green('handler.js recargado exitosamente.'));
    } else if (Handler === null) {
         console.error(chalk.red('La recarga de handler.js falló. Usando la versión anterior (si existe).'));
         // Si la recarga falla, mantenemos el handler anterior (si ya estaba cargado).
    } else {
         console.warn(chalk.yellow('handler.js recargado, pero no exporta la función handler válida. Usando la versión anterior.'));
          // Si la recarga es exitosa pero el archivo no tiene la estructura esperada
    }

  } catch (e) {
    console.error(chalk.red('Error inesperado al recargar handler:'), e);
    // En caso de error inesperado, mantenemos el handler anterior.
  }

  // Si se pide reiniciar la conexión principal (opcional en multi-bot, afecta solo al principal)
  if (restatConn) {
      const mainBot = Object.values(global.allBots).find(bot => bot.isMain);
      if (mainBot) {
          console.log(chalk.yellow('Reiniciando conexión del bot principal...'));
          // La lógica de reconexión dentro de connection.update ya maneja la recreación de la instancia.
          // Forzar una desconexión limpia podría ser una opción, pero requiere más manejo.
          // Por ahora, la reconexión automática de connection.update es la que recrea la conexión.
          // Podrías implementar bot.ws.close() aquí para forzar el ciclo close -> reconnect
           try {
               mainBot.ws.close();
           } catch (e) {
               console.error("Error cerrando WS del bot principal para reiniciar:", e);
           }
      } else {
          console.warn(chalk.yellow("No se encontró el bot principal para reiniciar la conexión."));
      }
  }

  // --- Re-adjuntar nuevos listeners de mensajes a TODOS los bots activos ---
   console.log(chalk.gray('Re-adjuntando listeners de mensajes a todos los bots activos...'));
   let reattachedCount = 0;
   let skippedCount = 0;

   for (const sessionDir in global.allBots) {
         const bot = global.allBots[sessionDir];
         // Solo re-adjuntar si la instancia existe y tiene el objeto de eventos
         if (bot && bot.ev) {
             // 1. Remover el listener antiguo usando la referencia almacenada
             if (bot.__messagesUpsertListener) {
                 try {
                    bot.ev.off('messages.upsert', bot.__messagesUpsertListener);
                    // console.log(chalk.gray(`Listener antiguo removido para ${sessionDir}.`)); // Opcional: log
                    delete bot.__messagesUpsertListener; // Limpiar la referencia antigua
                 } catch (e) {
                     console.warn(chalk.yellow(`[RELOAD] Error al remover listener antiguo de ${sessionDir}:`), e);
                 }
             }

             // 2. Adjuntar el nuevo listener si el handler principal es válido
             if (global.handler && typeof global.handler.handler === 'function') {
                 // Creamos una nueva función wrapper y almacenamos su referencia
                 bot.__messagesUpsertListener = async (messages) => {
                      try {
                          await global.handler.handler(bot, messages); // Llamar al handler principal
                      } catch (e) {
                           console.error(chalk.red(`[${sessionDir}] Error en handler (re-adjuntado):`), e);
                      }
                 };
                 // Adjuntar el nuevo listener
                 bot.ev.on('messages.upsert', bot.__messagesUpsertListener);
                 // console.log(chalk.gray(`Listener nuevo adjuntado para ${sessionDir}.`)); // Opcional: log
                 reattachedCount++;
             } else {
                  console.warn(chalk.yellow(`[RELOAD] No se pudo adjuntar listener a ${sessionDir}: Handler principal no válido.`));
                  skippedCount++;
             }
         } else {
             console.warn(chalk.yellow(`[RELOAD] Saltando re-adjuntar listener a ${sessionDir}: Instancia de bot no válida.`));
             skippedCount++;
         }
    }
    console.log(chalk.gray(`Listeners re-adjuntados a ${reattachedCount} bots, ${skippedCount} bots saltados.`));


  console.log(chalk.green('Recarga de handler y listeners completada.'));
  return true; // Indica éxito en la recarga/re-adjunte (no garantiza que todos los bots estén conectados)
};
// --- Fin Función para recargar handler.js ---


// --- Carga Inicial de Plugins ---
const pluginFolder = global.__dirname(join(__dirname, './plugins/index')) // Directorio de plugins
const pluginFilter = (filename) => /\.js$/.test(filename) && !filename.startsWith('_'); // Filtro para archivos .js que no empiezan con _
global.plugins = {} // Objeto global para almacenar plugins

async function filesInit() {
  console.log(chalk.blue(`Cargando plugins desde ${pluginFolder}...`));
  const pluginFiles = readdirSync(pluginFolder).filter(pluginFilter);
  let loadedCount = 0;
  let errorCount = 0;

  for (const filename of pluginFiles) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(file); // Importar el módulo del plugin
      global.plugins[filename] = module.default || module; // Usar default export o el módulo completo
      // console.log(chalk.gray(`Plugin cargado: ${filename}`)); // Opcional: log cada plugin
      loadedCount++;
    } catch (e) {
      console.error(chalk.red(`Error al cargar plugin ${filename}:`), e);
      delete global.plugins[filename]; // Eliminar de la lista si falla la carga
      errorCount++;
    }
  }
   // Ordenar plugins alfabéticamente (opcional)
   global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
   console.log(chalk.green(`Carga de plugins completada. ${loadedCount} cargados, ${errorCount} con errores.`));
}
// filesInit().catch(console.error) // Se llama después de startAllBots


// --- Función para recargar plugins individualmente ---
global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) { // Verificar si es un archivo .js válido
    const dir = global.__filename(join(pluginFolder, filename), true); // Ruta real del archivo
    const isDeleted = !existsSync(dir); // Verificar si el archivo fue eliminado

    if (filename in global.plugins) {
      if (!isDeleted) console.log(chalk.yellow(`Actualizando plugin - '${filename}'`))
      else console.log(chalk.red(`Eliminando plugin - '${filename}'`))
    } else if (!isDeleted) {
         console.log(chalk.green(`Nuevo plugin - '${filename}'`));
    } else {
         // Se eliminó un archivo que no era un plugin cargado? Ignorar.
         return;
    }

    // Eliminar el plugin si el archivo fue borrado
    if (isDeleted) {
        delete global.plugins[filename];
        console.log(chalk.bold.green(`✅ Plugin eliminado: ${filename}`));
    } else {
        // Verificar errores de sintaxis antes de importar
        const err = syntaxerror(readFileSync(dir), filename, {
          sourceType: 'module', // Tipo de módulo ES
          allowAwaitOutsideFunction: true, // Permitir await en nivel superior
        });
        if (err) console.error(chalk.red(`Error de sintaxis en '${filename}':\n${format(err)}`))
        else {
          try {
            // Importar el módulo del plugin nuevamente (con cache busting)
            const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
            global.plugins[filename] = module.default || module; // Asignar el plugin recargado
            console.log(chalk.bold.green(`✅ Plugin cargado/actualizado: ${filename}`));
          } catch (e) {
            console.error(chalk.red(`Error al cargar plugin '${filename}':\n${format(e)}`))
          }
        }
    }

    // Re-ordenar plugins alfabéticamente (opcional)
    global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));

    // Después de recargar plugins, el handler.js podría depender de ellos.
    // Necesitamos recargar el handler y re-adjuntar a todas las conexiones activas.
    await global.reloadHandler(false); // Recargar handler sin reiniciar conexión
  }
}
// --- Fin Función para recargar plugins ---

// Observar la carpeta de plugins en busca de cambios (para recarga automática)
watch(pluginFolder, global.reload)

// --- Funciones de Limpieza Existentes ---

// Limpia archivos temporales en ./tmp y directorios tmp dentro de sesiones
function clearTmp() {
    const tmpDirs = [join(__dirname, 'tmp')];
    // Añadir carpetas tmp dentro de los directorios de sesiones si existen
    const mainSessionTmp = join(__dirname, global.sessions || 'sessions', 'tmp');
    if (existsSync(mainSessionTmp)) tmpDirs.push(mainSessionTmp);

    const subBotBaseDir = join(__dirname, global.subBotsDir); // Usar global.subBotsDir
    if (existsSync(subBotBaseDir)) {
        readdirSync(subBotBaseDir).forEach(item => {
            const itemPath = join(subBotBaseDir, item);
            try {
                // Si es un directorio de sesión de sub-bot (contiene creds.json)
                if (statSync(itemPath).isDirectory() && existsSync(join(itemPath, 'creds.json'))) {
                    const subBotTmp = join(itemPath, 'tmp');
                    if (existsSync(subBotTmp)) tmpDirs.push(subBotTmp);
                }
            } catch(e) {
                console.error(chalk.red(`Error al inspeccionar directorio en ${global.subBotsDir} para limpieza tmp: ${item}`), e);
            }
        });
    }


    let cleanedCount = 0;
    tmpDirs.forEach(dir => {
        if (!existsSync(dir)) return; // Si el directorio no existe, saltar

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
    const sessionDir = global.sessions || 'sessions'; // Directorio de sesión principal
    if (!existsSync(`./${sessionDir}`)) {
        console.warn(chalk.yellow(`Saltando purgeSession: Directorio principal "${sessionDir}" no encontrado.`));
        return;
    }
    let prekeyCount = 0;
    try {
        const files = readdirSync(`./${sessionDir}`);
        // Identifica archivos pre-key (ej: pre-key-123.json)
        const filesToDelete = files.filter(file => file.startsWith('pre-key-') && file.endsWith('.json')); // Asegurar que termina en .json

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

// Limpia pre-keys de los sub-bots (OthoJadiBot subdirectorios)
function purgeSessionSB() {
    const subBotBaseDir = global.subBotsDir; // Directorio base para sub-bots
    if (!existsSync(`./${subBotBaseDir}`)) {
        console.warn(chalk.yellow(`Saltando purgeSessionSB: Directorio de sub-bots "${subBotBaseDir}" no encontrado.`));
        return;
    }
    let SBprekeyCount = 0;
    try {
        const listaDirectorios = readdirSync(`./${subBotBaseDir}/`); // Lee entradas en OthoJadiBot
        listaDirectorios.forEach(directorio => {
            const fullDirPath = join(`./${subBotBaseDir}`, directorio);
            try {
                // Si es un directorio Y parece un directorio de sesión (contiene creds.json)
                if (statSync(fullDirPath).isDirectory() && existsSync(join(fullDirPath, 'creds.json'))) {
                     const filesInDir = readdirSync(fullDirPath);
                     const DSBPreKeys = filesInDir.filter(fileInDir => {
                         // Identifica pre-keys .json
                         return fileInDir.startsWith('pre-key-') && fileInDir.endsWith('.json');
                     })
                     DSBPreKeys.forEach(fileInDir => {
                         // Asegúrate de NO eliminar creds.json
                         if (fileInDir !== 'creds.json') { // Esta condición es redundante por el filtro startWith('pre-key-'), pero es una seguridad extra
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
                 console.error(`Error leyendo entrada en directorio de sub-bot ${directorio} para purgar pre-keys:`, e);
            }
        })
    } catch (err) {
        console.error(chalk.bold.red(`\n╭» 🔴 ${subBotBaseDir} 🔴\n│→ OCURRIÓ UN ERROR DURANTE LA LIMPIEZA DE SUB-BOTS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️❌\n`), err)
    }


    if (SBprekeyCount > 0) {
        console.log(chalk.bold.cyanBright(`\n╭» ⚪ ${subBotBaseDir} ⚪\n│→ ARCHIVOS PRE-KEY DE SUB-BOTS ELIMINADOS (${SBprekeyCount} archivos)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`))
    } else {
         console.log(chalk.bold.green(`\n╭» 🟡 ${subBotBaseDir} 🟡\n│→ NADA POR ELIMINAR (Pre-keys)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ✅`))
    }
}

// Purga archivos antiguos (no creds.json o pre-keys) en directorios de sesión (principal y sub-bots)
// NOTA: Esta función elimina *todos* los archivos en los directorios especificados EXCEPTO creds.json.
// Úsala con precaución, ya que podría eliminar archivos necesarios si no son creds.json.
function purgeOldFiles() {
    const directoriesToClean = [global.sessions || 'sessions', global.subBotsDir].filter(dir => existsSync(`./${dir}`)); // Directorios a revisar (principal y sub-bots base)

    let totalPurged = 0;

    directoriesToClean.forEach(baseDir => {
         try {
            // Si es el directorio principal, limpia directame<ctrl60>package com.main.java.example;

import com.amazonaws.auth.AWSCredentials;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3Client;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import com.amazonaws.services.s3.model.S3Object;
import com.amazonaws.services.s3.model.S3ObjectInputStream;
import com.amazonaws.util.IOUtils;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
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
