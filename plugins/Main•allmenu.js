import fs from 'fs'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'
import PhoneNumber from 'awesome-phonenumber'
import { promises } from 'fs'
import { join } from 'path'

let handler = async (m, { conn, usedPrefix, usedPrefix: _p, __dirname, text, command }) => {
  try {
    let _package = JSON.parse(await promises.readFile(join(__dirname, '../package.json')).catch(_ => ({}))) || {}
    let { exp, limit, level, role } = global.db.data.users[m.sender]
    let { min, xp, max } = xpRange(level, global.multiplier)
    let name = await conn.getName(m.sender)
    let d = new Date(new Date + 3600000)
    let locale = 'es'
    let weton = ['Pahing', 'Pon', 'Wage', 'Kliwon', 'Legi'][Math.floor(d / 84600000) % 5]
    let week = d.toLocaleDateString(locale, { weekday: 'long' })
    let date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
    let dateIslamic = Intl.DateTimeFormat(locale + '-TN-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
    let time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric', second: 'numeric' })
    let _uptime = process.uptime() * 1000
    let _muptime
    if (process.send) {
      process.send('uptime')
      _muptime = await new Promise(resolve => {
        process.once('message', resolve)
        setTimeout(resolve, 1000)
      }) * 1000
    }
    const muptime = clockString(_muptime || 0)
    const uptime = clockString(_uptime)
    let { money, joincount } = global.db.data.users[m.sender]
    let totalreg = Object.keys(global.db.data.users).length
    let rtotalreg = Object.values(global.db.data.users).filter(user => user.registered == true).length

    let replace = {
      '%': '%',
      p: _p, uptime, muptime,
      me: conn.getName(conn.user.jid),
      npmname: _package.name,
      npmdesc: _package.description,
      version: _package.version,
      exp: exp - min,
      maxexp: xp,
      totalexp: exp,
      xp4levelup: max - exp,
      github: _package.homepage ? _package.homepage.url || _package.homepage : '[unknown github url]',
      level, limit, name, weton, week, date, dateIslamic, time, totalreg, rtotalreg, role,
      readmore: readMore
    }

    text = text.replace(new RegExp(`%(${Object.keys(replace).sort((a, b) => b.length - a.length).join`|`})`, 'g'), (_, name) => '' + replace[name])

    let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
    let mentionedJid = [who]
    let username = conn.getName(who)
    let taguser = '@' + m.sender.split("@s.whatsapp.net")[0]

    let pp = './Menu2.jpg'
    let imgBuffer
    try {
      imgBuffer = fs.readFileSync(pp)
    } catch (e) {
      try {
        const imgFetch = await fetch(`https://qu.ax/fYRPW.jpg`)
        imgBuffer = await imgFetch.buffer()
      } catch (fetchError) {
        imgBuffer = null
      }
    }

    let fkontak = {
      "key": { "participants": "0@s.whatsapp.net", "remoteJid": "status@broadcast", "fromMe": false, "id": "Halo" },
      "message": {
        "contactMessage": {
          "vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
        }
      },
      "participant": "0@s.whatsapp.net"
    }

    let menu = `> ┏━═━═━═━═━═━═━═━═━═┓
> ┃  🪴 *The Michi - MD* ☕
> ┣━═━═━═━═━═━═━═━═━═┛
> ┃
> ┃ 🐾 ¡Hola, ${name}!
> ┃
> ┃ ╭─────────────╮
> ┃ │ 🗓️ \`Fecha:\` ${date}
> ┃ │ ⏰ \`Hora:\` ${time}
> ┃ │ 🕓 \`Activo Hace:\` ${uptime}
> ┃ │ 👥 \`Usuarios:\` ${totalreg}
> ┃ │ 🍁 \`Nivel:\` ${level} | 🌟 XP: ${exp}
> ┃ ╰─────────────╯
> ┃
> ┃ 🐱 *Creador:* Wirk
> ┃ 🌎 *País:* Honduras 💣
> ┃ 🖥️ *Terminal:* Linux
> ┃ 📚 *Librería:* MekBaileys
> ┣━═━═━═━═━═━═━═━═━═┓
> ┃  *📚 Menu de Comandos*
> ┗━═━═━═━═━═━═━══━═━┛

> 🍄 \`URL:\` https://play-youtubedescargas.vercel.app/

📜 *Información Bot*
☁️ .owner
☁️ .totalfunciones
☁️ ️.velocidad
☁️ .sistema
☁️ ️.uptime

☔ *Comandos mas usados*
🪴 .play
🌴 .ytmp3 
🪴 .ytmp4 
🪴 .tt

📥 *Downloaders*
🍄 .play 
🍄 .facebook
🍄 .ytmp3
🍄 .ytmp4
🍄 .tiktok
🍄 .tiktokimg
🍄 .spotifydl
🍄 .applemusicdl
🍄 .clouddl
🍄 .pinterestdl
🍄 .Instagram
🍄 .applemusic
🍄 .souncloud
🍄 .apk

🔍 *Busquedas*
🎋 .spotifysearch
🎋 .mercadolibre
🎋 .wikisearch
🎋 .google
🎋 .tiktokvid
🎋 .shazam
🎋 .yts
🎋 .pinterest
🎋 .tiktoksearch
🎋 .tiktokvid
🎋 .twittersearch
🎋 .applemusicsearch
🎋 .cloudsearch
🎋 .npmjssearct
🎋 .imagenes

💡 *Inteligencia Artificial*
🍘 .ia
🍘 .gemini

🔧 *Herramientas*
🍧 .ssweb
🍧 .hd
🍧 .reenviar
🍧 .ver
🍧 .poll
🍧 .tourl
🍧 .ibb
🍧 .toimg
🍧 .topvideo
🍧 .topgifaud
🍧 .topmp3

👨‍👩‍👧‍👦 *Grupos*
🌼 .enable
🌼 .disable
🌼 .unbanchat
🌼 .banchat
🌼 .promote
🌼 .demote
🌼 .delete
🌼 .tagall
🌼 .tag
🌼 .kick
🌼 .mute

⚔️ *RPG*
🌵 .claim
🌵 .dulces
🌵 .crimen
🌵 .minar
🌵 .work
🌵 .verificar
🌵 .perfil

💖 *Stickers*
🍥 .sticker
🍥 .qc
🍥 .wm

🥳 *Fun*
🏝️ .abrazar
🏝️ .acertijo
🏝️ .advpeli
🏝️ .blush
🏝️ .gay
🏝️ .lesbiana
🏝️ .pajero
🏝️ .pajera
🏝️ .puto
🏝️ .puta
🏝️ .manco
🏝️ .manca
🏝️ .rata
🏝️ .prostituta
🏝️ .prostituto
🏝️ .apostar
🏝️ .casino
🏝️ .consejo
🏝️ .bailar
🏝️ .formarpareja
🏝️ .fuck
🏝️ .kiss
🏝️ .love2
🏝️ .trivia
🏝️ .meme
🏝️ .pat
🏝️ .personalidad
🏝️ .piropo

> ⭐ Powered By Wirk ⭐
`

  await conn.sendMessage(m.chat, { image: imgBuffer, caption: menu, mentions: mentionedJid }, { quoted: fkontak })

  } catch (e) {
    console.error(e)
    m.reply('Ocurrió un error al generar el menú.')
  }
}
handler.command = ['menu', 'help']
export default handler

function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

const readMore = String.fromCharCode(8206).repeat(4001)
