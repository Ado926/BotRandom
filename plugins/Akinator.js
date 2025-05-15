import fetch from 'node-fetch'

let handler = async (m, { conn, text, command }) => {
  if (!text) return m.reply('⚠️ Ingresa un término de búsqueda.\n\n*Ejemplo:* .pinterest anime aesthetic')

  const res = await fetch(`https://api.dorratz.com/v2/pinterest?q=${encodeURIComponent(text)}`)
  const json = await res.json()
  const resultados = json.result

  if (!resultados || resultados.length === 0) return m.reply('❌ No se encontraron imágenes.')

  let index = Math.floor(Math.random() * resultados.length)
  let img = resultados[index]

  const buttons = [
    { buttonId: `.${command} ${text}`, buttonText: { displayText: '🔁 Siguiente' }, type: 1 }
  ]

  const buttonMessage = {
    image: { url: img },
    caption: `🔎 *Resultado de Pinterest para:* ${text}`,
    footer: 'Bot by Wirk',
    buttons: buttons,
    headerType: 4
  }

  conn.sendMessage(m.chat, buttonMessage, { quoted: m })
}

handler.command = ['pinterest', 'pin']
handler.help = ['pinterest <texto>']
handler.tags = ['buscadores']

export default handler
