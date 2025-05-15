import fetch from 'node-fetch'

let handler = async (m, { conn, text, command }) => {
  if (!text) throw '✳️ Ingresa lo que deseas buscar en Pinterest'

  const res = await fetch(`https://pinterest-api.vercel.app/?q=${encodeURIComponent(text)}`)
  const json = await res.json()

  if (!json || !json.length) throw '❌ No se encontraron imágenes'

  let img = json[Math.floor(Math.random() * json.length)]

  let buttonMessage = {
    image: { url: img },
    caption: `🔎 Resultado para *${text}*`,
    footer: 'Michi Ai - Pinterest Bot',
    buttons: [
      {
        buttonId: `.pinterest ${text}`,
        buttonText: { displayText: '📸 Siguiente' },
        type: 1
      }
    ],
    headerType: 4
  }

  conn.sendMessage(m.chat, buttonMessage, { quoted: m })
}

handler.help = ['pinterest <búsqueda>']
handler.tags = ['descargas', 'buscador']
handler.command = /^pinterest$/i

export default handler
