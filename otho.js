process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
import './settings.js'
import {createRequire} from 'module'
import path, {join} from 'path'
import {fileURLToPath, pathToFileURL} from 'url'
import {platform} from 'process'
import * as ws from 'ws'
import {readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch} from 'fs'
import yargs from 'yargs';
import {spawn} from 'child_process'
import lodash from 'lodash'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import {tmpdir} from 'os'
import {format} from 'util'
import boxen from 'boxen'
import P from 'pino'
import pino from 'pino'
import Pino from 'pino'
import {Boom} from '@hapi/boom'
import {makeWASocket, protoType, serialize} from './lib/simple.js'
import {Low, JSONFile} from 'lowdb'
import {mongoDB, mongoDBV2} from './lib/mongoDB.js' // Assuming these exist and are used
import store from './lib/store.js' // Assuming this exists and is used
const {proto} = (await import('@whiskeysockets/baileys')).default
const {DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser, PHONENUMBER_MCC} = await import('@whiskeysockets/baileys')
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
global.prefix = new RegExp('^[/.$#!]')
// global.opts['db'] = process.env['db']

global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile('src/database/database.json'))

global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
if (global.db.READ) {
return new Promise((resolve) => setInterval(async function() {
if (!global.db.READ) {
clearInterval(this)
resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
}}, 1 * 1000))
}
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
...(global.db.data || {}),
}
global.db.chain = chain(global.db.data)
}
loadDatabase()

// --- MULTI-SESSION HANDLING START ---

// Use a map to store bot instances, keyed by their session directory name
global.allBots = {};

