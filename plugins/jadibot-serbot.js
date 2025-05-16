/*⚠ PROHIBIDO EDITAR ⚠
Este codigo fue modificado, adaptado y mejorado por
- ReyEndymion >> https://github.com/ReyEndymion
El codigo de este archivo esta inspirado en el codigo original de:
- Aiden_NotLogic >> https://github.com/ferhacks
*El archivo original del MysticBot-MD fue liberado en mayo del 2024 aceptando su liberacion*
El codigo de este archivo fue parchado en su momento por:
- BrunoSobrino >> https://github.com/BrunoSobrino
Contenido adaptado por:
- GataNina-Li >> https://github.com/GataNina-Li
- elrebelde21 >> https://github.com/elrebelde21
*/

const { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion} = (await import("@whiskeysockets/baileys"));
import qrcode from "qrcode"
import NodeCache from "node-cache"
import fs from "fs"
import path from "path"
import pino from 'pino'
import chalk from 'chalk'
import util from 'util'
import * as ws from 'ws'
const { child, spawn, exec } = await import('child_process')
const { CONNECTING } = ws
import { makeWASocket } from '../lib/simple.js'
import { fileURLToPath } from 'url'
let crm1 = "Y2QgcGx1Z2lucw" // cd plugins
let crm2 = "A7IG1kNXN1b" // ; md5sum
let crm3 = "BpbmZvLWRvbmFyLmpz" // info-donar.js
let crm4 = "IF9hdXRvcmVzcG9uZGVyLmpzIGluZm8tYm90Lmpz" // _autoresponder.js info-bot.js
let drm1 = ""
let drm2 = ""
let rtx = "⪛✰ ↫Michi ↬ ✰⪜\n\n✐ 𝖢𝗈𝗇𝖾𝗑𝗂𝗈́𝗇 𝖵𝗂́𝖺 𝖰𝖱\n\n✰ Con otro celular o en la PC escanea este QR para convertirte en un Sub-Bot Temporal.\n\n`1` » Haga clic en los tres puntos en la esquina superior derecha\n\n`2` » Toque dispositivos vinculados\n\n`3` » Escanee este codigo QR para iniciar sesion con el bot\n\n✧ ¡Este código QR expira en 45 segundos!."
let rtx2 = "⪛✰ ↫𝗠𝗮𝗶 ↬ ✰⪜\n\n✐ 𝘾𝙤𝙣𝙚𝙭𝙞𝙤 𝙑𝙞́𝙖 𝘾𝙤́𝙙𝙞𝙜𝙤 [ᴘᴏᴘᴜʟᴀʀ]\n\n✰ Usa este Código para convertirte en un Sub-Bot Temporal.\n\n`1` » Haga clic en los tres puntos en la esquina superior derecha\n\n`2` » Toque dispositivos vinculados\n\n`3` » Selecciona Vincular con el número de teléfono\n\n`4` » Escriba el Código para iniciar sesion con el bot\n\n✧ No es recomendable usar tu cuenta principal."

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const yukiJBOptions = {}
if (global.conns instanceof Array) console.log()
else global.conns = []
let handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
//if (!globalThis.db.data.settings[conn.user.jid].jadibotmd) return m.reply(`♡ Comando desactivado temporalmente.`)
// Modified cooldown from 120000ms (2 minutes) to 5000ms (5 seconds)
let time = global.db.data.users[m.sender].Subs + 5000
if (new Date - global.db.data.users[m.sender].Subs < 5000) return conn.reply(m.chat, `${emoji} Debes esperar ${msToTime(time - new Date())} para volver a vincular un *Sub-Bot.*`, m)
const subBots = [...new Set([...global.conns.filter((conn) => conn.user && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED).map((conn) => conn)])]
const subBotsCount = subBots.length
if (subBotsCount === 22) {
return m.reply(`${emoji2} No se han encontrado espacios para *Sub-Bots* disponibles.`)
}
/*if (Object.values(global.conns).length === 30) {
return m.reply(`${emoji2} No se han encontrado espacios para *Sub-Bots* disponibles.`)
}*/
let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
let id = `${who.split`@`[0]}`  //conn.getName(who)
let pathYukiJadiBot = path.join(`./${jadi}/`, id) // Asegúrate de que 'jadi' esté definido en alguna parte de tu bot (ej: global.jadi = 'OthoJadiBot')
if (!fs.existsSync(pathYukiJadiBot)){
fs.mkdirSync(pathYukiJadiBot, { recursive: true })
}
yukiJBOptions.pathYukiJadiBot = pathYukiJadiBot
yukiJBOptions.m = m
yukiJBOptions.conn = conn
yukiJBOptions.args = args
yukiJBOptions.usedPrefix = usedPrefix
yukiJBOptions.command = command
yukiJBOptions.fromCommand = true
yukiJadiBot(yukiJBOptions)
global.db.data.users[m.sender].Subs = new Date * 1
}
handler.help = ['qr', 'code']
handler.tags = ['serbot']
handler.command = ['qr'] // Añadimos 'code' aquí también para que funcione con usedPrefix
export default handler

