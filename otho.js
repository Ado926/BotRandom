// Asegura que las conexiones TLS no autorizadas sean rechazadas por defecto
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';

import './settings.js'; // Asumiendo que este archivo existe y contiene configuraciones globales necesarias

import { createRequire } from 'module';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import * as ws from 'ws';
import * as fs from 'fs'; // Importa explícitamente el módulo fs
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch } from 'fs';
import yargs from 'yargs';
import { spawn, spawn as cpSpawn } from 'child_process'; // Importa spawn y alias para uso de cp.spawn
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import os from 'os'; // Importa os para tmpdir
import { format } from 'util';
import boxen from 'boxen';
import pino from 'pino'; // Usa pino consistentemente para el registro
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js'; // Asumiendo que simple.js existe
import { Low, JSONFile } from 'lowdb';
// import { mongoDB, mongoDBV2 } from './lib/mongoDB.js'; // Comentado ya que no se usaban en el fragmento proporcionado
import store from './lib/store.js'; // Asumiendo que store.js existe

const { proto } = (await import('@whiskeysockets/baileys')).default;
const {
    DisconnectReason,
    useMultiFileAuthState,
    MessageRetryMap,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    PHONENUMBER_MCC: BAILEYS_PHONENUMBER_MCC // Renombrado para evitar conflicto directo y permitir alternativa
} = await import('@whiskeysockets/baileys');

import readline from 'readline';
import NodeCache from 'node-cache';

const { CONNECTING } = ws;
const { chain } = lodash;

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// Polyfill para atob para entornos donde podría no estar disponible (como versiones antiguas de Node.js)
const atob = (str) => Buffer.from(str, 'base64').toString('binary');

protoType();
serialize();

// --- Definición de funciones y variables globales de utilidad ---
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};

global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true));
};

global.__require = function require(dir = import.meta.url) {
    return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '');

global.timestamp = { start: new Date() };

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[/.$#!]');

// Define global.sessions y global.jadi si no provienen de settings.js
// Ajusta estas rutas si tu configuración es diferente
global.sessions = global.sessions || 'sessions'; // Nombre por defecto de la carpeta de sesión del bot principal
global.jadi = global.jadi || 'OthoJadiBot'; // Nombre por defecto de la carpeta de sub-bots

// Define un nombre por defecto para el navegador del QR si no está ya configurado
const nameqr = 'OthoBot';

// Alternativa para PHONENUMBER_MCC si es indefinido desde Baileys
const PHONENUMBER_MCC = BAILEYS_PHONENUMBER_MCC || {
    '1': 'US, CA',   // Estados Unidos, Canadá
    '44': 'GB',      // Reino Unido
    '52': 'MX',      // México
    '54': 'AR',      // Argentina
    '55': 'BR',      // Brasil
    '34': 'ES',      // España
    '91': 'IN',      // India
    '504': 'HN',     // Honduras (ejemplo basado en tu ubicación actual)
    // ... agrega más códigos MCC según sea necesario
};

// global.opts['db'] = process.env['db']

// Configuración de global.db
// Si usas una base de datos en la nube, asegúrate de que cloudDBAdapter esté definida o importada.
// Por ahora, está comentado para evitar errores si no está implementada.
global.db = new Low(/https?:\/\//.test(global.opts['db'] || '')
    ? null // new cloudDBAdapter(global.opts['db']) // Descomenta y define cloudDBAdapter si es necesario
    : new JSONFile('src/database/database.json')
);

global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise((resolve) => setInterval(async function() {
            if (!global.db.READ) {
                clearInterval(this);
                resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
            }
        }, 1 * 1000));
    }
    if (global.db.data !== null) return;
    global.db.READ = true;
    await global.db.read().catch(console.error);
    global.db.READ = null;
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {}),
    };
    global.db.chain = chain(global.db.data);
};
loadDatabase();

const { state, saveState, saveCreds } = await useMultiFileAuthState(global.sessions);
const msgRetryCounterMap = (MessageRetryMap) => { }; // Esto podría ser una función de Baileys, asegurando que esté definida
const msgRetryCounterCache = new NodeCache();
const { version } = await fetchLatestBaileysVersion();
let phoneNumber = global.botNumberCode; // Asumiendo que global.botNumberCode está definido en otro lugar o a través de env

