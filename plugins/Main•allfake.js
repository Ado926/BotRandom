import pkg from '@whiskeysockets/baileys'
import fs from 'fs'
import fetch from 'node-fetch'
import axios from 'axios'
import moment from 'moment-timezone'
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = pkg

var handler = m => m
handler.all = async function (m) {

global.getBuffer = async function getBuffer(url, options) {
  try {
    options ? options : {}
    var res = await axios({
      method: "get",
      url,
      headers: {
        'DNT': 1,
        'User-Agent': 'GoogleBot',
        'Upgrade-Insecure-Request': 1
      },
      ...options,
      responseType: 'arraybuffer'
    })
    return res.data
  } catch (e) {
    console.log(`Error : ${e}`)
  }
}

let who = m.messageStubParameters?.[0] + '@s.whatsapp.net'
let user = global.db.data.users?.[who]
let pushname = m.pushName || 'Sin nombre'

// Creador y otros
global.creador = 'Wa.me/50493732693'
global.ofcbot = `${conn.user.jid.split('@')[0]}`
global.asistencia = 'https://wa.me/message/BTJGZ2PHZGQZO1'
global.namechannel = '☁️ Michi Ai 🪴'
global.canal = 'https://whatsapp.com/channel/0029Vb5UfTC4CrfeKSamhp1f'

// Reacciones
global.rwait = '🕒'
global.done = '✅'
global.error = '✖️'

// Emojis de Michi Ai
global.emoji = '🌸'
global.emoji2 = '🍬'
global.emoji3 = '🍟'
global.emoji4 = '☁️'
global.emojis = [emoji, emoji2, emoji3, emoji4].getRandom()

// Mensaje en espera
global.wait = '🚀 Cargando...'
global.waitt = '🚀 Cargando...'
global.waittt = '🚀 Cargando...'
global.waitttt = '🚀 Cargando...'

// Enlaces
var git = 'https://github.com/Ado926'  
var github = 'https://github.com/Ado926/MaiBot'  
var panel = 'https://panel.skyultraplus.com'
var dash = 'https://dash.skyultraplus.com'
var tienda = 'https://dash.skyultraplus.com/store'
var status = 'https://estado.skyultraplus.com'
var discord = 'https://discord.com/invite/T7ksHu7mkz'
var paypal = 'https://paypal.me/corinplus2024'
let correo = 'danieldevelop3@gmail.com'

global.redes = [canal, git, github, panel, dash, tienda, status, discord, paypal, correo].getRandom()
global.redeshost = [panel, dash, tienda, status, discord, paypal].getRandom()

// Imagen
let category = "imagen"
const db = './src/database/db.json'
const db_ = JSON.parse(fs.readFileSync(db))
const random = Math.floor(Math.random() * db_.links[category].length)
const randomlink = db_.links[category][random]
const response = await fetch(randomlink)
const rimg = await response.buffer()
global.icons = rimg

// Tiempo RPG
var ase = new Date(); var hour = ase.getHours(); switch(hour){
  case 0: case 1: case 2: hour = 'Lɪɴᴅᴀ Nᴏᴄʜᴇ 🌃'; break;
  case 3: case 4: case 5: case 6: hour = 'Lɪɴᴅᴀ Mᴀɴ̃ᴀɴᴀ 🌄'; break;
  case 7: hour = 'Lɪɴᴅᴀ Mᴀɴ̃ᴀɴᴀ 🌅'; break;
  case 8: case 9: hour = 'Lɪɴᴅᴀ Mᴀɴ̃ᴀɴᴀ 🌄'; break;
  case 10: case 11: case 12: case 13: hour = 'Lɪɴᴅᴏ Dɪᴀ 🌤'; break;
  case 14: case 15: case 16: case 17: hour = 'Lɪɴᴅᴀ Tᴀʀᴅᴇ 🌆'; break;
  default: hour = 'Lɪɴᴅᴀ Nᴏᴄʜᴇ 🌃';
}
global.saludo = hour

// Tags
global.nombre = conn.getName(m.sender)
global.taguser = '@' + m.sender.split("@s.whatsapp.net")
var more = String.fromCharCode(8206)
global.readMore = more.repeat(850)

// Fakes
global.fkontak = {
  key: {
    participant: `0@s.whatsapp.net`,
    ...(m.chat ? { remoteJid: `6285600793871-1614953337@g.us` } : {})
  },
  message: {
    'contactMessage': {
      'displayName': `${pushname}`,
      'vcard': `BEGIN:VCARD\nVERSION:3.0\nN:XL;${pushname},;;;\nFN:${pushname},\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
      'jpegThumbnail': null,
      thumbnail: null,
      sendEphemeral: true
    }
  }
}

// Iconos
global.icono = [ 
  'https://qu.ax/HKtQj.jpg',
  'https://qu.ax/njcmN.jpg'
].getRandom()

// Canal oficial Michi Ai (mensaje al tocar)
global.rcanal = {
  contextInfo: {
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363402846939411@newsletter",
      serverMessageId: 100,
      newsletterName: global.namechannel,
    },
    externalAdReply: {
      showAdAttribution: true,
      title: global.namechannel,
      body: '☁️ Sigue Nuestro Canal 👻',
      mediaUrl: null,
      description: null,
      previewType: "PHOTO",
      thumbnailUrl: global.icono,
      sourceUrl: global.canal,
      mediaType: 1,
      renderLargerThumbnail: false
    }
  }
}

}

export default handler
