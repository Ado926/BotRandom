import axios from 'axios';

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      return await conn.sendMessage(m.chat, { text: `✎ Escribe qué quieres buscar\nEjemplo: ${usedPrefix + command} gato` }, { quoted: m });
    }

    // Consultar API
    const res = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(text)}`);
    const data = res.data.data;

    if (!data || data.length === 0) {
      return await conn.sendMessage(m.chat, { text: `❌ No encontré imágenes para "${text}"` }, { quoted: m });
    }

    // Elegir una imagen random
    const randomImg = data[Math.floor(Math.random() * data.length)];

    const buttons = [
      {
        buttonId: `${usedPrefix}${command} ${text}`, // botón para buscar otra con el mismo texto
        buttonText: { displayText: '🔄 Siguiente' },
        type: 1
      }
    ];

    // Enviar imagen con botón
    await conn.sendMessage(
      m.chat,
      {
        image: { url: randomImg.images_url },
        caption: `✨ Resultado para *${text}*`,
        footer: '🔘 Pinterest',
        buttons,
        headerType: 4,
      },
      { quoted: m }
    );

    // Reacción para confirmar
    await m.react('✅');

  } catch (e) {
    console.error(e);
    await m.react('❌');
    await conn.sendMessage(m.chat, { text: '❌ Error al buscar imágenes. Intenta más tarde.' }, { quoted: m });
  }
};

handler.help = ['pinterest <texto>'];
handler.tags = ['buscador'];
handler.command = /^pinterest$/i;

export default handler;