const methodCodeQR = process.argv.includes("qr");
const methodCode = !!phoneNumber || process.argv.includes("code");
const MethodMobile = process.argv.includes("mobile");
const colores = chalk.bgMagenta.white;
const opcionQR = chalk.bold.green;
const opcionTexto = chalk.bold.cyan;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

let opcion;
if (methodCodeQR) {
    opcion = '1';
}
if (!methodCodeQR && !methodCode && !fs.existsSync(`./${global.sessions}/creds.json`)) {
    do {
        opcion = await question(colores('Seleccione una opción:\n') + opcionQR('1. Con código QR\n') + opcionTexto('2. Con código de texto de 8 dígitos\n--> '));

        if (!/^[1-2]$/.test(opcion)) {
            console.log(chalk.bold.redBright(`🍭 No se permiten numeros que no sean 1 o 2, tampoco letras o símbolos especiales.`));
        }
    } while (opcion !== '1' && opcion !== '2' || fs.existsSync(`./${global.sessions}/creds.json`));
}

const filterStrings = [
    "Q2xvc2luZyBzdGFsZSBvcGVu", // "Cerrando apertura estable"
    "Q2xvc2luZyBvcGVuIHNlc3Npb24=", // "Cerrando sesión abierta"
    "RmFpbGVkIHRvIGRlY3J5cHQ=", // "Fallo al desencriptar"
    "U2Vzc2lvbiBlcnJvcg==", // "Error de sesión"
    "RXJyb3I6IEJhZCBNQUM=", // "Error: MAC incorrecto"
    "RGVjcnlwdGVkIG1lc3NhZ2U=" // "Mensaje desencriptado"
];

// Redefine métodos de consola para filtrar mensajes específicos
function redefineConsoleMethod(methodName, filterStrings) {
    const originalConsoleMethod = console[methodName];
    console[methodName] = function() {
        const message = arguments[0];
        if (typeof message === 'string' && filterStrings.some(filterString => message.includes(atob(filterString)))) {
            arguments[0] = ""; // Reemplaza el mensaje con una cadena vacía si se filtra
        }
        originalConsoleMethod.apply(console, arguments);
    };
}

console.info = () => {};
console.debug = () => {};
['log', 'warn', 'error'].forEach(methodName => redefineConsoleMethod(methodName, filterStrings));

const connectionOptions = {
    logger: pino({ level: 'silent' }),
    printQRInTerminal: opcion == '1' ? true : methodCodeQR ? true : false,
    mobile: MethodMobile,
    browser: opcion == '1' ? [`${nameqr}`, 'Edge', '20.0.04'] : methodCodeQR ? [`${nameqr}`, 'Edge', '20.0.04'] : ['Ubuntu', 'Edge', '110.0.1587.56'],
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })), // Usa pino aquí
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (clave) => {
        let jid = jidNormalizedUser(clave.remoteJid);
        let msg = await store.loadMessage(jid, clave.id);
        return msg?.message || "";
    },
    msgRetryCounterCache, // Resuelve mensajes en espera
    msgRetryCounterMap, // Determina si se debe volver a intentar enviar un mensaje o no
    defaultQueryTimeoutMs: undefined,
    version: [2, 3000, 1015901307],
};

global.conn = makeWASocket(connectionOptions);

if (!fs.existsSync(`./${global.sessions}/creds.json`)) {
    if (opcion === '2' || methodCode) {
        opcion = '2';
        if (!global.conn.authState.creds.registered) {
            if (MethodMobile) throw new Error('No se puede usar un código de emparejamiento con la API móvil');

            let numeroTelefono;
            if (!!phoneNumber) {
                numeroTelefono = phoneNumber.replace(/[^0-9]/g, '');
                if (!Object.keys(PHONENUMBER_MCC).some(v => numeroTelefono.startsWith(v))) {
                    console.log(chalk.bgBlack(chalk.bold.greenBright(`🍁 Por favor, Ingrese el número de WhatsApp.\n${chalk.bold.yellowBright(`🍭  Ejemplo: 521657×××××××`)}\n${chalk.bold.magentaBright('---> ')}`)));
                    process.exit(0);
                }
            } else {
                while (true) {
                    numeroTelefono = await question(chalk.bgBlack(chalk.bold.greenBright(`🍁 Por favor, escriba su número de WhatsApp.\n🍭  Ejemplo: 521657×××××××\n`)));
                    numeroTelefono = numeroTelefono.replace(/[^0-9]/g, '');

                    if (numeroTelefono.match(/^\d+$/) && Object.keys(PHONENUMBER_MCC).some(v => numeroTelefono.startsWith(v))) {
                        break;
                    } else {
                        console.log(chalk.bgBlack(chalk.bold.greenBright(`🍁 Por favor, escriba su número de WhatsApp.\n🍭  Ejemplo: 521657×××××××\n`)));
                    }
                }
                rl.close();
            }

            setTimeout(async () => {
                let codigo = await global.conn.requestPairingCode(numeroTelefono);
                codigo = codigo?.match(/.{1,4}/g)?.join("-") || codigo;
                console.log(chalk.bold.white(chalk.bgMagenta(`⭐️ Código: `)), chalk.bold.white(chalk.white(codigo)));
            }, 3000);
        }
    }
}