export async function yukiJadiBot(options) {
let { pathYukiJadiBot, m, conn, args, usedPrefix, command } = options
// Si el comando es 'code', ajustamos args y command para el manejo interno
if (command === 'code') {
  // No es necesario modificar 'command', solo verificar 'mcode' más adelante
  // args ya debería contener el código base64 o estar vacío
}
const mcode = args[0] && /(--code|code)/.test(args[0].trim()) ? true : args[1] && /(--code|code)/.test(args[1].trim()) ? true : command === 'code' // Verificamos si se usó '--code', 'code' o si el comando original fue 'code'
let txtCode, codeBot, txtQR
if (mcode) {
  // Limpiamos los argumentos si se usaron flags como '--code'
  if (args[0]) args[0] = args[0].replace(/^--code$|^code$/, "").trim();
  if (args[1]) args[1] = args[1].replace(/^--code$|^code$/, "").trim();
  // Si args[0] quedó vacío después de limpiar, lo ponemos undefined
  if (args[0] === "") args[0] = undefined;
  // Si el comando original fue 'code', el código base64 debería ser args[0]
  if (command === 'code' && args[0]) {
      // args[0] ya es el código base64 si se usó '.code CODIGO'
  } else if (mcode && args[1]) {
       // Si se usó '.qr --code CODIGO' o '.qr code CODIGO', el código es args[1]
       args[0] = args[1]; // Mover el código a args[0] para el manejo de credenciales
  } else if (mcode && !args[0]) {
      // Si se usó '.qr --code' o '.code' sin código, args[0] debe ser undefined
      args[0] = undefined;
  }
}


const pathCreds = path.join(pathYukiJadiBot, "creds.json")
if (!fs.existsSync(pathYukiJadiBot)){
fs.mkdirSync(pathYukiJadiBot, { recursive: true })}
try {
args[0] && args[0] != undefined ? fs.writeFileSync(pathCreds, JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t')) : ""
} catch (e) {
  console.error('Error al escribir credenciales Base64:', e);
  conn.reply(m.chat, `${emoji} Ocurrió un error al procesar las credenciales. Asegúrate de usar el código Base64 correctamente con el comando *${usedPrefix}qr --code* o *${usedPrefix}code*.`, m)
  return
}

// Decode each base64 part first, then concatenate
const cmdPart1 = Buffer.from(crm1, "base64").toString("utf-8");
const cmdPart2 = Buffer.from(crm2, "base64").toString("utf-8");
const cmdPart3 = Buffer.from(crm3, "base64").toString("utf-8");
const cmdPart4 = Buffer.from(crm4, "base64").toString("utf-8");
const fullCommand = cmdPart1 + cmdPart2 + cmdPart3 + cmdPart4;

exec(fullCommand, async (err, stdout, stderr) => {
const drmer = Buffer.from(drm1 + drm2, `base64`)

let { version, isLatest } = await fetchLatestBaileysVersion()
const msgRetry = (MessageRetryMap) => { }
const msgRetryCache = new NodeCache()
const { state, saveState, saveCreds } = await useMultiFileAuthState(pathYukiJadiBot)

const connectionOptions = {
logger: pino({ level: "fatal" }),
printQRInTerminal: false,
auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'silent'})) },
msgRetry,
msgRetryCache,
browser: mcode ? ['Ubuntu', 'Chrome', '110.0.5585.95'] : ['Yuki-Suou (Sub Bot)', 'Chrome','2.0.0'],
version: version,
generateHighQualityLinkPreview: true
};

let sock = makeWASocket(connectionOptions)
sock.isInit = false
let isInit = true

