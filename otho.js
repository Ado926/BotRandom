// Ensure TLS unauthorized connections are rejected by default
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';

import './settings.js'; // Assuming this file exists and contains necessary global settings

import { createRequire } from 'module';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import * as ws from 'ws';
import * as fs from 'fs'; // Explicitly import fs
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch } from 'fs';
import yargs from 'yargs';
import { spawn, spawn as cpSpawn } from 'child_process'; // Import spawn and alias for cp.spawn usage
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import os from 'os'; // Import os for tmpdir
import { format } from 'util';
import boxen from 'boxen';
import pino from 'pino'; // Use pino consistently for logging
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js'; // Assuming simple.js exists
import { Low, JSONFile } from 'lowdb';
// import { mongoDB, mongoDBV2 } from './lib/mongoDB.js'; // Commented out as these were unused in provided snippet
import store from './lib/store.js'; // Assuming store.js exists

const { proto } = (await import('@whiskeysockets/baileys')).default;
const {
    DisconnectReason,
    useMultiFileAuthState,
    MessageRetryMap,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    PHONENUMBER_MCC: BAILEYS_PHONENUMBER_MCC // Renamed to avoid direct conflict and allow fallback
} = await import('@whiskeysockets/baileys');

import readline from 'readline';
import NodeCache from 'node-cache';

const { CONNECTING } = ws;
const { chain } = lodash;

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// Polyfill for atob for environments where it might not be natively available (like older Node.js versions)
const atob = (str) => Buffer.from(str, 'base64').toString('binary');

protoType();
serialize();

// --- Global utility functions and variables definition ---
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

// Define global.sessions and global.jadi if they are not coming from settings.js
// Adjust these paths if your setup is different
global.sessions = global.sessions || 'sessions'; // Default session folder name
global.jadi = global.jadi || 'OthoJadiBot'; // Default sub-bot directory name

// Define a default name for the QR browser if not already set
const nameqr = 'OthoBot';

// Fallback for PHONENUMBER_MCC if it's undefined from Baileys
const PHONENUMBER_MCC = BAILEYS_PHONENUMBER_MCC || {
    '1': 'US, CA',   // United States, Canada
    '44': 'GB',      // United Kingdom
    '52': 'MX',      // Mexico
    '54': 'AR',      // Argentina
    '55': 'BR',      // Brazil
    '34': 'ES',      // Spain
    '91': 'IN',      // India
    '504': 'HN',     // Honduras (example based on current location)
    // Add more as needed or retrieve a comprehensive list if available
};

// global.opts['db'] = process.env['db']

// global.db setup
// If you use a cloud DB, ensure cloudDBAdapter is defined or imported.
// For now, it's commented out to prevent error if not implemented.
global.db = new Low(/https?:\/\//.test(global.opts['db'] || '')
    ? null // new cloudDBAdapter(global.opts['db']) // Uncomment and define cloudDBAdapter if needed
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
const msgRetryCounterMap = (MessageRetryMap) => { }; // This might be a function from Baileys, ensuring it's defined
const msgRetryCounterCache = new NodeCache();
const { version } = await fetchLatestBaileysVersion();
let phoneNumber = global.botNumberCode; // Assuming global.botNumberCode is defined elsewhere or via env

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
    "Q2xvc2luZyBzdGFsZSBvcGVu", // "Closing stable open"
    "Q2xvc2luZyBvcGVuIHNlc3Npb24=", // "Closing open session"
    "RmFpbGVkIHRvIGRlY3J5cHQ=", // "Failed to decrypt"
    "U2Vzc2lvbiBlcnJvcg==", // "Session error"
    "RXJyb3I6IEJhZCBNQUM=", // "Error: Bad MAC"
    "RGVjcnlwdGVkIG1lc3NhZ2U=" // "Decrypted message"
];

