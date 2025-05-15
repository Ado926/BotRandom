import axios from 'axios';

let pinterestCache = {}; // Para guardar resultados por chat y búsqueda, evitar repetir

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      return await conn.sendMessage(m.chat, { text: `✎ Por favor escribe qué quieres buscar\nEjemplo:\n${usedPrefix + command} gatito` }, { quoted: m });
    }

    // Si ya hay cache para este chat + texto, usamos el índice siguiente
    if (!pinterestCache[m.chat]) pinterestCache[m.chat] = {};
    if (!pinterestCache[m.chat][text]) {
      // Consultamos API y guardamos resultado
      const res = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(text)}`);
      const data = res.data.data;
      if (!data || data.length === 0) throw new Error('No hay imágenes');

      pinterestCache[m.chat][text] = {
        images: data,
        index: 0,
      };
    }

    let cache = pinterestCache[m.chat][text];
    let img = cache.images[cache.index];

    // Actualizamos índice para la próxima vez (circular)
    cache.index = (cache.index + 1) % cache.images.length;

    const buttons = [
      {
        buttonId: `${usedPrefix}${command} ${text}`,
        buttonText: { displayText: '🔄 Siguiente' },
        type: 1
      }
    ];

    await conn.sendMessage(
      m.chat,
      {
        image: { url: img.images_url },
        caption: `✨ Resultado para *${text}*`,
        footer: '🔘 Pinterest',
        buttons,
        headerType: 4,
      },
      { quoted: m }
    );

    await m.react('✅');
  } catch (e) {
    console.error(e);
    await m.react('❌');
    await conn.sendMessage(m.chat, { text: '❌ No encontré imágenes o hubo un error, intenta con otra palabra.' }, { quoted: m });
  }
};

handler.help = ['pinterest <texto>'];
handler.tags = ['buscador'];
handler.command = /^pinterest$/i;

export default handler;
