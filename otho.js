process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
// Asegúrate de que settings.js exista y esté correcto con tus configuraciones
import './settings.js'

import {createRequire} from 'module'
import path, {join} from 'path'
import {fileURLToPath, pathToFileURL} from 'url'
import {platform} from 'process'
import * as ws from 'ws'

// *** CORRECCIÓN DEL ERROR "identifier fs has already been declared" ***
// Importa el módulo fs completo como 'fs'
import fs from 'fs';
// Importa las funciones síncronas específicas que necesitas directamente
import {
    readdirSync,
    statSync,
    unlinkSync,
    existsSync,
    readFileSync,
    rmSync,
    watch // Watch es usado para recarga de plugins
} from 'fs';
// Importa la API basada en promesas como 'fsp'
import { promises as fsp } from 'fs';
// *** FIN CORRECCIÓN ***


import yargs from 'yargs'
import {spawn} from 'child_process'
import lodash from 'lodash'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import {tmpdir} from 'os' // Importa tmpdir
import os from 'os'; // Asegura que os también está importado si usas os.tmpdir
import {format} from 'util'
// Si usas boxen, descomenta
// import boxen from 'boxen'

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
const {DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, jidNormalizedUser, PHONENUMBER_MCC} = await import('@whiskeysockets/baileys')

import readline from 'readline'
import NodeCache from 'node-cache'

const {CONNECTING} = ws
const {chain} = lodash
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true))
}; global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

global.timestamp = {start: new Date}

const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
// Define el prefijo de comandos (ajusta según necesites)
// Usa opts['prefix'] si está definido, si no, usa el valor por defecto '/.$#!'
global.prefix = new RegExp('^[' + (opts['prefix'] || '/.$#!').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

// Configuración de la base de datos LowDB o CloudDB
// Asegúrate de tener los adaptadores (JSONFile, cloudDBAdapter, etc.) instalados
// Si usas CloudDB, descomenta la siguiente línea y ajusta el import
// global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile('storage/databases/database.json'))
// Si usas solo JSONFile, usa esta línea
global.db = new Low(new JSONFile('storage/databases/database.json')) // Ajusta la ruta si es diferente

// Alias para la base de datos global
global.DATABASE = global.db

// Función para cargar la base de datos
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => setInterval(async function () {
    if (!global.db.READ) {
      clearInterval(this)
      resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
    }
  }, 1 * 1000)) // Esperar 1 segundo para que termine la lectura si ya está en curso
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
    ...(global.db.data || {}) // Mantener datos existentes cargados
  }
  global.db.chain = chain(global.db.data) // Encadenar lodash para consultas más sencillas
}
loadDatabase() // Cargar base de datos al iniciar el script

global.authFile = `sessions`
const { state, saveCreds } = await useMultiFileAuthState(global.authFile)

const { version } = await fetchLatestBaileysVersion()

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver))

// Suprimir console.info predeterminado para una salida más limpia
console.info = () => {}
const logger = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
}).child({ class: "client" })
logger.level = "fatal" // Establecer nivel de log inicial

  const connectionOptions = {
    version: [2, 3000, 1015901307], // Usar una versión fija si fetchLatestBaileysVersion es lento o falla
    logger,
    printQRInTerminal: false, // Configurar a true si quieres imprimir QR para el bot principal
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: false, // Parece un typo, debería ser true o false. Mantener false como estaba
    generateHighQualityLinkPreview: true,
    syncFullHistory: true, // Considerar establecer esto en false para un inicio más rápido si no es necesario
    retryRequestDelayMs: 10,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
    defaultQueryTimeoutMs: undefined,
    maxMsgRetryCount: 15,
    appStateMacVerification: {
      patch: false, // Ajusta si tienes problemas de verificación
      snapshot: false, // Ajusta si tienes problemas de verificación
    },
    getMessage: async (key) => {
      // Esta función es utilizada por Baileys para obtener mensajes antiguos para el contexto de respuesta
      const jid = jidNormalizedUser(key.remoteJid)
      // Asumiendo que el bot principal utiliza un store que puede recuperar mensajes
      const msg = await store.loadMessage(jid, key.id)
      return msg?.message || "" // Devolver el mensaje encontrado o vacío
    },
  }

global.conn = makeWASocket(connectionOptions)