global.conn.isInit = false;
global.conn.well = false;
// global.conn.logger.info(`🔵  H E C H O\n`)

if (!global.opts['test']) {
    if (global.db) setInterval(async () => {
        if (global.db.data) await global.db.write();
        // Usa os.tmpdir() correctamente y cpSpawn para child_process
        if (global.opts['autocleartmp'] && (global.support || {}).find) {
            const tmp = [os.tmpdir(), 'tmp', `${global.jadi}`];
            tmp.forEach((filename) => cpSpawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']));
        }
    }, 30 * 1000);
}

if (global.opts['server']) (await import('./server.js')).default(global.conn, PORT);

// --- Gestión de la conexión de sub-bots ---
// Para almacenar active sub-bot connections
// Cambiamos 'subBots' a un objeto para almacenar cada conexión con su propio manejador
global.subConns = {}; // Usaremos global.subConns para acceder a ellos en handler.js si es necesario

// Se importa el handler una vez para que esté disponible para todas las conexiones
let handler = await import('./handler.js'); // Asumiendo que handler.js existe

async function setupConnectionHandlers(connectionInstance, isMainBot = false, sessionName = 'main') {
    // Si no es el bot principal, asegúrate de que el handler se vincule a esta instancia de conexión
    if (!isMainBot) {
        connectionInstance.handler = handler.handler.bind(connectionInstance);
    } else {
        // Para el bot principal, ya está vinculado en reloadHandler
        connectionInstance.handler = handler.handler.bind(connectionInstance); // Aseguramos que esté vinculado
    }

    connectionInstance.ev.on('messages.upsert', connectionInstance.handler);

    // Los manejadores de conexión y credenciales son específicos de cada instancia
    connectionInstance.ev.on('connection.update', (update) => {
        if (isMainBot) {
            connectionUpdate(update); // La función connectionUpdate maneja la lógica del bot principal
        } else {
            // Lógica específica para sub-bots
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(chalk.green(`¡Sub-bot ${sessionName} conectado exitosamente!`));
                // Aquí podrías agregar un mensaje de "listo" para el sub-bot
            } else if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.warn(chalk.red(`Sub-bot ${sessionName} desconectado. Razón: ${reason || 'Desconocida'}. Intentando reconectar...`));
                delete global.subConns[sessionName]; // Elimina de las conexiones activas
                setTimeout(() => connectSubBot(sessionName), 5000); // Intenta reconectar después de 5 segundos
            }
        }
    });

    connectionInstance.ev.on('creds.update', connectionInstance.saveCreds.bind(connectionInstance, true));
}

async function connectSubBot(sessionName) {
    const subBotSessionPath = path.join(global.jadi, sessionName);
    if (!existsSync(subBotSessionPath)) {
        console.warn(chalk.yellow(`Carpeta de sesión de sub-bot no encontrada para: ${sessionName}`));
        return;
    }

    // Si ya existe una conexión para este sub-bot, no la volvemos a crear a menos que esté cerrada
    if (global.subConns[sessionName] && global.subConns[sessionName].user) {
        console.log(chalk.gray(`Sub-bot ${sessionName} ya está conectado o en proceso.`));
        return;
    }

    try {
        const { state, saveCreds: saveSubCreds } = await useMultiFileAuthState(subBotSessionPath);
        const subBotConnectionOptions = {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false, // Los sub-bots no necesitan QR en la terminal
            browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })), // Usa pino
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async (clave) => {
                let jid = jidNormalizedUser(clave.remoteJid);
                let msg = await store.loadMessage(jid, clave.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            msgRetryCounterMap,
            defaultQueryTimeoutMs: undefined,
            version: [2, 3000, 1015901307],
        };

        const subConn = makeWASocket(subBotConnectionOptions);
        subConn.saveCreds = saveSubCreds; // Asigna saveCreds a la instancia del sub-bot
        global.subConns[sessionName] = subConn; // Almacena la conexión del sub-bot

        // Configura los manejadores de eventos para esta nueva conexión de sub-bot
        await setupConnectionHandlers(subConn, false, sessionName);

        console.log(chalk.blue(`Intentando conectar sub-bot: ${sessionName}`));

    } catch (error) {
        console.error(chalk.red(`Error conectando sub-bot ${sessionName}:`, error));
    }
}