// Redefine console methods to filter specific messages
function redefineConsoleMethod(methodName, filterStrings) {
    const originalConsoleMethod = console[methodName];
    console[methodName] = function() {
        const message = arguments[0];
        if (typeof message === 'string' && filterStrings.some(filterString => message.includes(atob(filterString)))) {
            arguments[0] = ""; // Replace message with empty string if filtered
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
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })), // Use pino here
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (clave) => {
        let jid = jidNormalizedUser(clave.remoteJid);
        let msg = await store.loadMessage(jid, clave.id);
        return msg?.message || "";
    },
    msgRetryCounterCache, // Resolver mensajes en espera
    msgRetryCounterMap, // Determinar si se debe volver a intentar enviar un mensaje o no
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
//global.conn.logger.info(`🔵  H E C H O\n`)

if (!global.opts['test']) {
    if (global.db) setInterval(async () => {
        if (global.db.data) await global.db.write();
        // Use os.tmpdir() correctly and cpSpawn for child_process
        if (global.opts['autocleartmp'] && (global.support || {}).find) {
            const tmp = [os.tmpdir(), 'tmp', `${global.jadi}`];
            tmp.forEach((filename) => cpSpawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']));
        }
    }, 30 * 1000);
}

if (global.opts['server']) (await import('./server.js')).default(global.conn, PORT);

// --- Sub-bot connection management ---
const subBots = new Map(); // To store active sub-bot connections

async function connectSubBot(sessionName) {
    const subBotSessionPath = path.join(global.jadi, sessionName);
    if (!existsSync(subBotSessionPath)) {
        console.warn(chalk.yellow(`Sub-bot session folder not found for: ${sessionName}`));
        return;
    }

    try {
        const { state, saveCreds: saveSubCreds } = await useMultiFileAuthState(subBotSessionPath);
        const subBotConnectionOptions = {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false, // Sub-bots don't need QR in terminal
            browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })), // Use pino
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
        subBots.set(sessionName, subConn);

        subConn.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log(chalk.green(`Sub-bot ${sessionName} connected successfully!`));
            } else if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.warn(chalk.red(`Sub-bot ${sessionName} disconnected. Reason: ${reason || 'Unknown'}. Attempting to reconnect...`));
                subBots.delete(sessionName); // Remove from active connections
                setTimeout(() => connectSubBot(sessionName), 5000); // Attempt to reconnect after 5 seconds
            }
        });

        subConn.ev.on('creds.update', saveSubCreds.bind(subConn, true));
        console.log(chalk.blue(`Attempting to connect sub-bot: ${sessionName}`));

    } catch (error) {
        console.error(chalk.red(`Error connecting sub-bot ${sessionName}:`, error));
    }
}

async function connectAllSubBots() {
    console.log(chalk.bold.magenta('\n--- Checking for Sub-bots in ./OthoJadiBot ---\n'));
    if (!existsSync(global.jadi)) {
        console.warn(chalk.yellow(`Folder '${global.jadi}' not found. No sub-bots to connect.`));
        return;
    }
    const subBotFolders = readdirSync(global.jadi, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    if (subBotFolders.length === 0) {
        console.log(chalk.bold.yellow('No sub-bot folders found in ./OthoJadiBot.'));
        return;
    }

    for (const folder of subBotFolders) {
        // Ensure creds.json exists in the sub-bot's session folder
        if (existsSync(path.join(global.jadi, folder, 'creds.json'))) {
            await connectSubBot(folder);
        } else {
            console.warn(chalk.yellow(`Skipping sub-bot '${folder}': creds.json not found.`));
        }
    }
    console.log(chalk.bold.magenta('\n--- Sub-bot connection process initiated ---\n'));
}


// Main bot connection update handler
async function connectionUpdate(update) {
    const { connection, lastDisconnect } = update;
    global.stopped = connection;
    // Removed isNewLogin check for global.conn.isInit to simplify, as it's not strictly necessary here.
    // If you explicitly need `conn.isInit` for other logic, ensure it's set correctly.

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
        // Call connectAllSubBots every time the main bot connects successfully
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
let handler = await import('./handler.js'); // Assuming handler.js exists
global.reloadHandler = async function(restatConn) {
    try {
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
        global.conn.ev.off('messages.upsert', global.conn.handler);
        global.conn.ev.off('connection.update', global.conn.connectionUpdate);
        global.conn.ev.off('creds.update', global.conn.credsUpdate);
    }

    global.conn.handler = handler.handler.bind(global.conn);
    global.conn.connectionUpdate = connectionUpdate.bind(global.conn); // Ensure this is defined
    global.conn.credsUpdate = saveCreds.bind(global.conn, true); // Ensure this is defined

    const currentDateTime = new Date();
    // The line `const messageDateTime = new Date(conn.ev)` was removed as `conn.ev` is an EventEmitter, not a date.
    // The following chat filtering logic seems detached from a real-time message event anyway.
    // If you need to process chats based on time, you'd need a different mechanism.

    const chats = Object.entries(global.conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0]);


    global.conn.ev.on('messages.upsert', global.conn.handler);
    global.conn.ev.on('connection.update', global.conn.connectionUpdate);
    global.conn.ev.on('creds.update', global.conn.credsUpdate);
    isInit = false;
    return true;
};

const pluginFolder = global.__dirname(join(__dirname, './plugins/index')); // Assuming plugins/index exists
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};
async function filesInit() {
    for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
        try {
            const file = global.__filename(join(pluginFolder, filename));
            const module = await import(file);
            global.plugins[filename] = module.default || module;
        } catch (e) {
            global.conn.logger.error(e); // Use global.conn.logger
            delete global.plugins[filename];
        }
    }
}
filesInit().then((_) => Object.keys(global.plugins)).catch(console.error);

