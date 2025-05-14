function handler(m) {
  const data = global.owner.find(([id, isCreator]) => id && isCreator)
  if (!data) return m.reply('No se encontró el número del creador.')
  let numero = data[0]
  this.sendContact(m.chat, [[numero, 'Wirk 👻']], m)
}

handler.help = ['creador']
handler.tags = ['info']
handler.command = ['creador', 'creator', 'owner', 'propietario', 'dueño']

export default handler