async function connectAllSubBots() {
    console.log(chalk.bold.magenta('\n--- Buscando Sub-bots en ./OthoJadiBot ---\n'));
    if (!existsSync(global.jadi)) {
        console.warn(chalk.yellow(`No se encontró la carpeta '${global.jadi}'. No hay sub-bots para conectar.`));
        return;
    }
    const subBotFolders = readdirSync(global.jadi, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (subBotFolders.length === 0) {
        console.log(chalk.bold.yellow('No se encontraron carpetas de sub-bots en ./OthoJadiBot.'));
        return;
    }

    for (const folder of subBotFolders) {
        // Asegúrate de que creds.json exista en la carpeta de sesión del sub-bot
        if (existsSync(path.join(global.jadi, folder, 'creds.json'))) {
            await connectSubBot(folder);
        } else {
            console.warn(chalk.yellow(`Saltando sub-bot '${folder}': no se encontró creds.json. Necesitas autenticarlo primero.`));
        }
    }
    console.log(chalk.bold.magenta('\n--- Proceso de conexión de Sub-bots iniciado ---\n'));
}


// Manejador de actualización de conexión del bot principal
async function connectionUpdate(update) {
    const { connection, lastDisconnect } = update;
    global.stopped = connection;

    const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

    if (code && code !== DisconnectReason.loggedOut && global.conn?.ws.socket == null) {
        await global.reloadHandler(true).catch(console.error);
        global.timestamp.connect = new Date();
    }
    if (global.db.data == null) loadDatabase();

    if (update.qr !== 0 && update.qr !== undefined || methodCodeQR) {
        if (opcion == '1' || methodCodeQR) {
            console.log(chalk.bold.yellow(`\n✅ ESCANEA EL CÓDIGO QR EXPIRA EN 45 SEGUNDOS`));
        }
    }

    if (connection == 'open') {
        console.log(boxen(chalk.bold(' ¡CONECTADO CON WHATSAPP! '), { borderStyle: 'round', borderColor: 'green', title: chalk.green.bold('● CONEXIÓN ●'), titleAlignment: '', float: '' }));
        // Llama a connectAllSubBots cada vez que el bot principal se conecta exitosamente
        await connectAllSubBots();
    }
    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    if (connection === 'close') {
        if (reason === DisconnectReason.badSession) {
            console.log(chalk.bold.cyanBright(`\n⚠️ SIN CONEXIÓN, BORRE LA CARPETA ${global.sessions} Y ESCANEA EL CÓDIGO QR ⚠️`));
        } else if (reason === DisconnectReason.connectionClosed) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ☹\n┆ ⚠️ CONEXION CERRADA, RECONECTANDO....\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ☹`));
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.connectionLost) {
            console.log(chalk.bold.blueBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ☂\n┆ ⚠️ CONEXIÓN PERDIDA CON EL SERVIDOR, RECONECTANDO....\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ☂`));
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.connectionReplaced) {
            console.log(chalk.bold.yellowBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ✗\n┆ ⚠️ CONEXIÓN REEMPLAZADA, SE HA ABIERTO OTRA NUEVA SESION, POR FAVOR, CIERRA LA SESIÓN ACTUAL PRIMERO.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ✗`));
        } else if (reason === DisconnectReason.loggedOut) {
            console.log(chalk.bold.redBright(`\n⚠️ SIN CONEXIÓN, BORRE LA CARPETA ${global.sessions} Y ESCANEA EL CÓDIGO QR ⚠️`));
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.restartRequired) {
            console.log(chalk.bold.cyanBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ✓\n┆ ❇️ CONECTANDO AL SERVIDOR...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ✓`));
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.timedOut) {
            console.log(chalk.bold.yellowBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ▸\n┆ ⌛ TIEMPO DE CONEXIÓN AGOTADO, RECONECTANDO....\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ▸`));
            await global.reloadHandler(true).catch(console.error); //process.send('reset')
        } else {
            console.log(chalk.bold.redBright(`\n⚠️❗ RAZON DE DESCONEXIÓN DESCONOCIDA: ${reason || 'No encontrado'} >> ${connection || 'No encontrado'}`));
        }
    }
}
process.on('uncaughtException', console.error);

let isInit = true;
// El handler se importa solo una vez al principio del archivo
// let handler = await import('./handler.js'); // Ya importado al inicio

global.reloadHandler = async function(restatConn) {
    try {
        // Recargamos el handler para el bot principal y para los sub-bots si es necesario
        const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
        if (Object.keys(Handler || {}).length) handler = Handler;
    } catch (e) {
        console.error(e);
    }
    if (restatConn) {
        const oldChats = global.conn.chats;
        try {
            global.conn.ws.close();
        } catch {}
        global.conn.ev.removeAllListeners();
        global.conn = makeWASocket(connectionOptions, { chats: oldChats });
        isInit = true;
    }
    if (!isInit) {
        // Remove listeners for main bot only before re-adding them
        global.conn.ev.off('messages.upsert', global.conn.handler);
        global.conn.ev.off('connection.update', global.conn.connectionUpdate);
        global.conn.ev.off('creds.update', global.conn.credsUpdate);
    }

    // Configura los manejadores para el bot principal
    await setupConnectionHandlers(global.conn, true);

    const currentDateTime = new Date();
    const chats = Object.entries(global.conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);

    isInit = false;
    return true;
};

const pluginFolder = global.__dirname(join(__dirname, './plugins/index')); // Asumiendo que plugins/index existe
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};
async function filesInit() {
    for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
        try {
            const file = global.__filename(join(pluginFolder, filename));
            const module = await import(file);
            global.plugins[filename] = module.default || module;
        } catch (e) {
            global.conn.logger.error(e); // Usa global.conn.logger
            delete global.plugins[filename];
        }
    }
}
filesInit().then((_) => Object.keys(global.plugins)).catch(console.error);

global.reload = async (_ev, filename) => {
    if (pluginFilter(filename)) {
        const dir = global.__filename(join(pluginFolder, filename), true);
        if (filename in global.plugins) {
            if (existsSync(dir)) global.conn.logger.info(` plugin actualizado - '${filename}'`); // Usa global.conn.logger
            else {
                global.conn.logger.warn(`plugin eliminado - '${filename}'`); // Usa global.conn.logger
                return delete global.plugins[filename];
            }
        } else global.conn.logger.info(`nuevo plugin - '${filename}'`); // Usa global.conn.logger
        const err = syntaxerror(readFileSync(dir), filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
        });
        if (err) global.conn.logger.error(`error de sintaxis al cargar '${filename}'\n${format(err)}`); // Usa global.conn.logger
        else {
            try {
                const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
                global.plugins[filename] = module.default || module;
            } catch (e) {
                global.conn.logger.error(`error al requerir el plugin '${filename}\n${format(e)}'`); // Usa global.conn.logger
            } finally {
                global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
            }
        }
    }
};
Object.freeze(global.reload);
watch(pluginFolder, global.reload);
await global.reloadHandler();

async function _quickTest() {
    const test = await Promise.all([
        spawn('ffmpeg'),
        spawn('ffprobe'),
        spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
        spawn('convert'),
        spawn('magick'),
        spawn('gm'),
        spawn('find', ['--version']),
    ].map((p) => {
        return Promise.race([
            new Promise((resolve) => {
                p.on('close', (code) => {
                    resolve(code !== 127);
                });
            }),
            new Promise((resolve) => {
                p.on('error', (_) => resolve(false));
            })
        ]);
    }));
    const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
    const s = global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find };
    Object.freeze(global.support);
}

function clearTmp() {
    const tmpDir = join(__dirname, 'tmp');
    // Asegura que el directorio tmp exista antes de intentar leerlo
    if (!existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const filenames = readdirSync(tmpDir);
    filenames.forEach(file => {
        const filePath = join(tmpDir, file);
        // Solo elimina si es un archivo, no un directorio
        if (statSync(filePath).isFile()) {
            unlinkSync(filePath);
        }
    });
}

function purgeSession() {
    let prekey = [];
    // Asegura que el directorio de sesiones exista
    if (!existsSync(`./${global.sessions}`)) {
        console.warn(chalk.yellow(`Directorio de sesión './${global.sessions}' no encontrado para purgar.`));
        return;
    }
    let directorio = readdirSync(`./${global.sessions}`);
    let filesFolderPreKeys = directorio.filter(file => {
        return file.startsWith('pre-key-');
    });
    prekey = [...prekey, ...filesFolderPreKeys];
    filesFolderPreKeys.forEach(files => {
        unlinkSync(`./${global.sessions}/${files}`);
    });
}

function purgeSessionSB() {
    try {
        if (!existsSync(`./${global.jadi}/`)) {
            console.warn(chalk.yellow(`Directorio de sub-bots './${global.jadi}' no encontrado para purgar.`));
            console.log(chalk.bold.green(`\n╭» 🟡 ${global.jadi} 🟡\n│→ DIRECTORIO NO ENCONTRADO \n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
            return;
        }
        const listaDirectorios = readdirSync(`./${global.jadi}/`);
        let SBprekey = [];
        listaDirectorios.forEach(directorio => {
            const dirPath = `./${global.jadi}/${directorio}`;
            if (statSync(dirPath).isDirectory()) {
                const DSBPreKeys = readdirSync(dirPath).filter(fileInDir => {
                    return fileInDir.startsWith('pre-key-');
                });
                SBprekey = [...SBprekey, ...DSBPreKeys];
                DSBPreKeys.forEach(fileInDir => {
                    if (fileInDir !== 'creds.json') {
                        unlinkSync(`${dirPath}/${fileInDir}`);
                    }
                });
            }
        });
        if (SBprekey.length === 0) {
            console.log(chalk.bold.green(`\n╭» 🟡 ${global.jadi} 🟡\n│→ NADA POR ELIMINAR \n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
        } else {
            console.log(chalk.bold.cyanBright(`\n╭» ⚪ ${global.jadi} ⚪\n│→ ARCHIVOS NO ESENCIALES ELIMINADOS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
        }
    } catch (err) {
        console.log(chalk.bold.red(`\n╭» 🔴 ${global.jadi} 🔴\n│→ OCURRIÓ UN ERROR\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️\n` + err));
    }
}

function purgeOldFiles() {
    const directories = [`./${global.sessions}/`, `./${global.jadi}/`];
    directories.forEach(dir => {
        // Verifica si el directorio existe antes de intentar leerlo
        if (!existsSync(dir)) {
            console.warn(chalk.yellow(`Directorio '${dir}' no encontrado para purgar archivos antiguos.`));
            return;
        }
        readdirSync(dir).forEach(file => { // Eliminado el parámetro err ya que normalmente se maneja con try-catch o existsSync
            if (file !== 'creds.json') {
                const filePath = path.join(dir, file);
                try {
                    unlinkSync(filePath);
                    console.log(chalk.bold.green(`\n╭» 🟣 ARCHIVO 🟣\n│→ ${file} BORRADO CON ÉXITO\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
                } catch (err) {
                    console.log(chalk.bold.red(`\n╭» 🔴 ARCHIVO 🔴\n│→ ${file} NO SE LOGRÓ BORRAR\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️❌\n` + err));
                }
            }
        });
    });
}

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Usa global.stopped
    await clearTmp();
    console.log(chalk.bold.cyanBright(`\n╭» 🟢 MULTIMEDIA 🟢\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 4); // 4 minutos

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Usa global.stopped
    await purgeSession();
    console.log(chalk.bold.cyanBright(`\n╭» 🔵 ${global.sessions} 🔵\n│→ SESIONES NO ESENCIALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 10); // 10 minutos

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Usa global.stopped
    await purgeSessionSB();
}, 1000 * 60 * 10); // 10 minutos

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Usa global.stopped
    await purgeOldFiles();
    console.log(chalk.bold.cyanBright(`\n╭» 🟠 ARCHIVOS 🟠\n│→ ARCHIVOS RESIDUALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 10); // 10 minutos

_quickTest().then(() => global.conn.logger.info(chalk.bold(`🔵  H E C H O\n`.trim()))).catch(console.error); // Usa global.conn.logger