if (!conn.authState.creds.registered) {
  // Esta lógica de código de emparejamiento es solo para el bot principal
  const phoneNumber = await question(chalk.blue('Ingresa el número de WhatsApp en el cual estará la Bot principal (Ej: 521xxxxxxxxx):\n'))

  if (conn.requestPairingCode && phoneNumber) {
    let code = await conn.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''))
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    console.log(chalk.cyan(`Su código es:`, code))
    rl.close(); // Cerrar readline después de obtener el número de teléfono para el bot principal
  } else {
     console.log(chalk.yellow("Por favor, escanee el código QR para el bot principal si el código de emparejamiento no es compatible o no se ingresó un número."));
     // Baileys imprimirá el QR automáticamente si printQRInTerminal es true
  }
} else {
   rl.close(); // Cerrar readline si el bot principal ya está registrado
}


conn.isInit = false
conn.well = false

// Objeto global para mantener las conexiones de los sub-bots
global.subBots = {};

// Función para iniciar la conexión de un solo sub-bot
async function startSubBot(sessionName) {
    // *** CAMBIO AQUÍ: Buscar en OthoJadiBot en lugar de serbot ***
    const sessionDir = join(__dirname, 'OthoJadiBot', sessionName);
    console.log(chalk.yellow(`Intentando iniciar sub-bot: ${sessionName}`));

    if (!existsSync(sessionDir)) {
        console.error(chalk.red(`Directorio de sesión del sub-bot no encontrado: ${sessionDir}`));
        return;
    }
    // Verificar si ya está corriendo
    if (global.subBots[sessionName] && global.subBots[sessionName].user) {
         console.log(chalk.yellow(`El sub-bot ${sessionName} ya está corriendo.`));
         return;
    }


    try {
        const { state: subState, saveCreds: saveSubCreds } = await useMultiFileAuthState(sessionDir);
        const subBotLogger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: `subBot-${sessionName}` });
        subBotLogger.level = "info"; // Cambiado a info para ver más detalles del sub-bot

        const subConnectionOptions = {
            // Usar las mismas opciones de conexión que el bot principal, pero con el estado y logger del sub-bot
            version: [2, 3000, 1015901307], // Usar la misma versión fija
            logger: subBotLogger,
            printQRInTerminal: false, // No imprimir QR para sub-bots, asumir que ya están emparejados
            auth: {
                creds: subState.creds,
                keys: makeCacheableSignalKeyStore(subState.keys, subBotLogger),
            },
            browser: Browsers.ubuntu("Chrome"), // Mismo navegador
            markOnlineOnConnect: false, // Misma configuración
            generateHighQualityLinkPreview: true, // Misma configuración
            syncFullHistory: false, // Establecer en false para un inicio más rápido del sub-bot
            retryRequestDelayMs: 10, // Misma configuración
            transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 }, // Misma configuración
            defaultQueryTimeoutMs: undefined, // Misma configuración
            maxMsgRetryCount: 15, // Misma configuración
             appStateMacVerification: {
                patch: false,
                snapshot: false,
             },
            getMessage: async (key) => {
                 // Para sub-bots, es más simple no implementar la obtención de mensajes a menos que tengan stores separados
                return ""; // Devolver vacío
            },
        };

        const subBotConn = makeWASocket(subConnectionOptions);
        global.subBots[sessionName] = subBotConn; // Almacenar la conexión

        // Handler de actualización de conexión del sub-bot
        const subBotConnectionUpdate = async (update) => {
            const { connection, lastDisconnect, isNewLogin } = update;
            if (isNewLogin) subBotConn.isInit = true;
            const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

            if (connection === 'open') {
                console.log(chalk.green(`Sub-bot ${sessionName} conectado.`));
            } else if (connection === 'close') {
                let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                 subBotLogger.error(`Sub-bot ${sessionName} desconectado. Razón: ${reason || 'Desconocida'}`);

                // Intentar reconectar después de un retraso si no es logged out o bad session
                if (reason === DisconnectReason.connectionClosed ||
                    reason === DisconnectReason.connectionLost ||
                    reason === DisconnectReason.restartRequired ||
                    reason === DisconnectReason.timedOut) {
                     console.log(chalk.yellow(`Intentando reconectar sub-bot ${sessionName} en 5 segundos...`));
                     // Pequeño retraso antes de intentar reconectar
                     setTimeout(() => startSubBot(sessionName), 5000);
                } else if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                     console.error(chalk.red(`El sub-bot ${sessionName} requiere re-emparejamiento o la sesión es inválida. Elimine ${sessionDir} e inicie manualmente si es necesario.`));
                     delete global.subBots[sessionName]; // Eliminar de la lista activa
                     // Considerar eliminar el directorio de sesión si la razón es logged out o bad session? Tener cuidado.
                     // if (existsSync(sessionDir)) {
                     //     console.log(chalk.red(`Eliminando directorio de sesión inválido: ${sessionDir}`));
                     //     await fsp.rm(sessionDir, { recursive: true, force: true }).catch(console.error); // Usar fsp para promesas
                     // }
                } else if (reason === DisconnectReason.connectionReplaced) {
                     console.error(chalk.red(`La conexión del sub-bot ${sessionName} fue reemplazada. Se abrió otra sesión en otro lugar.`));
                     // No reiniciar automáticamente, requiere intervención manual o una estrategia específica
                     delete global.subBots[sessionName]; // Eliminar de la lista
                } else {
                     console.warn(chalk.yellow(`El sub-bot ${sessionName} se desconectó por una razón no manejada ${reason}. Intentando reconectar en 5 segundos...`));
                     setTimeout(() => startSubBot(sessionName), 5000);
                }
            }
        };


        // Adjuntar listeners de eventos para el sub-bot
        subBotConn.ev.on('connection.update', subBotConnectionUpdate);
        subBotConn.ev.on('creds.update', saveSubCreds);
        // Adjuntar el handler principal al sub-bot. 'this' dentro del handler se referirá a 'subBotConn'.
        // Almacenar la referencia para poder removerla al recargar el handler.
        subBotConn.__handlerRef = handler.handler.bind(subBotConn);
        subBotConn.ev.on('messages.upsert', subBotConn.__handlerRef);

         console.log(chalk.cyan(`Listeners de eventos inicializados para el sub-bot ${sessionName}.`));

    } catch (e) {
        console.error(chalk.red(`Error al iniciar sub-bot ${sessionName}:`), e);
        delete global.subBots[sessionName]; // Eliminar de la lista si la inicialización falló
    }
}


