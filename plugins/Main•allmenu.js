import fs from 'fs'
import fetch from 'node-fetch'
import { xpRange } from '../lib/levelling.js'
// const { levelling } from '../lib/levelling.js' // Esta línea parece duplicada o incorrecta, la comento.
import PhoneNumber from 'awesome-phonenumber'
import { promises } from 'fs'
import { join } from 'path'

let handler = async (m, { conn, usedPrefix, usedPrefix: _p, __dirname, text, command }) => {
try {
let vn = './media/menu.mp3' // Asegúrate de tener este archivo si lo usas.
let _package = JSON.parse(await promises.readFile(join(__dirname, '../package.json')).catch( => ({}))) || {}
let { exp, limit, level, role } = global.db.data.users[m.sender]
let { min, xp, max } = xpRange(level, global.multiplier)
let name = await conn.getName(m.sender)
let d = new Date(new Date + 3600000)
let locale = 'es' // Puedes cambiar 'es' a tu locale deseado si es diferente.
let weton = ['Pahing', 'Pon', 'Wage', 'Kliwon', 'Legi'][Math.floor(d / 84600000) % 5]
let week = d.toLocaleDateString(locale, { weekday: 'long' })
let date = d.toLocaleDateString(locale, {
day: 'numeric',
month: 'long',
year: 'numeric'
})
let dateIslamic = Intl.DateTimeFormat(locale + '-TN-u-ca-islamic', {
day: 'numeric',
month: 'long',
year: 'numeric'
}).format(d)
let time = d.toLocaleTimeString(locale, {
hour: 'numeric',
minute: 'numeric',
second: 'numeric'
})
let _uptime = process.uptime() * 1000
let _muptime
if (process.send) {
process.send('uptime')
_muptime = await new Promise(resolve => {
process.once('message', resolve)
setTimeout(resolve, 1000) // Esperar un poco por la respuesta del proceso
}) * 1000 // Multiplicar por 1000 para obtener milisegundos si la respuesta es en segundos
}
// Asegurarse de que _muptime tenga un valor si process.send no está disponible o falla
const muptime = clockString(_muptime || 0);
const uptime = clockString(_uptime);

let { money, joincount } = global.db.data.users[m.sender]
let user = global.db.data.users[m.sender]
// let muptime = clockString(_muptime) // Definido arriba
// let uptime = clockString(_uptime) // Definido arriba
let totalreg = Object.keys(global.db.data.users).length
let rtotalreg = Object.values(global.db.data.users).filter(user => user.registered == true).length
let replace = {
'%': '%',
p: _p, uptime, muptime,
me: conn.getName(conn.user.jid),
npmname: _package.name,
npmdesc: _package.description,
version: _package.version,
exp: exp - min, // XP actual en el nivel
maxexp: xp, // XP necesario para el siguiente nivel
totalexp: exp, // XP total acumulado
xp4levelup: max - exp, // XP restante para subir de nivel
github: _package.homepage ? _package.homepage.url || package.homepage : '[unknown github url]',
level, limit, name, weton, week, date, dateIslamic, time, totalreg, rtotalreg, role,
readmore: readMore
}
text = text.replace(new RegExp(`%(${Object.keys(replace).sort((a, b) => b.length - a.length).join|})`, 'g'), (,, name) => '' + replace[name])
//let user = global.db.data.users[m.sender]
//user.registered = false // Línea comentada, parece para testing
let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
let mentionedJid = [who]
let username = conn.getName(who)
let taguser = '@' + m.sender.split("@s.whatsapp.net")[0]
//let enlace = { contextInfo: { externalAdReply: {title: wm, body: 'support group' , sourceUrl: nna, thumbnail: await(await fetch(img)).buffer() }}} // Comentado

// Ruta de la imagen local (asegúrate de que la ruta sea correcta)
let pp = './Menu2.jpg'

// Intenta obtener la imagen de forma local primero, si no, usa la URL
let imgBuffer;
try {
imgBuffer = fs.readFileSync(pp);
} catch (e) {
// Si falla la lectura local, intenta descargar de la URL
try {
const imgFetch = await fetch('https://qu.ax/fYRPW.jpg');
imgBuffer = await imgFetch.buffer();
} catch (fetchError) {
console.error('Error fetching image from URL:', fetchError);
// Si ambos fallan, puedes decidir qué hacer, quizás usar una imagen por defecto o null
imgBuffer = null; // O una Buffer de una imagen de error/por defecto
}
}

let fkontak = { "key": { "participants":"0@s.whatsapp.net", "remoteJid": "status@broadcast", "fromMe": false, "id": "Halo" }, "message": { "contactMessage": { "vcard": `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCCARD` }}, "participant": "0@s.whatsapp.net" }

// ---- INICIO DEL MENÚ REDISEÑADO ----
let menu = `
┏━═━═━═━═━═━═━═━═━═┓
┃  *🪴 The Michi - MD ☕*
┣━═━═━═━═━═━═━═━═━═┛
┃
┃ 🐾 ¡Hola, ${name}!
┃
┃ ╭─────────────╮
┃ │ 🗓️ \`Fecha:\` ${date}
┃ │ ⏰ \`Hora:\` ${time}
┃ │ ⏳ \`Activo Desde:\` ${uptime}
┃ │ 👥 \`Usuarios:\` ${totalreg}
┃ │ 🏆 \`Nivel:\` ${level} | 🌟 XP: ${exp}
┃ ╰─────────────╯
┃
┃ 🐱 *Creador:* Wirk
┃ 🌎 *País:* Honduras 💣
┃ 🖥️ *Terminal:* Linux
┃ 📚 *Librería:* Baileys
┣━═━═━═━═━═━═━═━═━═┓
┃   📚 Menu de Comandos
┗━═━═━═━═━═━═━═━═━═━┛

📜 Información Bot
☁️ ${usedPrefix}owner
☁️ ${usedPrefix}totalfunciones
☁️ ️${usedPrefix}velocidad
☁️ ${usedPrefix}sistema
☁️ ️${usedPrefix}uptime

📥 Downloaders
🍄 ${usedPrefix}facebook
🍄 ${usedPrefix}ytmp3
🍄 ${usedPrefix}ytmp4
🍄 ${usedPrefix}tiktok
🍄 ${usedPrefix}tiktokimg
🍄 ${usedPrefix}Spotifydl
🍄 ${usedPrefix}applemusicdl
🍄 ${usedPrefix}clouddl
🍄 ${usedPrefix}pinterestdl
🍄 ${usedPrefix}Instagram
🍄 ${usedPrefix}applemusic
🍄 ${usedPrefix}souncloud
🍄 ${usedPrefix}apk

🔍 Busquedas
🎋 ${usedPrefix}spotifysearch
🎋 ${usedPrefix}mercadolibre
🎋 ${usedPrefix}wikisearch
🎋 ${usedPrefix}google
🎋 ${usedPrefix}tiktokvid
🎋 ${usedPrefix}shazam
🎋 ${usedPrefix}yts
🎋 ${usedPrefix}pinterest
🎋 ${usedPrefix}tiktoksearch
🎋 ${usedPrefix}tiktokvid
🎋 ${usedPrefix}twittersearch
🎋 ${usedPrefix}applemusicsearch
🎋 ${usedPrefix}cloudsearch
🎋 ${usedPrefix}npmjssearct
🎋 ${usedPrefix}imagenes

💡 Inteligencia Artificial
🍘 ${usedPrefix}ia
🍘 ${usedPrefix}gemini
🍘 ${usedPrefix}bing
🍘 ${usedPrefix}ai

🔧 Herramientas
🍧 ${usedPrefix}ssweb
🍧 ${usedPrefix}hd
🍧 ${usedPrefix}reenviar
🍧 ${usedPrefix}ver
🍧 ${usedPrefix}poll
🍧 ${usedPrefix}tourl
🍧 ${usedPrefix}ibb
🍧 ${usedPrefix}toimg
🍧 ${usedPrefix}topvideo
🍧 ${usedPrefix}topgifaud
🍧 ${usedPrefix}topmp3

👨‍👩‍👧‍👦 Grupos
🌼 ${usedPrefix}enable
🌼 ${usedPrefix}disable
🌼 ${usedPrefix}unbanchat
🌼 ${usedPrefix}banchat
🌼 ${usedPrefix}promote
🌼 ${usedPrefix}demote
🌼 ${usedPrefix}delete
🌼 ${usedPrefix}tagall
🌼 ${usedPrefix}tag
🌼 ${usedPrefix}kick
🌼 ${usedPrefix}mute

⚔️ RPG
🌵 ${usedPrefix}claim
🌵 ${usedPrefix}dulces
🌵 ${usedPrefix}crimen
🌵 ${usedPrefix}minar
🌵 ${usedPrefix}work
🌵 ${usedPrefix}verificar
🌵 ${usedPrefix}perfil

💖 Stickers
🍥 ${usedPrefix}sticker
🍥 ${usedPrefix}qc
🍥 ${usedPrefix}wm

🥳 Fun
🏝️ ${usedPrefix}abrazar
🏝️ ${usedPrefix}acertijo
🏝️ ${usedPrefix}advpeli
🏝️ ${usedPrefix}blush
🏝️ ${usedPrefix}gay
🏝️ ${usedPrefix}lesbiana
🏝️ ${usedPrefix}pajero
🏝️ ${usedPrefix}pajera
🏝️ ${usedPrefix}puto
🏝️ ${usedPrefix}puta
🏝️ ${usedPrefix}manco
🏝️ ${usedPrefix}manca
🏝️ ${usedPrefix}rata
🏝️ ${usedPrefix}prostituta
🏝️ ${usedPrefix}prostituto
🏝️ ${usedPrefix}apostar
🏝️ ${usedPrefix}casino
🏝️ ${usedPrefix}consejo
🏝️ ${usedPrefix}bailar
🏝️ ${usedPrefix}formarpareja
🏝️ ${usedPrefix}fuck
🏝️ ${usedPrefix}kiss
🏝️ ${usedPrefix}love2
🏝️ ${usedPrefix}trivia
🏝️ ${usedPrefix}meme
🏝️ ${usedPrefix}pat
🏝️ ${usedPrefix}personalidad
🏝️ ${usedPrefix}piropo
🏝️ ${usedPrefix}pokedex
🏝️ ${usedPrefix}pout
🏝️ ${usedPrefix}pregunta
🏝️ ${usedPrefix}laugh
🏝️ ${usedPrefix}reto
🏝️ ${usedPrefix}rt
🏝️ ${usedPrefix}sad
🏝️ ${usedPrefix}ship
🏝️ ${usedPrefix}top
🏝️ ${usedPrefix}zodiac

══════════════
`.trim();
// ---- FIN DEL MENÚ REDISEÑADO ----

// Verifica si la imagen se cargó correctamente antes de enviarla
if (imgBuffer) {
conn.sendFile(m.chat, imgBuffer, 'lp.jpg', menu, m, false, { contextInfo: { mentionedJid }})
} else {
// Si no hay imagen, envía solo el texto del menú
m.reply(menu);
}

await m.react('✅')
} catch (e) {
await m.reply('❌️ Ocurrió un error.\n\n' + e)
await m.react('❌') // Cambiado a emoji de error más común
}
}
handler.help = ['menu', 'help', '?']
handler.tags = ['main']
handler.command = /^(menu|allmenu?)$/i
//handler.register = true // Comentado
handler.exp = 50
handler.fail = null
export default handler

const more = String.fromCharCode(8206)
const readMore = more.repeat(4001)

function clockString(ms) {
let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')}
