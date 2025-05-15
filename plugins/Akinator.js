import fetch from 'node-fetch'
import { proto } from '@whiskeysockets/baileys'

let handler = async (m, { conn, text, command }) => {
  if (!text) return m.reply('✳️ Ingresa una palabra clave para buscar en Pinterest.')

  let res = await fetch(`https://api.dorratz.com/v2/pinterest?q=${encodeURIComponent(text)}`)
  let data = await res.json()

  if (!data || !data.status || !data.result || !data.result.length) {
    return m.reply('❌ No se encontraron resultados.')
  }

  // Elegir una imagen aleatoria de los resultados
  let img = data.result[Math.floor(Math.random() * data.result.length)]

  let buttons = [
    {
      buttonId: `.${command} ${text}`,
      buttonText: { displayText: '🔁 Siguiente' },
      type: 1
    }
  ]

  let buttonMessage = {
    image: { url: img },
    caption: `🔎 *Resultado de:* ${text}`,
    footer: '📌 Pinterest | Michi Ai',
    buttons: buttons,
    headerType: 4
  }

  await conn.sendMessage(m.chat, buttonMessage, { quoted: m })
}

handler.help = ['pinterest <texto>']
handler.tags = ['buscador']
handler.command = /^pinterest$/i

export default handler