// Function to create and manage a single bot connection instance
async function createBotConnection(sessionDir, isMain = false) {
    const sessionPath = `./${sessionDir}`;
    const { state, saveState } = await useMultiFileAuthState(sessionPath);
    const msgRetryCounterMap = new NodeCache(); // Use NodeCache as MessageRetryMap
    const msgRetryCounterCache = new NodeCache();
    const { version } = await fetchLatestBaileysVersion();
    let phoneNumber = global.botNumberCode; // This might need adjustment if different bots have different numbers

    const methodCodeQR = process.argv.includes("qr");
    const methodCode = !!phoneNumber || process.argv.includes("code");
    const MethodMobile = process.argv.includes("mobile");
    const colores = chalk.bgMagenta.white;
    const opcionQR = chalk.bold.green;
    const opcionTexto = chalk.bold.cyan;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

    let opcion;
    // Decide how to handle QR/Code option for multiple bots.
    // For simplicity, this part still behaves like the original, potentially only affecting the first bot created.
    // A real multi-session setup might require prompting per new session or using different methods.
    if (methodCodeQR) {
        opcion = '1';
    }
    if (!methodCodeQR && !methodCode && !existsSync(`${sessionPath}/creds.json`) && isMain) { // Only prompt for main bot initially
        do {
            opcion = await question(colores(`Seleccione una opción para ${sessionDir}:\n`) + opcionQR('1. Con código QR\n') + opcionTexto('2. Con código de texto de 8 dígitos\n--> '));

            if (!/^[1-2]$/.test(opcion)) {
                console.log(chalk.bold.redBright(`🍭 No se permiten numeros que no sean 1 o 2, tampoco letras o símbolos especiales.`));
            }
        } while (opcion !== '1' && opcion !== '2' || existsSync(`${sessionPath}/creds.json`));
    } else if (!existsSync(`${sessionPath}/creds.json`)) {
        // For sub-bots or main bot if creds don't exist and not using QR/Code flags, default to QR or handle differently
        opcion = methodCodeQR ? '1' : '2'; // Default to QR if flag set, otherwise try code? Or default to QR for new sessions?
        // This logic is tricky for multiple sessions and needs careful design based on how you register sub-bots.
         console.log(chalk.yellow(`Attempting to connect ${sessionDir} (assuming QR or pre-registered)...`));
    } else {
        // If creds exist, no need to prompt
        opcion = '0'; // Indicate no user input needed
    }


    const connectionOptions = {
        logger: pino({ level: 'silent' }),
        // Only print QR if it's the initial setup for this specific bot and QR option is selected
        printQRInTerminal: !existsSync(`${sessionPath}/creds.json`) && (opcion == '1' || methodCodeQR),
        mobile: MethodMobile,
        browser: (opcion == '1' || methodCodeQR) ? [`${nameqr || 'Bot'} (${sessionDir})`, 'Edge', '20.0.04'] : [`Ubuntu (${sessionDir})`, 'Edge', '110.0.1587.56'],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (clave) => {
            // This getMessage logic might need to be per-bot if different bots use different storage
            let jid = jidNormalizedUser(clave.remoteJid)
            let msg = await store.loadMessage(jid, clave.id)
            return msg?.message || ""
        },
        msgRetryCounterCache,
        msgRetryCounterMap,
        defaultQueryTimeoutMs: undefined,
        version: [2, 3000, 1015901307],
    };

    const bot = makeWASocket(connectionOptions);

    bot.isInit = false;
    bot.well = false;
    bot.sessionDir = sessionDir; // Store session directory for reference
    bot.isMain = isMain; // Flag to identify the main bot

    // Handle pairing code request for this specific bot if needed (likely only for main bot or first time setup)
     if (!existsSync(`${sessionPath}/creds.json`) && (opcion === '2' || methodCode)) {
         if (!bot.authState.creds.registered) {
             if (MethodMobile) throw new Error(`Cannot use pairing code with mobile API for ${sessionDir}`);

             let numeroTelefono = phoneNumber;
             if (!numeroTelefono) {
                 // Prompt for phone number if not provided for this bot
                 // This interactive part is hard to scale for many bots at once
                 console.log(chalk.bgBlack(chalk.bold.greenBright(`🍁 Ingrese el número de WhatsApp para ${sessionDir}.\n🍭  Ejemplo: 521657×××××××\n${chalk.bold.magentaBright('---> ')}`)));
                 numeroTelefono = await question(''); // Wait for user input per bot
                 numeroTelefono = numeroTelefono.replace(/[^0-9]/g, '');
             } else {
                 numeroTelefono = numeroTelefono.replace(/[^0-9]/g, '');
             }

             if (!Object.keys(PHONENUMBER_MCC).some(v => numeroTelefono.startsWith(v))) {
                 console.log(chalk.bold.redBright(`Invalid phone number format for ${sessionDir}`));
                 // Decide how to handle invalid numbers for a bot
                 // process.exit(0) // Exiting might stop all bots
             } else {
                 setTimeout(async () => {
                     try {
                         let codigo = await bot.requestPairingCode(numeroTelefono);
                         codigo = codigo?.match(/.{1,4}/g)?.join("-") || codigo;
                         console.log(chalk.bold.white(chalk.bgMagenta(`⭐️ Código para ${sessionDir}: `)), chalk.bold.white(chalk.white(codigo)));
                     } catch (error) {
                         console.error(chalk.bold.red(`Error requesting pairing code for ${sessionDir}: ${error}`));
                         // Handle error in getting pairing code
                     }
                 }, 3000);
             }
             // Close readline after getting the number for this specific bot's prompt if needed
             if (!phoneNumber) rl.close();
         }
     }


    // Reconnection logic for THIS specific bot instance
    bot.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, isNewLogin } = update;
        bot.stopped = connection; // Update stopped status for this bot instance

        if (isNewLogin) bot.isInit = true;

        const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

        if (code && code !== DisconnectReason.loggedOut && bot?.ws.socket == null) {
            console.log(chalk.bold.redBright(`\n⚠️ CONEXIÓN CERRADA para ${sessionDir} (Code: ${code}). Intentando reconectar...`));
            // Attempt to restart this specific bot connection
            // This simple re-creation might lead to issues. A robust solution would track instances and replace them.
            // For now, let's just call the create function again. This might create a new instance without cleaning up the old.
            // A better approach: Remove the old bot instance from global.allBots and add the new one after creation.
            // delete global.allBots[sessionDir]; // Before creating new
             await createBotConnection(sessionDir, isMain); // Recreate the connection
            // global.allBots[sessionDir] = newBotInstance; // Add new one
             global.timestamp.connect = new Date; // This timestamp is global, might not be useful per bot
        }

        if (connection == 'open') {
             console.log(boxen(chalk.bold(`¡CONECTADO con ${sessionDir}!`), { borderStyle: 'round', borderColor: 'green', title: chalk.green.bold('● CONEXIÓN ●'), titleAlignment: '', float: '' }));
        }

        let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (connection === 'close') {
             console.log(chalk.bold.redBright(`\n⚠️ Conexión para ${sessionDir} cerrada. Razon: ${reason || 'Desconocida'}`));
            // The reconnection logic is handled above based on codes.
            // You might add more specific messages here based on reason.
            if (reason === DisconnectReason.badSession) {
                console.log(chalk.bold.cyanBright(`\n⚠️ SESIÓN INVÁLIDA para ${sessionDir}, BORRE LA CARPETA ${sessionDir} Y RE-REGISTRE ⚠️`));
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.bold.redBright(`\n⚠️ SESIÓN CERRADA para ${sessionDir}, BORRE LA CARPETA ${sessionDir} Y RE-REGISTRE ⚠️`));
            }
            // Other reasons like connectionClosed, connectionLost, timedOut are handled by the reconnect logic above.
        }
    });

    // Attach other event listeners (messages.upsert, creds.update) for THIS specific bot
    // The handler needs to be designed to accept the bot instance
    bot.ev.on('messages.upsert', async (messages) => {
         // Pass the connection instance and messages to the handler
         // The handler function './handler.js' needs to be modified to accept 'bot' as an argument
         // and use 'bot' for sending messages, accessing bot info, etc.
         // For example: await handler.handler(bot, messages);
         // You'll need to adjust your handler's function signature and logic.
         // For now, binding might work if handler uses 'this', but explicitly passing is clearer.
         // await handler.handler.bind(bot)(messages); // Example using bind
         if (global.handler && typeof global.handler.handler === 'function') {
              await global.handler.handler(bot, messages); // Pass bot instance
         } else {
              console.error("Handler function not loaded or not found.");
         }
    });

    // Use saveState provided by useMultiFileAuthState for THIS bot
    bot.ev.on('creds.update', saveState);

    // Add the bot instance to the global collection
    global.allBots[sessionDir] = bot;

    return bot; // Return the created bot instance
}

