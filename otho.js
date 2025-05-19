process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
import './settings.js'
import {createRequire} from 'module'
import path, {join} from 'path'
import {fileURLToPath, pathToFileURL} from 'url'
import {platform} from 'process'
import * as ws from 'ws'
// Asegúrate de importar 'fs' completo y 'child_process'
import fs, {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch, promises as fs} from 'fs' // Added 'promises as fs' - Nota: ya importaste fs arriba, puedes quitar el primero o ser consistente con fsp
import { promises as fsp } from 'fs'; // Añadir import si usas operaciones con promesas
import yargs from 'yargs'
import {spawn} from 'child_process'
import lodash from 'lodash'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import {tmpdir} from 'os'
import {format} from 'util'
// Removed duplicate imports of pino
import pino from 'pino'
import {Boom} from '@hapi/boom'
import {makeWASocket, protoType, serialize} from './lib/simple.js'
import {Low, JSONFile} from 'lowdb'
import store from './lib/store.js'
const {proto} = (await import('@whiskeysockets/baileys')).default
const { DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, jidNormalizedUser, PHONENUMBER_MCC } = await import('@whiskeysockets/baileys')
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
global.prefix = new RegExp('^[' + (opts['prefix'] || '‎z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

global.db = new Low(new JSONFile(`storage/databases/database.json`))

global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => setInterval(async function () {
    if (!global.db.READ) {
      clearInterval(this)
      resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
    }
  }, 1 * 1000))
  if (global.db.data !== null) return
  global.db.READ = true
  await global.db.read().catch(console.error)
  global.db.READ = null
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {})
  }
  global.db.chain = chain(global.db.data)
}
loadDatabase()

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
    markOnlineOnclientect: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: true, // Considerar establecer esto en false para un inicio más rápido si no es necesario
    retryRequestDelayMs: 10,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
    defaultQueryTimeoutMs: undefined,
    maxMsgRetryCount: 15,
    appStateMacVerification: {
      patch: false,
      snapshot: false,
    },
    getMessage: async (key) => {
      // Esta función es utilizada por Baileys para obtener mensajes antiguos para el contexto de respuesta
      const jid = jidNormalizedUser(key.remoteJid)
      // Asumiendo que el bot principal utiliza un store que puede recuperar mensajes
      const msg = await store.loadMessage(jid, key.id)
      return msg?.message || ""
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
        subBotLogger.level = "fatal"; // Establecer nivel según sea necesario para los logs del sub-bot

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
            markOnlineOnclientect: false, // Misma configuración
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
                     //     await fs.rm(sessionDir, { recursive: true, force: true }).catch(console.error);
                     // }
                } else if (reason === DisconnectReason.connectionReplaced) {
                     console.error(chalk.red(`La conexión del sub-bot ${sessionName} fue reemplazada. Se abrió otra sesión en otro lugar.`));
                     // No reiniciar automáticamente, requiere intervención manual o una estrategia específica
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
        subBotConn.ev.on('messages.upsert', handler.handler.bind(subBotConn));

         console.log(chalk.cyan(`Listeners de eventos inicializados para el sub-bot ${sessionName}.`));

    } catch (e) {
        console.error(chalk.red(`Error al iniciar sub-bot ${sessionName}:`), e);
        delete global.subBots[sessionName]; // Eliminar de la lista si la inicialización falló
    }
}


if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write();
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
    }, 30 * 1000);
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
               if (stats.isDirectory()) { // Solo si es un directorio
                   tmp.push(join(itemPath, 'tmp')); // Asumiendo que los sub-bots podrían crear carpetas tmp dentro de sus dirs de sesión
               }
          } catch (e) {
              console.error(chalk.red(`Error al inspeccionar directorio en OthoJadiBot para limpieza tmp: ${itemName}`), e);
          }

      });
  }

  const filename = [];
  tmp.forEach((dirname) => {
      if(existsSync(dirname)) { // Verificar si el directorio existe
          readdirSync(dirname).forEach((file) => filename.push(join(dirname, file)))
      }
  })

  return filename.map((file) => {
    try {
        const stats = statSync(file)
        // Eliminar archivos con más de 3 minutos
        if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) {
             console.log(chalk.gray(`Limpiando archivo temporal antiguo: ${file}`));
             unlinkSync(file);
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
      const activeSubBots = Object.values(global.subBots).filter(bot => bot && bot.user && stopped !== 'close');
      if (activeSubBots.length === 0 && (stopped === 'close' || !conn || !conn.user)) {
         // Si el bot principal está detenido y no hay sub-bots activos, ¿quizás dejar de limpiar?
         // O simplemente continuar limpiando archivos temporales independientemente del estado del bot?
         // Continuaremos limpiando archivos temporales independientemente.
      }
  }
  await clearTmp(); // Limpiar archivos tmp periódicamente
}, 180000); // Cada 3 minutos