if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write().catch(console.error); // Manejar error de escritura DB
      // Asegurarse de que autocleartmp se maneje correctamente
      if (opts['autocleartmp']) {
        // *** CAMBIO AQUÍ: Incluir OthoJadiBot/tmp en la limpieza ***
        const tmpDirs = [tmpdir(), join(__dirname, 'tmp'), join(__dirname, 'OthoJadiBot', 'tmp')]; // Incluir OthoJadiBot/tmp
        tmpDirs.forEach(dir => {
           if (existsSync(dir)) {
             // Usar el comando find para eliminar archivos con más de 3 minutos
             spawn('find', [dir, '-amin', '3', '-type', 'f', '-delete'], { stdio: 'inherit' });
           }
        });
      }
    }, 30 * 1000); // Cada 30 segundos
  }
}

function clearTmp() {
  const tmp = [join(__dirname, './tmp')];
  // Opcionalmente, añadir un bucle aquí para limpiar también las carpetas tmp dentro de los subdirectorios de OthoJadiBot
  // *** CAMBIO AQUÍ: Escanear OthoJadiBot en lugar de serbot para tmp ***
  const subBotBaseDir = join(__dirname, 'OthoJadiBot');
  if (existsSync(subBotBaseDir)) {
      const subDirs = readdirSync(subBotBaseDir);
      subDirs.forEach(itemName => {
          const itemPath = join(subBotBaseDir, itemName);
           try {
               const stats = statSync(itemPath);
                // Si es un directorio de sesión de sub-bot (contiene creds.json)
               if (stats.isDirectory() && existsSync(join(itemPath, 'creds.json'))) {
                   tmp.push(join(itemPath, 'tmp')); // Añadir su carpeta tmp
               }
           } catch (e) {
               console.error(chalk.red(`Error al inspeccionar directorio en OthoJadiBot para limpieza tmp: ${itemName}`), e);
           }
      });
  }

  const filename = [];
  tmp.forEach((dirname) => {
      if(existsSync(dirname)) { // Verificar si el directorio existe
          try {
              readdirSync(dirname).forEach((file) => filename.push(join(dirname, file)))
          } catch (e) {
               console.error(chalk.red(`Error leyendo directorio temporal ${dirname} para limpieza:`), e);
          }
      }
  })

  let cleanedCount = 0;
  return filename.map((file) => {
    try {
        const stats = statSync(file)
        // Eliminar archivos con más de 3 minutos
        if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) {
             // console.log(chalk.gray(`Limpiando archivo temporal antiguo: ${file}`)); // Puede generar mucho log
             unlinkSync(file);
             cleanedCount++;
             return true;
        }
    } catch (e) {
        console.error(chalk.red(`Error limpiando archivo temporal ${file}:`), e);
    }
    return false;
  }).filter(Boolean); // Filtrar las eliminaciones exitosas
}

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) {
      // También verificar si hay sub-bots corriendo
      const activeSubBots = Object.values(global.subBots).filter(bot => bot && bot.user && bot.stopped !== 'close');
      if (activeSubBots.length === 0 && (stopped === 'close' || !conn || !conn.user)) {
         // Si el bot principal está detenido y no hay sub-bots activos, ¿quizás dejar de limpiar?
         // O simplemente continuar limpiando archivos temporales independientemente del estado del bot?
         // Continuaremos limpiando archivos temporales independientemente.
      }
  }
  await clearTmp(); // Limpiar archivos tmp periódicamente
   // console.log(chalk.bold.cyanBright(`\n╭» 🟢 MULTIMEDIA 🟢\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`)); // Opcional: Log de limpieza
}, 180000); // Cada 3 minutos


