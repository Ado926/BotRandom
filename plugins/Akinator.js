import fetch from 'node-fetch'

let handler = async (m, { conn, text, command }) => {
  if (!text) throw '✳️ Ingresa el nombre o término para buscar en Pinterest'

  try {
    let res = await fetch(`https://api.dorratz.com/v2/pinterest?q=${encodeURIComponent(text)}`)
    let json = await res.json()
    if (!json.status || !json.result || json.result.length == 0) throw '❌ No se encontraron imágenes'

    let img = json.result[Math.floor(Math.random() * json.result.length)]

    let buttonMessage = {
      image: { url: img },
      caption: `🔎 Resultado de *${text}*`,
      footer: '© Pinterest Bot',
      buttons: [
        {
          buttonId: `.pinterest ${text}`,
          buttonText: { displayText: '📸 Siguiente' },
          type: 1
        }
      ],
      headerType: 4
    }

    await conn.sendMessage(m.chat, buttonMessage, { quoted: m })

  } catch (e) {
    console.error(e)
    throw '❌ Ocurrió un error al buscar la imagen'
  }
}

handler.help = ['pinterest <texto>']
handler.tags = ['buscadores']
handler.command = /^pinterest$/i

export default handler
