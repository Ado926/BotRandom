import { search, download } from 'aptoide-scraper';

const handler = async (m, { conn, usedPrefix: prefix, command, text }) => {
  if (!text) return conn.reply(m.chat, '*📪 Ingresa el nombre de una Apk que deseas descargar.*', m);

  try {    
    const searchA = await search(text);  // Realiza la búsqueda
    const data5 = await download(searchA[0].id);

    // Preparar el mensaje con la información del APK
    let response = `\`\`\`◜Aptoide - Download◞\`\`\``;
    response += `\n\n*${data5.name}*\n\n`;
    response += `≡ *🌻 \`Package:\`* ${data5.package}\n`;
    response += `≡ *🪴 \`Update:\`* ${data5.lastup}\n`;
    response += `≡ *⚖ \`Peso:\`* ${data5.size}\n\n`;
    response += `> ☁️ Enviando archivo, aguarde un momento.`;

    // Enviar la respuesta con la imagen y la descripción
    await conn.sendMessage(m.chat, { 
      image: { url: data5.icon }, 
      caption: response 
    }, { quoted: m });

    // Verificar si el archivo es muy grande
    if (data5.size.includes('GB') || parseInt(data5.size.replace(' MB', '')) > 999) {
      return await conn.sendMessage(m.chat, { text: '*⚠️ El archivo es demasiado pesado.*' }, { quoted: m });
    }

    // Enviar el archivo APK
    await conn.sendMessage(m.chat, { 
      document: { url: data5.dllink }, 
      mimetype: 'application/vnd.android.package-archive', 
      fileName: data5.name + '.apk' 
    }, { quoted: m });

  } catch (err) {
    console.error(err);
    return conn.reply(m.chat, '*❌ Ocurrió un fallo.*', m);
  }
};

handler.command = /^(apk|modapk|aptoide|aptoidedl)$/i;

export default handler;