async function connectionUpdate(update) {
  const {connection, lastDisconnect, isNewLogin} = update;
  global.stopped = connection;
  if (isNewLogin) conn.isInit = true;
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

  // Manejar razones de desconexión del bot principal
  if (connection === 'close') {
    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    logger.error(`Bot principal desconectado. Razón: ${reason || 'Desconocida'}`); // Usar logger principal

    if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
        console.error(chalk.bold.redBright(`Sesión del bot principal inválida o desconectada. Por favor, elimine ${global.authFile} y escanee nuevamente.`))
        // No intentar reconectar automáticamente por estas razones
         if (existsSync(`./${global.authFile}/creds.json`)) {
             console.log(chalk.red(`Eliminando directorio de sesión del bot principal: ./${global.authFile}`));
              await fsp.rm(`./${global.authFile}`, { recursive: true, force: true }).catch(console.error); // Usar fsp
         }
         process.exit(0); // Salir del proceso para que pueda ser reiniciado limpiamente
    } else if (reason === DisconnectReason.connectionReplaced) {
        logger.error(`Conexión del bot principal reemplazada. Otra sesión abierta en otro lugar.`); // Usar logger principal
        // No intentar reconectar automáticamente
         process.send('reset'); // Señalar a PM2 o proceso padre para reiniciar
    } else {
        logger.warn(`Conexión del bot principal cerrada (${reason || ''}), intentando reconectar...`); // Usar logger principal
        // Intentar reconectar
        await global.reloadHandler(true).catch(console.error);
        global.timestamp.connect = new Date; // Actualizar marca de tiempo de conexión
    }
  }

  if (global.db.data == null) loadDatabase();
  if (connection == 'open') {
    console.log(chalk.green('Bot principal conectado correctamente.'));
    // Puedes realizar acciones aquí una vez que el bot principal esté conectado
  }
}

process.on('uncaughtException', console.error)

let isInit = true;
let handler = await import('./handler.js').catch(e => {
    console.error(chalk.red("Error al cargar handler.js inicial:"), e);
    return null; // Devolver null si hay error
});
// Si handler no se pudo cargar, el script continuará pero no procesará mensajes
if (!handler) console.error(chalk.red("Advertencia: handler.js no pudo ser cargado. Los mensajes no serán procesados."));