global.reload = async (_ev, filename) => {
    if (pluginFilter(filename)) {
        const dir = global.__filename(join(pluginFolder, filename), true);
        if (filename in global.plugins) {
            if (existsSync(dir)) global.conn.logger.info(` updated plugin - '${filename}'`); // Use global.conn.logger
            else {
                global.conn.logger.warn(`deleted plugin - '${filename}'`); // Use global.conn.logger
                return delete global.plugins[filename];
            }
        } else global.conn.logger.info(`new plugin - '${filename}'`); // Use global.conn.logger
        const err = syntaxerror(readFileSync(dir), filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
        });
        if (err) global.conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`); // Use global.conn.logger
        else {
            try {
                const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
                global.plugins[filename] = module.default || module;
            } catch (e) {
                global.conn.logger.error(`error require plugin '${filename}\n${format(e)}'`); // Use global.conn.logger
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
    // Ensure the tmp directory exists before trying to read it
    if (!existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const filenames = readdirSync(tmpDir);
    filenames.forEach(file => {
        const filePath = join(tmpDir, file);
        // Only unlink if it's a file, not a directory
        if (statSync(filePath).isFile()) {
            unlinkSync(filePath);
        }
    });
}

function purgeSession() {
    let prekey = [];
    // Ensure the sessions directory exists
    if (!existsSync(`./${global.sessions}`)) {
        console.warn(chalk.yellow(`Session directory './${global.sessions}' not found for purging.`));
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
            console.warn(chalk.yellow(`Sub-bot directory './${global.jadi}' not found for purging.`));
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
        // Check if directory exists before trying to read it
        if (!existsSync(dir)) {
            console.warn(chalk.yellow(`Directory '${dir}' not found for purging old files.`));
            return;
        }
        readdirSync(dir).forEach(file => { // Removed err parameter as it's typically handled by try-catch or existsSync
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
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Use global.stopped
    await clearTmp();
    console.log(chalk.bold.cyanBright(`\n╭» 🟢 MULTIMEDIA 🟢\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 4); // 4 min

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Use global.stopped
    await purgeSession();
    console.log(chalk.bold.cyanBright(`\n╭» 🔵 ${global.sessions} 🔵\n│→ SESIONES NO ESENCIALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 10); // 10 min

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Use global.stopped
    await purgeSessionSB();
}, 1000 * 60 * 10);

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return; // Use global.stopped
    await purgeOldFiles();
    console.log(chalk.bold.cyanBright(`\n╭» 🟠 ARCHIVOS 🟠\n│→ ARCHIVOS RESIDUALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 10);

_quickTest().then(() => global.conn.logger.info(chalk.bold(`🔵  H E C H O\n`.trim()))).catch(console.error); // Use global.conn.logger
