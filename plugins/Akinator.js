import fetch from 'node-fetch';
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

let handler = async (m, { conn, text }) => {
  if (!text) throw 'Por favor, proporciona una palabra clave para buscar imágenes.';

  // Realiza la solicitud a la API de DorratZ
  let res = await fetch(`https://api.dorratz.com/v2/pinterest?q=${encodeURIComponent(text)}`);
  let json = await res.json();

  if (!json || !json.result || json.result.length === 0) {
    throw 'No se encontraron imágenes para la búsqueda proporcionada.';
  }

  // Selecciona una imagen aleatoria de los resultados
  let img = json.result[Math.floor(Math.random() * json.result.length)];

  // Envía la imagen con un botón "Siguiente"
  let message = {
    image: { url: img },
    caption: `Resultado de búsqueda para: *${text}*`,
    footer: 'Presiona el botón para ver otra imagen.',
    buttons: [
      {
        buttonId: `.pinterest ${text}`,
        buttonText: { displayText: 'Siguiente' },
        type: 1
      }
    ],
    headerType: 4
  };

  await conn.sendMessage(m.chat, message, { quoted: m });
};

handler.command = /^pinterest$/i;
export default handler;