global.reloadHandler = async function(restatConn) {
  console.log(chalk.yellow('Recargando handler y listeners...'));
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(e => {
         console.error(chalk.red("Error al recargar handler.js:"), e);
         return null; // Devolver null si hay error
    });
    // Si la recarga fue exitosa y exporta algo, usar el nuevo handler
    if (Handler && Object.keys(Handler || {}).length && typeof Handler.handler === 'function') { // Verificar si la recarga es válida
         handler = Handler;
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

  if (restatConn) {
    console.log(chalk.yellow('Reiniciando conexión del bot principal...'));
    const oldChats = global.conn.chats // Preservar chats si es necesario, aunque las opciones de makeWASocket lo manejan
    try {
      global.conn.ws.close()
    } catch { }
    conn.ev.removeAllListeners()
    global.conn = makeWASocket(connectionOptions, {chats: oldChats}) // Recrear conexión
    isInit = true // Establecer isInit a true para la nueva conexión
  }

  // Eliminar listeners antiguos antes de añadir los nuevos
  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler)
    conn.ev.off('connection.update', conn.connectionUpdate)
    conn.ev.off('creds.update', conn.credsUpdate)

    // También eliminar listeners antiguos de los sub-bots antes de añadir los nuevos
    for (const sessionName in global.subBots) {
         const subBotConn = global.subBots[sessionName];
         if (subBotConn && subBotConn.ev) {
             // Nota: No necesitamos eliminar los listeners connection.update o creds.update aquí
             // ya que se manejan dentro del closure de la función startSubBot.
             // Solo necesitamos actualizar el message handler si cambió.
             try {
                // Intentar eliminar el handler antiguo si existe (usando la referencia almacenada)
                 if(subBotConn.__handlerRef) { // Verificar si la referencia existe
                    subBotConn.ev.off('messages.upsert', subBotConn.__handlerRef);
                    // console.log(chalk.gray(`Handler antiguo removido para sub-bot ${sessionName}.`)); // Opcional: log
                    delete subBotConn.__handlerRef; // Limpiar la referencia antigua
                 }
             } catch (e) {
                 console.warn(chalk.yellow(`[RELOAD] Error al remover handler antiguo de ${sessionName}:`), e);
             }
         }
    }
  }

  // Adjuntar nuevos listeners para el bot principal
   if (handler && typeof handler.handler === 'function') { // Asegurar que el handler principal es válido
       conn.handler = handler.handler.bind(global.conn); // Vincular handler a la conexión principal
       conn.ev.on('messages.upsert', conn.handler);
   } else {
       console.error(chalk.red("No se pudo adjuntar el handler principal: handler.js no válido."));
       // Considerar qué hacer si el handler principal no se puede cargar/recargar
       // Podría ser necesario salir o deshabilitar funcionalidades.
   }

  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);

  // Adjuntar el handler (potencialmente nuevo) a los sub-bots activos
   for (const sessionName in global.subBots) {
         const subBotConn = global.subBots[sessionName];
         // Solo adjuntar si el sub-bot está conectado y tiene el objeto de eventos, Y el handler principal es válido
         if (subBotConn && subBotConn.user && subBotConn.ev && handler && typeof handler.handler === 'function') {
             // Almacenar la nueva referencia del handler ligado al sub-bot
             subBotConn.__handlerRef = handler.handler.bind(subBotConn);
             subBotConn.ev.on('messages.upsert', subBotConn.__handlerRef); // Adjuntar nuevo handler
             console.log(chalk.gray(`Handler (potencialmente nuevo) adjuntado para el sub-bot activo ${sessionName}.`));
         } else if (subBotConn && !subBotConn.user) {
             // Si el sub-bot existe pero no está conectado, el message handler no se adjunta ahora.
             // Se adjuntará dentro de startSubBot cuando se reconecte.
             console.log(chalk.gray(`Sub-bot ${sessionName} no está conectado, handler se adjuntará al reconectar.`));
         } else {
             // Si el sub-bot no es válido o el handler principal no es válido
             console.warn(chalk.yellow(`Saltando adjuntar handler para ${sessionName}: Instancia inválida o handler principal no válido.`));
         }
    }


  isInit = false;
  console.log(chalk.green('Handler recargado y listeners re-adjuntados.'));
  return true
};


// --- Carga de Plugins ---
const pluginFolder = global.__dirname(join(__dirname, './plugins/index'))
const pluginFilter = filename => /\.js$/.test(filename) && !filename.startsWith('_'); // Filtro para archivos .js que no empiezan con _
global.plugins = {}