async function connectionUpdate(update) {
  const {connection, lastDisconnect, isNewLogin} = update;
  global.stopped = connection;
  if (isNewLogin) conn.isInit = true;
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

  // Manejar razones de desconexión del bot principal
  if (connection === 'close') {
    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    conn.logger.error(`Bot principal desconectado. Razón: ${reason || 'Desconocida'}`);

    if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
        console.error(chalk.bold.redBright(`Sesión del bot principal inválida o desconectada. Por favor, elimine ${global.authFile} y escanee nuevamente.`))
        // No intentar reconectar automáticamente por estas razones
         if (existsSync(`./${global.authFile}/creds.json`)) {
             console.log(chalk.red(`Eliminando directorio de sesión del bot principal: ./${global.authFile}`));
              await fs.rm(`./${global.authFile}`, { recursive: true, force: true }).catch(console.error);
         }
         process.exit(0); // Salir del proceso para que pueda ser reiniciado limpiamente
    } else if (reason === DisconnectReason.connectionReplaced) {
        conn.logger.error(`Conexión del bot principal reemplazada. Otra sesión abierta en otro lugar.`);
        // No intentar reconectar automáticamente
         process.send('reset'); // Señalar a PM2 o proceso padre para reiniciar
    } else {
        conn.logger.warn(`Conexión del bot principal cerrada, intentando reconectar... Razón: ${reason || ''}`);
        // Intentar reconectar
        await global.reloadHandler(true).catch(console.error);
        global.timestamp.connect = new Date;
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
let handler = await import('./handler.js')
global.reloadHandler = async function(restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Object.keys(Handler || {}).length) handler = Handler
  } catch (e) {
    console.error(e);
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
             // Para simplificar, volvemos a adjuntar el handler. Si el handler cambió,
             // la referencia de la función antigua es lo que estaba previamente adjunto.
             // Un sistema más robusto podría rastrear los listeners para eliminarlos específicamente.
             try {
                // Intentar eliminar el handler antiguo si existe
                 subBotConn.ev.off('messages.upsert', subBotConn.__handlerRef); // Usar una referencia almacenada
                 console.log(chalk.gray(`Handler antiguo eliminado para sub-bot ${sessionName}.`));
             } catch (e) {
                 // Ignorar errores si el listener no fue encontrado
             }
         }
    }
  }

  // Adjuntar nuevos listeners para el bot principal
  conn.handler = handler.handler.bind(global.conn); // Vincular handler a la conexión principal
  conn.connectionUpdate = connectionUpdate.bind(global.conn);
  conn.credsUpdate = saveCreds.bind(global.conn, true);

  conn.ev.on('messages.upsert', conn.handler);
  conn.ev.on('connection.update', conn.connectionUpdate);
  conn.ev.on('creds.update', conn.credsUpdate);

  // Adjuntar el handler (potencialmente nuevo) a los sub-bots activos
   for (const sessionName in global.subBots) {
         const subBotConn = global.subBots[sessionName];
         if (subBotConn && subBotConn.user) { // Solo adjuntar si el sub-bot está actualmente conectado
             subBotConn.__handlerRef = handler.handler.bind(subBotConn); // Almacenar referencia
             subBotConn.ev.on('messages.upsert', subBotConn.__handlerRef);
             console.log(chalk.gray(`Nuevo handler adjuntado para el sub-bot activo ${sessionName}.`));
         }
    }


  isInit = false;
  console.log(chalk.green('Handler recargado y listeners re-adjuntados.'));
  return true
};


// --- Carga de Plugins ---
const pluginFolder = global.__dirname(join(__dirname, './plugins/index'))
const pluginFilter = filename => /\.js$/.test(filename)
global.plugins = {}

async function filesInit() {
  console.log(chalk.blue('Cargando plugins...'));
  for (let filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      let file = global.__filename(join(pluginFolder, filename))
      const module = await import(file)
      global.plugins[filename] = module.default || module
      console.log(chalk.gray(`Plugin cargado: ${filename}`));
    } catch (e) {
      console.error(chalk.red(`Error al cargar plugin ${filename}:`), e);
      delete global.plugins[filename]
    }
  }
   global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
   console.log(chalk.green('Plugins cargados.'));
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
          } catch (e) {
            console.error(chalk.red(`Error al cargar plugin '${filename}':\n${format(e)}`))
          }
        }
    }

    global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
    // Después de recargar los plugins, la función handler en sí misma podría haber cambiado si usa plugins.
    // Necesitamos re-adjuntar el handler a todas las conexiones activas (principal y sub-bots).
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
            console.error(chalk.red(`Error al acceder al directorio "${itemName}" en OthoJadiBot:`), e);
        }
    });
} else {
    console.log(chalk.blue('Directorio ./OthoJadiBot no encontrado. No hay sub-bots para cargar.'));
}
