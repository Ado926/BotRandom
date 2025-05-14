function handler(m) {
  const data = global.owner.find(([id, isCreator]) => id && isCreator)
  if (!data) return m.reply('No se encontró el número del creador.')
  let numero = data[0].replace(/[^0-9]/g, '') // Asegura que solo sea número
  m.reply(numero)
}

handler.help = ['creador']
handler.tags = ['info']
handler.command = ['creador', 'creator', 'owner', 'propietario', 'dueño']

export default handler