async function filesInit() {
  console.log(chalk.blue('Cargando plugins...'));
  const pluginFiles = readdirSync(pluginFolder).filter(pluginFilter);
  let loadedCount = 0;
  let errorCount = 0;
  for (let filename of pluginFiles) {
    try {
      let file = global.__filename(join(pluginFolder, filename))
      const module = await import(file)
      global.plugins[filename] = module.default || module
      // console.log(chalk.gray(`Plugin cargado: ${filename}`)); // Opcional: log cada plugin
      loadedCount++;
    } catch (e) {
      console.error(chalk.red(`Error al cargar plugin ${filename}:`), e);
      delete global.plugins[filename]
      errorCount++;
    }
  }
   global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
   console.log(chalk.green(`Carga de plugins completada. ${loadedCount} cargados, ${errorCount} con errores.`));
}
filesInit().catch(console.error)

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    const isDeleted = !existsSync(dir);

    if (filename in global.plugins) {
      if (!isDeleted) console.log(chalk.yellow(`Actualizando plugin - '${filename}'`))
      else console.log(chalk.red(`Eliminando plugin - '${filename}'`))
    } else if (!isDeleted) {
         console.log(chalk.green(`Nuevo plugin - '${filename}'`));
    } else {
         // Se eliminó un archivo que no era un plugin cargado? Ignorar.
         return;
    }


    if (isDeleted) {
        delete global.plugins[filename];
        console.log(chalk.bold.green(`✅ Plugin eliminado: ${filename}`));
    } else {
        const err = syntaxerror(readFileSync(dir), filename, {
          sourceType: 'module',
          allowAwaitOutsideFunction: true,
        });
        if (err) console.error(chalk.red(`Error de sintaxis en '${filename}':\n${format(err)}`))
        else {
          try {
            // Usar un parámetro de consulta único para evitar el caché del módulo
            const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
            global.plugins[filename] = module.default || module;
            console.log(chalk.bold.green(`✅ Plugin cargado/actualizado: ${filename}`));
          } catch (e) {
            console.error(chalk.red(`Error al cargar plugin '${filename}':\n${format(e)}`))
          }
        }
    }

    global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
    // Después de recargar los plugins, la función handler en sí misma podría haber cambiado si usa plugins.
    // Necesitamos recargar el handler y re-adjuntar a todas las conexiones activas (principal y sub-bots).
    await global.reloadHandler(false); // Recargar handler sin reiniciar conexión
  }
}
// Observar la carpeta de plugins en busca de cambios
watch(pluginFolder, global.reload)


// --- Configuración Inicial ---
// Primero, cargar el handler y adjuntarlo a la conexión principal
await global.reloadHandler();

// --- Escanear e Iniciar Sub-Bots ---
// *** CAMBIO AQUÍ: Buscar en OthoJadiBot en lugar de serbot ***
const subBotBaseDir = join(__dirname, 'OthoJadiBot');
if (existsSync(subBotBaseDir)) {
    console.log(chalk.blue('Escaneando sesiones de sub-bots en ./OthoJadiBot...'));
    try { // Añadir try-catch alrededor de la lectura del directorio
        const subDirs = readdirSync(subBotBaseDir);
        subDirs.forEach(async (itemName) => {
            const itemPath = join(subBotBaseDir, itemName);
            try {
                const stats = statSync(itemPath);
                if (stats.isDirectory()) {
                    // Verificar si parece un directorio de sesión de Baileys (contiene creds.json)
                    if (existsSync(join(itemPath, 'creds.json'))) {
                        await startSubBot(itemName); // Llamar a startSubBot con el nombre del directorio
                    } else {
                        console.log(chalk.yellow(`Saltando directorio "${itemName}" en OthoJadiBot: No se encontró creds.json, asumiendo que no es una sesión.`));
                    }
                }
            } catch (e) {
                console.error(chalk.red(`Error al acceder o procesar entrada "${itemName}" en OthoJadiBot:`), e);
            }
        });
    } catch (e) {
        console.error(chalk.red(`Error al leer directorio de sub-bots ./OthoJadiBot:`), e);
    }
} else {
    console.log(chalk.blue('Directorio ./OthoJadiBot no encontrado. No hay sub-bots para cargar.'));
}
