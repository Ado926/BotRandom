import fs from 'fs'
import path from 'path'
import readline from 'readline'
import pino from 'pino'
import NodeCache from 'node-cache'
import { Boom } from '@hapi/boom'
import ws from 'ws'
const { CONNECTING } = ws
import moment from 'moment-timezone'
import qrcode from 'qrcode'
import crypto from 'crypto'
import { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, MessageRetryMap, makeCacheableSignalKeyStore, jidNormalizedUser } from '@whiskeysockets/baileys'
import { makeWASocket } from '../lib/simple.js'

if (!(global.conns instanceof Array)) global.conns = []

let handler = async (m, { conn: _conn, args, usedPrefix, command, isOwner }) => {
  const bot = global.db.data?.settings?.[_conn.user.jid] || {}

  if (!bot.jadibotmd) return m.reply('💛 Este Comando Se Encuentra Desactivado Por Mi Creador')

  // Decide el "padre" del bot, si usas 'plz' conectas con el _conn actual, sino con global.conn
  let parent = args[0] === 'plz' ? _conn : global.conn

  async function serbot() {
    let userId = m.sender.split('@')[0]
    const userFolderPath = `./OthoJadiBot/${userId}`

    if (!fs.existsSync(userFolderPath)) {
      fs.mkdirSync(userFolderPath, { recursive: true })
    }

    // Si envían base64 en args[0], guarda el creds.json decodificado
    if (args[0] && args[0] !== 'plz') {
      try {
        const decoded = Buffer.from(args[0], "base64").toString("utf-8")
        const jsonCreds = JSON.parse(decoded)
        fs.writeFileSync(`${userFolderPath}/creds.json`, JSON.stringify(jsonCreds, null, 2))
      } catch {
        return m.reply('❌ El código base64 enviado es inválido o está mal formateado.')
      }
    }

    // Carga estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(userFolderPath)
    const msgRetryCounterCache = new NodeCache()
    const { version } = await fetchLatestBaileysVersion()

    const phoneNumber = m.sender.split('@')[0]
    const methodCode = !!phoneNumber || process.argv.includes("code")
    const methodMobile = process.argv.includes("mobile")

    const connectionOptions = {
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      mobile: methodMobile,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
      },
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
        let jid = jidNormalizedUser(key.remoteJid)
        let msg = await store.loadMessage(jid, key.id)
        return msg?.message || ""
      },
      msgRetryCounterCache,
      msgRetryCounterMap: MessageRetryMap,
      defaultQueryTimeoutMs: undefined,
      version
    }

    let conn = makeWASocket(connectionOptions)

    // Si el bot no está registrado, muestra código QR o código de vinculación
    if (methodCode && !conn.authState.creds.registered) {
      let cleanedNumber = phoneNumber.replace(/[^0-9]/g, '')
      setTimeout(async () => {
        try {
          let codeBot = await conn.requestPairingCode(cleanedNumber)
          codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot
          let txt = `┌  🜲  *Usa este Código para convertirte en un Sub Bot*\n`
          txt += `│  ❀  Pasos:\n`
          txt += `│  ❀  1: Haga click en los 3 puntos\n`
          txt += `│  ❀  2: Toque dispositivos vinculados\n`
          txt += `│  ❀  3: Selecciona *Vincular con el número de teléfono*\n`
          txt += `└  ❀  4: Escriba el Código\n\n`
          txt += `*❖ Nota:* Este Código solo funciona en el número que lo solicitó.`
          await parent.reply(m.chat, txt, m)
          await parent.reply(m.chat, codeBot, m)
        } catch (e) {
          await parent.reply(m.chat, '❌ Error al solicitar el código de vinculación.', m)
        }
      }, 3000)
    }

    conn.isInit = false
    let isInit = true

    async function connectionUpdate(update) {
      const { connection, lastDisconnect, isNewLogin } = update
      if (isNewLogin) conn.isInit = true

      const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode

      if (code && code !== DisconnectReason.loggedOut && conn?.ws?.socket == null) {
        let i = global.conns.indexOf(conn)
        if (i < 0) return
        global.conns.splice(i, 1)
        try {
          fs.rmSync(userFolderPath, { recursive: true, force: true })
        } catch {}
        if (code !== DisconnectReason.connectionClosed) {
          parent.sendMessage(m.chat, { text: "Conexión perdida.." }, { quoted: m })
        }
      }

      if (global.db.data == null) {
        await loadDatabase()
      }

      if (connection === 'open') {
        conn.isInit = true
        global.conns.push(conn)
        await parent.reply(m.chat, args[0] ? 'Conectado con éxito' : `❀ ᥴ᥆ᥒᥱᥴ𝗍ᥲძ᥆ ᥱ᥊і𝗍᥆sᥲmᥱᥒ𝗍ᥱ ᥲ ᥕһᥲ𝗍sᥲ⍴⍴\n\n> ${dev}`, m)
        await sleep(5000)
        if (args[0]) return
        await parent.reply(conn.user.jid, `La siguiente vez que se conecte envía el siguiente mensaje para iniciar sesión sin utilizar otro código`, m)

        // Envía el base64 para reconectar fácilmente
        const base64creds = Buffer.from(fs.readFileSync(`${userFolderPath}/creds.json`), "utf-8").toString("base64")
        await parent.sendMessage(conn.user.jid, { text: `${usedPrefix}${command} ${base64creds}` }, { quoted: m })
      }
    }

    setInterval(() => {
      if (!conn.user) {
        try { conn.ws.close() } catch {}
        conn.ev.removeAllListeners()
        let i = global.conns.indexOf(conn)
        if (i < 0) return
        global.conns.splice(i, 1)
      }
    }, 60000)

    let handlerModule = await import('../handler.js')
    let creloadHandler = async function (restartConn) {
      try {
        const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error)
        if (Object.keys(Handler || {}).length) handlerModule = Handler
      } catch (e) {
        console.error(e)
      }
      if (restartConn) {
        try { conn.ws.close() } catch {}
        conn.ev.removeAllListeners()
        conn = makeWASocket(connectionOptions)
        isInit = true
      }

      if (!isInit) {
        conn.ev.off('messages.upsert', conn.handler)
        conn.ev.off('connection.update', conn.connectionUpdate)
        conn.ev.off('creds.update', conn.credsUpdate)
      }

      conn.handler = handlerModule.handler.bind(conn)
      conn.connectionUpdate = connectionUpdate.bind(conn)
      conn.credsUpdate = saveCreds.bind(conn, true)

      conn.ev.on('messages.upsert', conn.handler)
      conn.ev.on('connection.update', conn.connectionUpdate)
      conn.ev.on('creds.update', conn.credsUpdate)
      isInit = false
      return true
    }

    creloadHandler(false)
  }

  serbot()
}

handler.help = ['code']
handler.tags = ['serbot']
handler.command = ['code', 'Code']
handler.rowner = false

export default handler

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
