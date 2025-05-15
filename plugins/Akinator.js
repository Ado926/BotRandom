import axios from 'axios';

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      await conn.sendMessage(
        m.chat,
        { text: `✎ Por favor proporciona un término de búsqueda.\n\nEjemplo:\n${usedPrefix}${command} akame` },
        { quoted: m }
      );
      return;
    }

    const response = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(text)}`);
    const data = response.data.data;

    if (!data || data.length === 0) {
      await conn.sendMessage(
        m.chat,
        { text: `❌ No se encontraron imágenes para "${text}".` },
        { quoted: m }
      );
      return;
    }

    const randomImage = data[Math.floor(Math.random() * data.length)];
    const imageUrl = randomImage.images_url;
    const title = randomImage.grid_title || `Imagen relacionada a "${text}"`;

    const caption = `✨ *${title}*`;

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
        image: { url: imageUrl },
        caption: caption,
        footer: '🔘 Pinterest',
        buttons: buttons,
        headerType: 4
      },
      { quoted: m }
    );

    await m.react('✅');
  } catch (error) {
    console.error('Error al obtener la imagen:', error);
    await m.react('❌');
    await conn.sendMessage(
      m.chat,
      { text: '❌ Ocurrió un error al intentar obtener la imagen. Intenta nuevamente.' },
      { quoted: m }
    );
  }
};

handler.help = ['pinterest <término>'];
handler.tags = ['buscador'];
handler.command = ['pinterest'];

export default handler;