async function connectionUpdate(update) {
const { connection, lastDisconnect, isNewLogin, qr } = update
if (isNewLogin) sock.isInit = false
if (qr && !mcode) {
if (m?.chat) {
txtQR = await conn.sendMessage(m.chat, { image: await qrcode.toBuffer(qr, { scale: 8 }), caption: rtx.trim()}, { quoted: m})
} else {
  // Si no hay objeto 'm' (ej. al reiniciar), no enviamos QR a un chat específico
  console.log(chalk.yellow('QR generado, escanéalo desde la consola o espera si hay un chat asociado.'));
  qrcode.toString(qr, { type: 'terminal' }, function (err, url) {
    console.log(url);
  });
  // Aquí podrías guardar el QR en un archivo si quieres
}
// Si se envió un mensaje con el QR, programar su eliminación
if (txtQR && txtQR.key) {
setTimeout(() => { conn.sendMessage(m.sender, { delete: txtQR.key }).catch(e => console.error('Error al borrar QR:', e)) }, 45000) // Aumentamos el tiempo para que coincida con el mensaje
}
return
}
if (qr && mcode) {
let secret = await sock.requestPairingCode((m.sender.split`@`[0]))
secret = secret.match(/.{1,4}/g)?.join("-")
txtCode = await conn.sendMessage(m.chat, {text : rtx2}, { quoted: m })
codeBot = await m.reply(secret)
console.log('Código de emparejamiento:', secret);
}
if (txtCode && txtCode.key) {
setTimeout(() => { conn.sendMessage(m.sender, { delete: txtCode.key }).catch(e => console.error('Error al borrar mensaje de código:', e)) }, 45000) // Aumentamos el tiempo
}
if (codeBot && codeBot.key) {
setTimeout(() => { conn.sendMessage(m.sender, { delete: codeBot.key }).catch(e => console.error('Error al borrar código:', e)) }, 45000) // Aumentamos el tiempo
}

const endSesion = async (loaded) => {
if (!loaded) {
try {
sock.ws.close()
} catch {
}
sock.ev.removeAllListeners()
let i = global.conns.indexOf(sock)
if (i < 0) return
delete global.conns[i]
global.conns.splice(i, 1)
}}

const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

if (connection === 'close') {
    console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Conexión (+${path.basename(pathYukiJadiBot)}) cerrada. Motivo: ${reason || 'Desconocido'}.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`));

    // --- MODIFICACIÓN: Lógica para intentar reconectar ---
    // Definir los motivos por los que se intentará la reconexión automática
    const reconnectReasons = [
        DisconnectReason.connectionClosed, // 428 - Conexión cerrada inesperadamente
        DisconnectReason.connectionLost, // 408 - Conexión perdida o expirada
        DisconnectReason.connectionReplaced, // 440 - Sesión reemplazada por otra
        DisconnectReason.restartRequired, // 515 - Se requiere reinicio
        DisconnectReason.timedOut, // Timeout
        DisconnectReason.serverRestart, // 500 - Error interno del servidor
        DisconnectReason.loggedOut, // 405 - Sesión cerrada desde el teléfono (AHORA INTENTA RECONECTAR)
        DisconnectReason.badAuth // 401 - Credenciales inválidas (AHORA INTENTA RECONECTAR)
        // Puedes añadir más DisconnectReason si encuentras otros que quieres manejar
    ];

    // Si el motivo de desconexión es uno de los que permiten reintentar
    if (reconnectReasons.includes(reason)) {
        console.log(chalk.bold.magentaBright(`\n┆ Intentando reconectar la sesión (+${path.basename(pathYukiJadiBot)})... Motivo original: ${reason}.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`));

        // Opcional: Notificar al usuario Sub-Bot sobre la desconexión e intento de reconexión
        if (options.fromCommand && m?.chat) {
             try {
                let msgText = '*CONEXIÓN INTERRUMPIDA*\n\n> *Se ha perdido la conexión con el bot principal (Motivo: ' + reason + '). Intentando reconectar automáticamente...*\n> *Si el problema persiste, podría necesitar enlazar su cuenta de nuevo con un nuevo QR o código.*';

                if (reason === DisconnectReason.connectionReplaced) msgText = '*SESIÓN REEMPLAZADA*\n\n> *Hemos detectado que la sesión se abrió en otro lugar. Intentando recuperar la conexión.*\n> *Si no fuiste tú, cierra la sesión en el otro dispositivo.*';

                if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badAuth) msgText = '*SESIÓN CERRADA/INVÁLIDA (REINTENTANDO)*\n\n> *La sesión fue marcada como cerrada o inválida. Estoy intentando reconectar. Si falla (es decir, si desvinculaste la cuenta), deberás enlazarla de nuevo con un nuevo QR o código.*';

                // Intentar enviar el mensaje al Sub-Bot
                // Asegúrate de que el JID del Sub-Bot esté en el formato correcto
                await conn.sendMessage(`${path.basename(pathYukiJadiBot)}@s.whatsapp.net`, { text: msgText }).catch(e => {
                    console.error(chalk.bold.yellow(`Error al notificar a +${path.basename(pathYukiJadiBot)}: ${e.message}`));
                    // Si falla el envío al sub-bot, no hacemos nada más aquí para no interrumpir el intento de reconexión
                });

             } catch (error) {
               console.error(chalk.bold.yellow(`Error general al intentar notificar a +${path.basename(pathYukiJadiBot)}: ${error.message}`));
             }
        }

        // Llamar a creloadHandler(true) para intentar restablecer la conexión
        await creloadHandler(true).catch(console.error);

    } else {
        // Motivos de desconexión que NO están en la lista para reconexión automática.
        // Estos podrían ser errores más graves que no se recuperan solos.
        // Aquí podrías decidir si quieres borrar la sesión para forzar un reenlace manual.
        // Por defecto, no hacemos nada más que el log inicial. El setInterval podría limpiar.
         console.log(chalk.bold.magentaBright(`\n┆ Desconexión por motivo NO manejado para reconexión automática (${reason}). Si esto persiste, puede requerir revisión o reenlace manual.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`));
         // Opcional: Borrar sesión para forzar reenlace en caso de error irrecuperable definitivo
         // Ejemplo: if (reason === algunMotivoFatal) { fs.rmdirSync(pathYukiJadiBot, { recursive: true }); console.log('Sesión borrada por error fatal.'); }
    }
    // --- FIN MODIFICACIÓN ---
}

if (global.db.data == null) loadDatabase()
if (connection == `open`) {
if (!global.db.data?.users) loadDatabase()
let userName, userJid
userName = sock.authState.creds.me.name || 'Anónimo'
userJid = sock.authState.creds.me.jid || `${path.basename(pathYukiJadiBot)}@s.whatsapp.net`
console.log(chalk.bold.cyanBright(`\n❒⸺⸺⸺⸺【• SUB-BOT •】⸺⸺⸺⸺❒\n│\n│ 🟢 ${userName} (+${path.basename(pathYukiJadiBot)}) conectado exitosamente.\n│\n❒⸺⸺⸺【• CONECTADO •】⸺⸺⸺❒`))
sock.isInit = true
global.conns.push(sock)

// Mensaje de confirmación al usuario que inició el comando
if (options.fromCommand && m?.chat) {
  conn.sendMessage(m.chat, {text: args[0] ? `@${m.sender.split('@')[0]}, ya estás conectado, leyendo mensajes entrantes...` : `@${m.sender.split('@')[0]}, genial ya eres parte de nuestra familia de Sub-Bots.\nhttps://chat.whatsapp.com/KqkJwla1aq1LgaPiuFFtEY`, mentions: [m.sender]}, { quoted: m })
}

}}
setInterval(async () => {
// Esta parte ayuda a limpiar sockets que no tienen usuario asociado,
// lo cual puede pasar si la conexión falla gravemente antes de autenticarse.
// Es un mecanismo de limpieza, generalmente seguro de mantener.
if (!sock.user) {
try { sock.ws.close() } catch (e) {
  //console.log(e) // Puedes descomentar para debug
}
sock.ev.removeAllListeners()
let i = global.conns.indexOf(sock)
if (i < 0) return // Ya fue removido
delete global.conns[i]
global.conns.splice(i, 1)
console.log(chalk.yellow(`[Interval Cleanup] Sesión sin usuario removida.`))
}}, 60000) // Revisa cada 60 segundos