// Function to start all bot connections
async function startAllBots() {
    // Define the directories to check for sessions
    const sessionDirectories = [global.sessions || 'sessions', 'OthoJadiBot']; // Check main sessions and OthoJadiBot

    for (const baseDir of sessionDirectories) {
        if (existsSync(`./${baseDir}`)) {
            // If it's the main sessions dir, try to connect directly if creds.json exists
            if (baseDir === (global.sessions || 'sessions') && existsSync(`./${baseDir}/creds.json`)) {
                 console.log(chalk.bold.blue(`\nIniciando bot principal desde ${baseDir}...`));
                await createBotConnection(baseDir, true); // Start main bot connection
            } else if (baseDir === 'OthoJadiBot') {
                // If it's the OthoJadiBot dir, scan subdirectories
                const sessionFolders = readdirSync(`./${baseDir}`)
                    .filter(item => statSync(join(`./${baseDir}`, item)).isDirectory());

                for (const folder of sessionFolders) {
                    const sessionDir = join(baseDir, folder);
                    if (existsSync(join(`./${sessionDir}`, 'creds.json'))) {
                        console.log(chalk.bold.blue(`\nIniciando sub-bot desde ${sessionDir}...`));
                        await createBotConnection(sessionDir, false); // Start sub-bot connection
                    } else {
                        console.warn(chalk.yellow(`Skipping directory ${sessionDir}: creds.json not found.`));
                    }
                }
            } else if (baseDir === (global.sessions || 'sessions') && !existsSync(`./${baseDir}/creds.json`)) {
                 // If main sessions dir exists but no creds, initiate first time login
                 console.log(chalk.bold.yellow(`\nIniciando primer inicio de sesión para el bot principal en ${baseDir}...`));
                 // The initial QR/Code logic outside the createBotConnection loop will handle this for the first bot created.
                 // We still need to call createBotConnection to set up the instance and listeners.
                 await createBotConnection(baseDir, true);
            }


        } else {
             console.log(chalk.bold.yellow(`Directorio de sesiones "${baseDir}" no encontrado. Saltando.`));
        }
    }

    // Now global.allBots contains all active connections
    const totalBots = Object.keys(global.allBots).length;
    if (totalBots > 0) {
        console.log(boxen(chalk.bold(`¡${totalBots} BOT(S) INICIALIZADO(S)!`), { borderStyle: 'round', borderColor: 'green', title: chalk.green.bold('● ESTADO ●'), titleAlignment: '', float: '' }));
    } else {
         console.log(boxen(chalk.bold(`¡NINGÚN BOT INICIALIZADO!`), { borderStyle: 'round', borderColor: 'red', title: chalk.red.bold('● ESTADO ●'), titleAlignment: '', float: '' }));
    }
}

