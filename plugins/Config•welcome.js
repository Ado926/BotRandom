import fetch from 'node-fetch';

export async function before(m, { conn, participants, groupMetadata }) {
  if (!m.messageStubType || !m.isGroup) return true;

  let vn = 'https://qu.ax/bNwFE.mp4';
  let vn2 = 'https://files.catbox.moe/64008h.mp4';
  let chat = global.db.data.chats[m.chat];
  const getMentionedJid = () => {
    return m.messageStubParameters.map(param => `${param}@s.whatsapp.net`);
  };

  let who = m.messageStubParameters[0] + '@s.whatsapp.net';
  let user = global.db.data.users[who];
  let userName = user ? user.name : await conn.getName(who);

  const thumbnail = await (await fetch('https://files.catbox.moe/uak1qu.jpg')).buffer();
  const redes = 'https://chat.whatsapp.com/tu-grupo'; // Ajustá si querés un link real

  if (chat.welcome && m.messageStubType === 27) {
    this.sendMessage(m.chat, {
      audio: { url: vn },
      contextInfo: {
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363402846939411@newsletter",
          serverMessageId: '',
          newsletterName: '🪴 Michi Channel ☁️'
        },
        forwardingScore: 9999999,
        isForwarded: true,
        mentionedJid: getMentionedJid(),
        externalAdReply: {
          title: `Bienvenid@ ${userName} :D`,
          body: `¡Nos alegra tenerte aquí en *${groupMetadata.subject}*!`,
          previewType: "PHOTO",
          thumbnail,
          sourceUrl: redes,
          showAdAttribution: true
        }
      },
      seconds: '572',
      ptt: true,
      mimetype: 'audio/mpeg',
      fileName: `bienvenida.mp3`
    }, { quoted: fkontak, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 });
  }

  if (chat.welcome && (m.messageStubType === 28 || m.messageStubType === 32)) {
    this.sendMessage(m.chat, {
      audio: { url: vn2 },
      contextInfo: {
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363402846939411@newsletter",
          serverMessageId: '',
          newsletterName: '🍁 Michi Ai 💚'
        },
        forwardingScore: 9999999,
        isForwarded: true,
        mentionedJid: getMentionedJid(),
        externalAdReply: {
          title: `👁️ Adiós ${userName}  :(`,
          body: `Esperamos verte de nuevo por *${groupMetadata.subject}*`,
          previewType: "PHOTO",
          thumbnail,
          sourceUrl: redes,
          showAdAttribution: true
        }
      },
      seconds: '572',
      ptt: true,
      mimetype: 'audio/mpeg',
      fileName: `despedida.mp3`
    }, { quoted: fkontak, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 });
  }
        }