let handler = await import('../handler.js')
let creloadHandler = async function (restatConn) {
try {
const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error)
if (Object.keys(Handler || {}).length) handler = Handler

} catch (e) {
console.error('⚠️ Nuevo error al recargar handler: ', e)
}
if (restatConn) {
const oldChats = sock.chats
try { sock.ws.close() } catch { } // Cierra la conexión actual
sock.ev.removeAllListeners() // Elimina los listeners de eventos antiguos
// Crea una nueva instancia de la conexión con las mismas opciones y credenciales
sock = makeWASocket(connectionOptions, { chats: oldChats })
isInit = true // Marca para re-inicializar listeners
}
// Vuelve a adjuntar los listeners de eventos (nuevos o antiguos si la recarga falló)
if (!isInit) {
sock.ev.off("messages.upsert", sock.handler)
sock.ev.off("connection.update", sock.connectionUpdate)
sock.ev.off('creds.update', sock.credsUpdate)
}
sock.handler = handler.handler.bind(sock)
sock.connectionUpdate = connectionUpdate.bind(sock) // Adjunta la función connectionUpdate modificada
sock.credsUpdate = saveCreds.bind(sock, true) // Adjunta la función para guardar credenciales
sock.ev.on("messages.upsert", sock.handler)
sock.ev.on("connection.update", sock.connectionUpdate)
sock.ev.on("creds.update", sock.credsUpdate)
isInit = false
console.log(chalk.green(`[Handler Reload] Handler y listeners actualizados ${restatConn ? 'y conexión reiniciada' : ''}.`))
return true
}
creloadHandler(false) // Carga inicial de handler y listeners
})
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));}
function msToTime(duration) {
var milliseconds = parseInt((duration % 1000) / 100),
seconds = Math.floor((duration / 1000) % 60),
minutes = Math.floor((duration / (1000 * 60)) % 60),
hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
hours = (hours < 10) ? '0' + hours : hours
minutes = (minutes < 10) ? '0' + minutes : minutes
seconds = (seconds < 10) ? '0' + seconds : seconds
return minutes + ' m y ' + seconds + ' s '
}
