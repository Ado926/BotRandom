import axios from 'axios';

const handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      await conn.sendMessage(m.chat, { text: `✎ Por favor escribe qué quieres buscar.\nEjemplo:\n${usedPrefix + command} gato` }, { quoted: m });
      return;
    }

    const response = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(text)}`);
    const data = response.data.data;

    if (!data || data.length === 0) {
      await conn.sendMessage(m.chat, { text: `❌ No se encontraron imágenes para "${text}".` }, { quoted: m });
      return;
    }

    // Elegir imagen aleatoria
    const randomImage = data[Math.floor(Math.random() * data.length)];
    const imageUrl = randomImage.images_url;
    const caption = `✨ Resultado para *${text}*`;

    // Botón para siguiente imagen
    const buttons = [
      {
        buttonId: `${usedPrefix}${command} ${text}`, // al pulsar vuelve a llamar el comando con el mismo texto
        buttonText: { displayText: '🔄 Siguiente' },
        type: 1
      }
    ];

    // Enviar imagen con botón
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

    // Reaccionar con check para confirmar
    await m.react('✅');

  } catch (error) {
    console.error(error);
    await m.react('❌');
    await conn.sendMessage(m.chat, { text: '❌ Ocurrió un error. Intenta otra vez.' }, { quoted: m });
  }
};

handler.help = ['pinterest <texto>'];
handler.tags = ['buscador'];
handler.command = /^pinterest$/i;

export default handler;