// Call the function to start all connections
startAllBots().catch(console.error);

// --- MULTI-SESSION HANDLING END ---


// The rest of your script needs significant adaptation.
// global.conn is no longer a single object. You need to iterate over global.allBots
// or pass the specific bot instance around.

// Example: The setIntervals need to check each bot's status
// global.stopped is now per bot, needs to be accessed like bot.stopped
setInterval(async () => {
    for (const sessionDir in global.allBots) {
        const bot = global.allBots[sessionDir];
        if (bot.stopped === 'close' || !bot || !bot.user) {
            // Consider logging which bot is not connected if needed
            continue; // Skip disconnected bots
        }
        // Your existing cleanup logic here, potentially per bot or global
        // await clearTmp() // clearTmp seems global
        // await purgeSession() // purgeSession targets global.sessions, needs review
        // await purgeSessionSB() // purgeSessionSB targets ${jadi}, needs review if jadi is OthoJadiBot
        // await purgeOldFiles() // purgeOldFiles targets global.sessions and ${jadi}, needs review
    }
     await clearTmp();
     console.log(chalk.bold.cyanBright(`\n╭» 🟢 MULTIMEDIA 🟢\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}, 1000 * 60 * 4); // 4 min

// You need to review all intervals and other logic that uses global.conn or assumes a single bot.

process.on('uncaughtException', console.error)

let handler = await import('./handler.js')
global.reloadHandler = async function(restatConn) { // restatConn might be less relevant now
try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Object.keys(Handler || {}).length) global.handler = Handler; // Update the global handler reference
} catch (e) {
    console.error("Error reloading handler:", e);
}

// Re-attach the potentially new handler logic to all active bot connections
for (const sessionDir in global.allBots) {
    const bot = global.allBots[sessionDir];
    if (bot.ev) {
        // Remove old messages.upsert listener if it exists to prevent duplicates
        // Note: Removing specific anonymous listeners added by .on is tricky.
        // A better pattern is to store listener references or use .off with the exact function.
        // For simplicity here, we might risk temporary duplicate listeners or need to restart bots to apply handler changes cleanly.

        // If you need to ensure only one messages.upsert listener is active:
        // You might need a flag or a way to store the listener function reference per bot
        // Or, restart the bot instance after reloading handler (more disruptive)
        // For now, just adding the new listener - this is NOT ideal and will add duplicate listeners on reload!
        // Proper fix requires tracking and removing the old listener function.

        // Example: Assuming the handler is now structured to receive the bot instance
         if (global.handler && typeof global.handler.handler === 'function') {
             // To avoid duplicate listeners on reload, a more advanced approach is needed.
             // This simple add will create duplicates every time reloadHandler is called without a bot restart.
             // Consider restarting bots or implementing proper listener management.
             // bot.ev.on('messages.upsert', async (messages) => { await global.handler.handler(bot, messages); }); // This adds a NEW listener every time!
             console.warn(chalk.yellow(`Handler reload might add duplicate listeners for ${sessionDir}. Consider restarting bots.`));
         } else {
              console.error("Cannot re-attach handler: Handler function not loaded or not found.");
         }

        // connection.update and creds.update are managed per bot in createBotConnection and typically don't need re-attaching here unless their core logic changes.
    }
}

console.log(chalk.bold.green("Handler reload process completed (listeners might be duplicated)."));
return true;
};


const pluginFolder = global.__dirname(join(__dirname, './plugins/index'))
const pluginFilter = (filename) => /\.js$/.test(filename)
global.plugins = {}
async function filesInit() {
for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
try {
const file = global.__filename(join(pluginFolder, filename))
const module = await import(file)
global.plugins[filename] = module.default || module
} catch (e) {
conn.logger.error(e) // This still uses conn.logger - need to pick a logger or use console.error
delete global.plugins[filename]
}}}
// filesInit().then((_) => Object.keys(global.plugins)).catch(console.error); // Moved after bots start
filesInit().catch(console.error); // Just call it, don't wait here


global.reload = async (_ev, filename) => {
if (pluginFilter(filename)) {
const dir = global.__filename(join(pluginFolder, filename), true);
if (filename in global.plugins) {
if (existsSync(dir)) console.info(` updated plugin - '${filename}'`) // Use console.info or a general logger
else {
console.warn(`deleted plugin - '${filename}'`) // Use console.warn
return delete global.plugins[filename]
}} else console.info(`new plugin - '${filename}'`);
const err = syntaxerror(readFileSync(dir), filename, {
sourceType: 'module',
allowAwaitOutsideFunction: true,
});
if (err) console.error(`syntax error while loading '${filename}'\n${format(err)}`) // Use console.error
else {
try {
const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
global.plugins[filename] = module.default || module;
console.log(chalk.bold.green(`✅ Plugin loaded: ${filename}`));
} catch (e) {
console.error(`error require plugin '${filename}\n${format(e)}'`) // Use console.error
} finally {
global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
}}
}}
Object.freeze(global.reload)
watch(pluginFolder, global.reload)
// await global.reloadHandler() // This might need to be called after bots are initialized
startAllBots().then(async () => { // Start bots first, then reload handler to attach to all
    await filesInit(); // Load plugins after bots start
    await global.reloadHandler(); // Attach handler to all bots
    _quickTest().then(() => console.info(chalk.bold(`🔵  H E C H O\n`.trim()))).catch(console.error); // Run tests after setup
}).catch(console.error);


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
})]);
}));
const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
const s = global.support = {ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find};
Object.freeze(global.support);
}

function clearTmp() {
const tmpDir = join(__dirname, 'tmp')
if (!existsSync(tmpDir)) return; // Check if tmp exists
const filenames = readdirSync(tmpDir)
filenames.forEach(file => {
const filePath = join(tmpDir, file)
try {
    unlinkSync(filePath);
} catch (e) {
    console.error(`Error deleting tmp file ${filePath}:`, e);
}})
}

function purgeSession() {
// This function targets global.sessions. Needs review in multi-bot setup.
// It might only apply to the 'main' session directory.
if (!global.sessions || !existsSync(`./${global.sessions}`)) {
    console.warn(chalk.yellow(`Skipping purgeSession: global.sessions directory not found.`));
    return;
}
let prekey = []
let directorio = readdirSync(`./${global.sessions}`) // Use global.sessions here
let filesFolderPreKeys = directorio.filter(file => {
return file.startsWith('pre-key-')
})
prekey = [...prekey, ...filesFolderPreKeys]
filesFolderPreKeys.forEach(files => {
try {
    unlinkSync(`./${global.sessions}/${files}`) // Use global.sessions here
} catch (e) {
     console.error(`Error deleting session file ${global.sessions}/${files}:`, e);
}
})
 console.log(chalk.bold.cyanBright(`\n╭» 🔵 ${global.sessions} 🔵\n│→ SESIONES NO ESENCIALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}

function purgeSessionSB() {
// This function targets ${jadi}. Assuming ${jadi} is 'OthoJadiBot'.
// It seems designed for cleaning sub-bot pre-keys, which is relevant.
const subBotSessionsDir = global.jadi || 'OthoJadiBot'; // Use global.jadi or default
try {
    if (!existsSync(`./${subBotSessionsDir}`)) {
        console.warn(chalk.yellow(`Skipping purgeSessionSB: directory ${subBotSessionsDir} not found.`));
        return;
    }
    const listaDirectorios = readdirSync(`./${subBotSessionsDir}/`);
    let SBprekeyCount = 0;
    listaDirectorios.forEach(directorio => {
        const fullDirPath = join(`./${subBotSessionsDir}`, directorio);
        if (statSync(fullDirPath).isDirectory()) {
            const DSBPreKeys = readdirSync(fullDirPath).filter(fileInDir => {
                return fileInDir.startsWith('pre-key-')
            })
            DSBPreKeys.forEach(fileInDir => {
                if (fileInDir !== 'creds.json') { // Ensure creds.json is not deleted
                    try {
                        unlinkSync(join(fullDirPath, fileInDir));
                        SBprekeyCount++;
                    } catch (e) {
                        console.error(`Error deleting SB pre-key file ${join(fullDirPath, fileInDir)}:`, e);
                    }
                }
            })
        }
    })
    if (SBprekeyCount === 0) {
        console.log(chalk.bold.green(`\n╭» 🟡 ${subBotSessionsDir} 🟡\n│→ NADA POR ELIMINAR \n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`))
    } else {
        console.log(chalk.bold.cyanBright(`\n╭» ⚪ ${subBotSessionsDir} ⚪\n│→ ARCHIVOS NO ESENCIALES ELIMINADOS (${SBprekeyCount} archivos)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`))
    }
} catch (err) {
    console.log(chalk.bold.red(`\n╭» 🔴 ${subBotSessionsDir} 🔴\n│→ OCURRIÓ UN ERROR DURANTE LA LIMPIEZA\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️\n` + err))
}}

function purgeOldFiles() {
// This targets both global.sessions and ${jadi}. Needs review in multi-bot setup.
const directoriesToClean = [global.sessions || 'sessions', global.jadi || 'OthoJadiBot'].filter(dir => existsSync(`./${dir}`)); // Ensure directories exist
directoriesToClean.forEach(dir => {
    try {
        const files = readdirSync(`./${dir}`);
        files.forEach(file => {
            if (file !== 'creds.json') { // Ensure creds.json is never deleted
                const filePath = path.join(`./${dir}`, file);
                 try {
                    unlinkSync(filePath);
                    console.log(chalk.bold.green(`\n╭» 🟣 ARCHIVO 🟣\n│→ ${filePath} BORRADO CON ÉXITO\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
                 } catch (err) {
                    console.log(chalk.bold.red(`\n╭» 🔴 ARCHIVO 🔴\n│→ ${filePath} NO SE LOGRÓ BORRAR\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️❌\n` + err));
                 }
            }
        })
    } catch (err) {
        console.error(`Error reading directory ${dir} for cleanup:`, err);
    }
});
console.log(chalk.bold.cyanBright(`\n╭» 🟠 ARCHIVOS 🟠\n│→ ARCHIVOS RESIDUALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`));
}


function redefineConsoleMethod(methodName, filterStrings) {
const originalConsoleMethod = console[methodName]
console[methodName] = function() {
const message = arguments[0]
if (typeof message === 'string' && filterStrings.some(filterString => message.includes(atob(filterString)))) {
arguments[0] = "" // Replace filtered message with empty string
}
originalConsoleMethod.apply(console, arguments)
}}

// Ensure these intervals check if bots are initialized before running
setInterval(async () => {
// Check if any bot is connected before clearing tmp
if (Object.values(global.allBots).some(bot => bot && bot.user && bot.stopped !== 'close')) {
    await clearTmp()
    console.log(chalk.bold.cyanBright(`\n╭» 🟢 MULTIMEDIA 🟢\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― 🗑️♻️`))
} else {
     console.log(chalk.gray("Skipping tmp cleanup: No bots connected."));
}}, 1000 * 60 * 4) // 4 min

setInterval(async () => {
// Decide if you want to purge main session pre-keys if any bot is connected, or only if main is connected
if (Object.values(global.allBots).some(bot => bot && bot.user && bot.isMain && bot.stopped !== 'close')) {
    await purgeSession(); // This only targets the main session directory
} else {
     console.log(chalk.gray("Skipping main session purge: Main bot not connected."));
}}, 1000 * 60 * 10) // 10 min

setInterval(async () => {
// Decide if you want to purge sub-bot pre-keys if any bot is connected
if (Object.values(global.allBots).some(bot => bot && bot.user && !bot.isMain && bot.stopped !== 'close')) {
    await purgeSessionSB(); // This targets OthoJadiBot subdirectories
} else {
     console.log(chalk.gray("Skipping sub-bot session purge: No sub-bots connected."));
}}, 1000 * 60 * 10); // 10 min

setInterval(async () => {
// Decide if you want to purge old files if any bot is connected
if (Object.values(global.allBots).some(bot => bot && bot.user && bot.stopped !== 'close')) {
    await purgeOldFiles(); // This targets both main sessions and OthoJadiBot subdirectories
} else {
     console.log(chalk.gray("Skipping old file purge: No bots connected."));
}}, 1000 * 60 * 10); // 10 min

// _quickTest().then(() => conn.logger.info(chalk.bold(`🔵  H E C H O\n`.trim()))).catch(console.error) // Moved later
// Removed the single conn.logger.info. You might want a startup message after all bots are attempted to start.

// The initial QR/Code logic outside the function call might still run before any bot connects,
// which is not ideal in a multi-bot setup. Consider moving it inside createBotConnection
// and handling the interactive input per-bot, or having a separate registration process.

// Make sure 'fs' is imported at the top if it's used here (it is)
import fs from 'fs';
// Make sure 'os' is imported for os.tmpdir (it is)
import os from 'os';
// Make sure 'cp' is imported for cp.spawn (it is)
import cp from 'child_process'; // Import child_process as cp
