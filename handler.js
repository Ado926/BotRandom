import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import fetch from 'node-fetch'

const { proto } = (await import('@whiskeysockets/baileys')).default
const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () {
clearTimeout(this)
resolve()
}, ms))

export async function handler(chatUpdate) {
this.msgqueque = this.msgqueque || []
if (!chatUpdate)
return
    this.pushMessage(chatUpdate.messages).catch(console.error)
let m = chatUpdate.messages[chatUpdate.messages.length - 1]
if (!m)
return;
if (global.db.data == null)
await global.loadDatabase()
try {
m = smsg(this, m) || m
if (!m)
return
m.exp = 0
m.cookies = false // Changed from true to false as per original code init
try {
let user = global.db.data.users[m.sender]
if (typeof user !== 'object')

global.db.data.users[m.sender] = {}
if (user) {
if (!isNumber(user.exp))
user.exp = 0
if (!isNumber(user.cookies)) // Corrected typo from "cookeis"
user.cookies = 10
if (!('muto' in user))
user.muto = false
if (!('premium' in user))
user.premium = false
if (!user.premium)
user.premiumTime = 0
if (!('registered' in user))
user.registered = false
if (!user.registered) {
if (!('name' in user))
user.name = m.name
if (!isNumber(user.age))
user.age = -1
if (!isNumber(user.regTime))
user.regTime = -1
}
if (!isNumber(user.afk))
user.afk = -1
if (!('afkReason' in user))
user.afkReason = ''
if (!('banned' in user))
user.banned = false
if (!('useDocument' in user))
user.useDocument = false
if (!isNumber(user.level))
user.level = 0
if (!isNumber(user.bank)) // Added bank initialization
user.bank = 0
} else
                global.db.data.users[m.sender] = {
exp: 0,
cookies: 10, // Corrected typo
muto: false,
premium: false, // Added premium init
premiumTime: 0, // Added premiumTime init
registered: false,
name: m.name,
age: -1,
regTime: -1,
afk: -1,
afkReason: '',
banned: false,
useDocument: false,
bank: 0,
level: 0,
}
let chat = global.db.data.chats[m.chat]
if (typeof chat !== 'object')
global.db.data.chats[m.chat] = {}
if (chat) {
if (!('isBanned' in chat))
chat.isBanned = false
if (!('welcome' in chat))
chat.welcome = true
if (!('audios' in chat))
chat.audios = false
if (!('detect' in chat))
chat.detect = true
if (!('onlyLatinos' in chat))
chat.onlyLatinos = false // Corrected init based on later usage
if (!('antiBot' in chat))
chat.antiBot = false
if (!('antiBot2' in chat))
chat.antiBot2 = false
if (!('modoadmin' in chat))
chat.modoadmin = false
if (!('antiLink' in chat))
chat.antiLink = false
if (!('modohorny' in chat)) // Corrected typo
chat.modohorny = false
if (!('reaction' in chat))
chat.reaction = false
if (!('simi' in chat))
chat.simi = false
if (!('antiver' in chat))
chat.antiver = false
if (!('delete' in chat))
chat.delete = false
if (!isNumber(chat.expired))
chat.expired = 0
} else
global.db.data.chats[m.chat] = {
isBanned: false,
welcome: true,
delete: false,
onlyLatinos: false, // Corrected init
audios: false,
detect: true,
antiBot: false,
antiBot2: false,
modoadmin: false,
antiLink: false,
simi: false,
antiver: false,
modohorny: false,
reaction: false,
expired: 0,
}
var settings = global.db.data.settings[this.user.jid]
if (typeof settings !== 'object') global.db.data.settings[this.user.jid] = {}
if (settings) {
if (!('self' in settings)) settings.self = false
if (!('restrict' in settings)) settings.restrict = false
if (!('jadibotmd' in settings)) settings.jadibotmd = true
if (!('autobio' in settings)) settings.autobio = false
if (!('antiPrivate' in settings)) settings.antiPrivate = false
if (!('autoread' in settings)) settings.autoread = false
if (!('autoread2' in settings)) settings.autoread2 = false
if (!('antiSpam' in settings)) settings.antiSpam = true // Corrected init
if (!isNumber(settings.status)) settings.status = 0 // Added status init
} else global.db.data.settings[this.user.jid] = {
self: false,
restrict: false,
jadibotmd: true,
autobio: false,
antiPrivate: false,
autoread: false,
autoread2: false,
antiSpam: true,
status: 0
}
} catch (e) {
console.error(e)
}
if (opts['nyimak'])  return
if (!m.fromMe && opts['self'])  return
if (opts['swonly'] && m.chat !== 'status@broadcast')  return
if (typeof m.text !== 'string')
m.text = ''

let _user = global.db.data && global.db.data.users && global.db.data.users[m.sender]

const isROwner = [conn.decodeJid(global.conn.user.id), ...global.owner.map(([number]) => number)].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
const isOwner = isROwner || m.fromMe
const isMods = isOwner || global.mods.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
// Corrected isPrems check based on original code style
const isPrems = isROwner || global.prems.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender) || (_user ? _user.premium : false)


if (opts['queque'] && m.text && !(isMods || isPrems)) {
let queque = this.msgqueque, time = 1000 * 5
const previousID = queque[queque.length - 1]
queque.push(m.id || m.key.id)
// Use setTimeout with a distinct ID and clearInterval to avoid multiple timers
let timerId = setTimeout(async function checkQueue() {
    if (queque.indexOf(previousID) === -1) {
        clearTimeout(timerId); // Stop the timer if the previous message is processed
        return;
    }
    await delay(time);
    // Re-check the queue state and potentially schedule next check
    if (queque.indexOf(previousID) !== -1) {
        timerId = setTimeout(checkQueue, time); // Schedule next check
    } else {
        clearTimeout(timerId); // Ensure timer stops if previous is processed
    }
}, time);
}

//if (m.isBaileys) return // commented out as per original code
if (m.isBaileys || (m?.sender === this?.user?.jid)) { // Simplified check for bot's own message
    return;
}
m.exp += Math.ceil(Math.random() * 10)

// Moved group/participant data calculation up as it's needed for checks below
const groupMetadata = (m.isGroup ? ((conn.chats[m.chat] || {}).metadata || await this.groupMetadata(m.chat).catch(_ => null)) : {}) || {}
const participants = (m.isGroup ? groupMetadata.participants : []) || []
const user = (m.isGroup ? participants.find(u => conn.decodeJid(u.id) === m.sender) : {}) || {}
const bot = (m.isGroup ? participants.find(u => conn.decodeJid(u.id) == this.user.jid) : {}) || {}
const isRAdmin = user?.admin == 'superadmin' || false
const isAdmin = isRAdmin || user?.admin == 'admin' || false
const isBotAdmin = bot?.admin || false

const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
for (let name in global.plugins) {
    let plugin = global.plugins[name]
    if (!plugin || plugin.disabled) continue; // Combined checks
    const __filename = join(___dirname, name);

    if (typeof plugin.all === 'function') {
        try {
            await plugin.all.call(this, m, {
                chatUpdate,
                __dirname: ___dirname,
                __filename
            });
        } catch (e) {
            console.error(e);
            // Optionally reply with error for all handler issues
            // let text = format(e); for (let key of Object.values(global.APIKeys || {})) text = text.replace(new RegExp(key, 'g'), 'Administrador'); m.reply(text);
        }
    }

    // Original logic: if restrict is false, skip admin plugins
    if (!opts['restrict'] && plugin.tags && plugin.tags.includes('admin')) {
        continue;
    }

    // --- Start: Command Matching Logic (Prefix & Prefixless) ---
    let matched = false;
    let command, args, _args, text, usedPrefix = '', noPrefix = m.text;
    let prefixMatch = null; // Will store the result of prefix matching

    const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    let _prefix = plugin.customPrefix ? plugin.customPrefix : conn.prefix ? conn.prefix : global.prefix;

    // 1. Attempt to match with configured prefixes
    prefixMatch = (_prefix instanceof RegExp ?
        [[_prefix.exec(m.text), _prefix]] :
        Array.isArray(_prefix) ?
            _prefix.map(p => {
                let re = p instanceof RegExp ? p : new RegExp(str2Regex(p));
                return [re.exec(m.text), re];
            }) :
            typeof _prefix === 'string' ?
                [[new RegExp(str2Regex(_prefix)).exec(m.text), new RegExp(str2Regex(_prefix))]] :
                [[[], new RegExp]]
    ).find(p => p[1]);

    if (prefixMatch && prefixMatch[0] && prefixMatch[0][0]) { // Check if a prefix match was found
        usedPrefix = prefixMatch[0][0];
        noPrefix = m.text.replace(usedPrefix, '');
        [command, ...args] = noPrefix.trim().split` `.filter(v => v);
        _args = noPrefix.trim().split` `.slice(1);
        text = _args.join` `;
        command = (command || '').toLowerCase();

        let isAccept = plugin.command instanceof RegExp ?
            plugin.command.test(command) :
            Array.isArray(plugin.command) ?
                plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(command) : cmd === command) :
                typeof plugin.command === 'string' ?
                    plugin.command === command :
                    false;

        if (isAccept) {
            matched = true;
        }

    } else { // No prefix found, try matching the command directly at the start
        usedPrefix = ''; // Ensure usedPrefix is empty for prefixless
        noPrefix = m.text;
        let [potentialCommand, ...potentialArgs] = noPrefix.trim().split` `.filter(v => v);
        potentialCommand = (potentialCommand || '').toLowerCase();

        let isPotentialAccept = plugin.command instanceof RegExp ?
            plugin.command.test(potentialCommand) :
            Array.isArray(plugin.command) ?
                plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(potentialCommand) : cmd === potentialCommand) :
                typeof plugin.command === 'string' ?
                    plugin.command === potentialCommand :
                    false;

        // Check if the text actually starts with the potential command (case-insensitive, trimmed)
        // This prevents matching "say" in "I want to say hello" if "say" is a prefixless command
        if (isPotentialAccept && m.text.trimStart().toLowerCase().startsWith(potentialCommand)) {
             // Also ensure that the character *immediately* after the matched command string
             // is either a space or the end of the string, unless the command regex allows otherwise.
             // A simple startsWith is usually sufficient for string commands.
            command = potentialCommand;
            args = potentialArgs;
            _args = noPrefix.trim().split` `.slice(1);
            text = _args.join` `;
            matched = true; // Found a prefixless match
        }
    }
    // --- End: Command Matching Logic ---


    if (!matched) {
        // If the message text didn't match this plugin's command (with or without prefix), skip to the next plugin
        continue;
    }

    // If we reached here, a command was matched for this plugin (either prefixed or prefixless)
    // Ensure the plugin is actually a callable function before proceeding
    if (typeof plugin !== 'function') continue;


    // --- Start: Permissions and Execution ---

    // Keep original banned checks
    if (m.chat in global.db.data.chats || m.sender in global.db.data.users) {
        let chat = global.db.data.chats[m.chat]
        let user = global.db.data.users[m.sender]
        let setting = global.db.data.settings[this.user.jid] || {} // Added default empty object

        // Exclude specific commands from ban checks if needed (as in original code)
        const bypassBanned = ['owner-unbanchat.js', 'owner-exec.js', 'owner-exec2.js', 'tool-delete.js', 'group-unbanchat.js', 'owner-unbanuser.js', 'owner-unbanbot.js'];
        if (!bypassBanned.includes(name)) {
            if (chat?.isBanned && !isROwner) {
                // Optionally reply or log when chat is banned
                // console.log(`[BANNED CHAT] Command ${command} attempted in banned chat ${m.chat}`);
                return; // Stop processing if chat is banned and not ROwner
            }
             if (user?.banned && !isROwner) {
                // Antispam for banned users trying commands
                if (user.antispam > 2) return;
                 m.reply(`🚫 Está baneado(a), no puede usar los comandos de este bot!\n\n${user.bannedReason ? `\n💌 *Motivo:* ${user.bannedReason}` : '💌 *Motivo:* Sin Especificar'}\n\n⚠️ *Si este bot es cuenta oficial y tiene evidencia que respalde que este mensaje es un error, puede exponer su caso en:*\n\n🤍 ${global.asistencia || 'No assistance contact defined'}`); // Added default assistance msg
                user.antispam = (user.antispam || 0) + 1; // Increment antispam count
                return; // Stop processing if user is banned and not ROwner
            }
            if (setting?.banned && !isROwner) { // Assuming setting.banned means bot is banned from this user/chat type
                // Optionally reply or log if bot is banned
                // console.log(`[BOT BANNED] Command ${command} attempted while bot is banned`);
                 return; // Stop processing if bot is banned and not ROwner
            }
        }

        // Antispam 2 (moved here after banned user antispam)
        // This logic seems to just set a spam timestamp and check against a fixed delay (3000ms)
        // It also has a check `if (user.antispam2 && isROwner) return` which seems odd (ROwners are usually exempt)
        // Reinterpreting: If user.antispam2 is true *and* the user IS ROwner, return? Let's assume user.antispam2 is a flag set elsewhere to temporary block spamming. If ROwner is antispam2'd, maybe it should block them? Keeping original logic structure but noting it's unusual.
        if (user?.antispam2 && isROwner) return; // Original logic retained
        let time = (user?.spam || 0) + 3000; // Use 0 if user.spam is undefined
        if (new Date - time < 0) { // Check if current time is LESS THAN time + 3000 (i.e., less than 3 seconds since last spam)
            // console.log(`[SPAM] User ${m.sender} is spamming`); // Log spam attempts
             return; // Ignore if spamming
        }
        if (user) user.spam = new Date * 1; // Update last spam time ONLY IF user exists
    }


    // Keep adminMode check
    let chat = global.db.data.chats[m.chat] || {}; // Ensure chat object exists
    let adminMode = chat.modoadmin;
    let mini = `${plugin.botAdmin || plugin.admin || plugin.group || plugin || noPrefix || usedPrefix || m.text.slice(0, 1) == usedPrefix || plugin.command}`; // Original mini variable usage
    if (adminMode && !isOwner && !isROwner && m.isGroup && !isAdmin && mini) {
         // console.log(`[ADMIN MODE] Command ${command} blocked in admin mode for non-admins`); // Log admin mode block
         return; // Block command in admin mode if user is not owner/admin
    }

    // Keep permission checks
    let fail = plugin.fail || global.dfail
    if (plugin.rowner && !isROwner) {
        fail('rowner', m, this);
        continue; // Go to next plugin if permission fails
    }
    if (plugin.owner && !isOwner) {
        fail('owner', m, this);
        continue;
    }
    if (plugin.mods && !isMods) {
        fail('mods', m, this);
        continue;
    }
    if (plugin.premium && !isPrems) {
        fail('premium', m, this);
        continue;
    }
    if (plugin.group && !m.isGroup) {
        fail('group', m, this);
        continue;
    } else if (plugin.botAdmin && !isBotAdmin) {
        fail('botAdmin', m, this);
        continue;
    } else if (plugin.admin && !isAdmin) {
        fail('admin', m, this);
        continue;
    }
    if (plugin.private && m.isGroup) {
        fail('private', m, this);
        continue;
    }
    if (plugin.register == true && (_user ? _user.registered == false : true)) { // Added check for _user existence
        fail('unreg', m, this);
        continue;
    }

    // Command is accepted, set isCommand and handle exp/cookies
    m.isCommand = true;
    let xp = 'exp' in plugin ? parseInt(plugin.exp) : 17;
    if (xp > 200) {
        // m.reply('chirrido -_-'); // Commented out potential spammy reply
    } else {
        m.exp += xp;
    }

    if (!isPrems && plugin.cookies && global.db.data.users[m.sender]?.cookies < plugin.cookies * 1) { // Added optional chaining
        conn.reply(m.chat, `Se agotaron tus *🍪 Cookies*`, m, global.fake || {}); // Added default empty fake object
        continue; // Skip execution if not enough cookies
    }

    // Prepare extra object for plugin call
    let extra = {
        match: prefixMatch, // Pass the match result (can be null if prefixless)
        usedPrefix, // Actual prefix string or ''
        noPrefix, // Text after prefix removal or full text
        _args, // Args including command (original logic used this)
        args, // Args excluding command
        command, // Lowercase command string
        text, // Text after command
        conn: this,
        participants,
        groupMetadata,
        user: global.db.data.users[m.sender], // Pass the actual user object from db
        bot,
        isROwner,
        isOwner,
        isRAdmin,
        isAdmin,
        isBotAdmin,
        isPrems,
        chatUpdate,
        __dirname: ___dirname,
        __filename
    };

    // Execute the plugin
    try {
        await plugin.call(this, m, extra);
        // Handle cookies after successful execution if not premium
        if (!isPrems) {
             // Only consume cookies if plugin.cookies is defined and positive
            if (plugin.cookies > 0) {
                m.cookies = plugin.cookies; // Mark cookies to be consumed
            } else {
                m.cookies = false; // Ensure m.cookies is false if plugin doesn't consume cookies
            }
        }
    } catch (e) {
        m.error = e;
        console.error(e);
        // Reply with error message
        if (e) {
            let text = format(e);
            for (let key of Object.values(global.APIKeys || {})) // Added check for global.APIKeys
                text = text.replace(new RegExp(key, 'g'), 'Administrador');
            m.reply(text);
        }
    } finally {
        // Run plugin.after function
        if (typeof plugin.after === 'function') {
            try {
                await plugin.after.call(this, m, extra);
            } catch (e) {
                console.error(e);
            }
        }
        // Consume cookies if marked
        if (m.cookies && global.db.data.users[m.sender]?.cookies !== undefined) { // Added check for cookie existence
            global.db.data.users[m.sender].cookies -= m.cookies * 1;
            conn.reply(m.chat, `Utilizaste *${+m.cookies}* 🍪`, m, global.fake || {}); // Added default empty fake object
        }

        // Break the loop after processing a command
        break;
    }
    // --- End: Permissions and Execution ---

} // End of plugin loop

// --- Finally Block (executed after the plugin loop finishes) ---
// Keep the rest of the original finally block logic here
} catch (e) {
console.error(e)
} finally {
if (opts['queque'] && m.text) {
const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
if (quequeIndex !== -1)
                this.msgqueque.splice(quequeIndex, 1)
}
let userStats, stats = global.db.data.stats
if (m) {
    let dbUser = global.db.data.users[m.sender];
    if (dbUser && dbUser.muto === true) {
        let bang = m.key.id;
        let cancellazzione = m.key.participant;
        // Check if the message is in the chat before attempting to delete
        // await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: bang, participant: cancellazzione }})
        // Note: Deleting messages from others is often problematic/unreliable with Baileys.
        // This line attempts to delete an incoming message if the user is "muto" (muted).
        // It might require the bot to be an admin with delete permission.
    }
    if (m.sender && dbUser) { // Ensure dbUser exists before updating exp/cookies
        dbUser.exp += m.exp;
        // Cookies consumption is handled inside the command execution finally block now
        // The line `user.cookies -= m.cookies * 1` was moved there.
    }

    let stat;
    if (m.plugin) {
        let now = +new Date;
        if (m.plugin in stats) {
            stat = stats[m.plugin];
            if (!isNumber(stat.total)) stat.total = 0; // Correct initial state
            if (!isNumber(stat.success)) stat.success = 0; // Correct initial state
            if (!isNumber(stat.last)) stat.last = 0; // Correct initial state
            if (!isNumber(stat.lastSuccess)) stat.lastSuccess = 0; // Correct initial state
        } else {
             stat = stats[m.plugin] = { // Initialize if not exists
                total: 0,
                success: 0,
                last: 0,
                lastSuccess: 0
            };
        }
        // Update stats regardless of whether it was just initialized or already existed
        stat.total += 1;
        stat.last = now;
        if (m.error == null) {
            stat.success += 1;
            stat.lastSuccess = now;
        }
    }
}

try {
    // Check if m is defined before calling print
    if (m && !opts['noprint']) await (await import(`./lib/print.js`)).default(m, this);
} catch (e) {
    console.log(m, m.quoted, e);
}

let settingsREAD = global.db.data.settings[this.user.jid] || {};
if (opts['autoread']) await this.readMessages([m.key]);
// Assuming settingsREAD.autoread2 is a boolean or truthy value
if (settingsREAD.autoread2) await this.readMessages([m.key]);

// Keep presence update logic (if uncommented)
// await conn.sendPresenceUpdate('composing', m.chat);
// this.sendPresenceUpdate('recording', m.chat);

// Keep reaction logic
if (global.db.data.chats[m.chat]?.reaction && m.text.match(/(ción|dad|aje|oso|izar|mente|pero|tion|age|ous|ate|and|but|ify|ai|otho|a|s)/gi)) {
    let emot = pickRandom(["🍟", "😃", "😄", "😁", "😆", "🍓", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "🌺", "🌸", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🌟", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "💫", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😶‍🌫️", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🤖", "🍭", "🤫", "🫠", "🤥", "😶", "📇", "😐", "💧", "😑", "🫨", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😮‍💨", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👺", "🧿", "🌩", "👻", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🫶", "👍", "✌️", "🙏", "🫵", "🤏", "🤌", "☝️", "🖕", "🙏", "🫵", "🫂", "🐱", "🤹‍♀️", "🤹‍♂️", "🗿", "✨", "⚡", "🔥", "🌈", "🩷", "❤️", "🧡", "💛", "💚", "🩵", "💙", "💜", "🖤", "🩶", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🚩", "👊", "⚡️", "💋", "🫰", "💅", "👑", "🐣", "🐤", "🐈"]);
    if (!m.fromMe) await this.sendMessage(m.chat, { react: { text: emot, key: m.key }});
}
function pickRandom(list) { return list[Math.floor(Math.random() * list.length)]; }

}} // End of handler function finally block

export async function deleteUpdate(message) {
try {
const { fromMe, id, participant } = message
if (fromMe) return
let msg = this.serializeM(this.loadMessage(id))
let chat = global.db.data.chats[msg?.chat] || {}
if (!chat?.delete) return
if (!msg) return
if (!msg?.isGroup) return
const antideleteMessage = `╭•┈•〘❌ 𝗔𝗡𝗧𝗜 𝗗𝗘𝗟𝗘𝗧𝗘 ❌〙•┈• ◊
│❒ 𝗨𝗦𝗨𝗔𝗥𝗜𝗢:
│• @${participant.split`@`[0]}
│
│❒ 𝗔𝗰𝗮𝗯𝗮 𝗱𝗲 𝗲𝗹𝗶𝗺𝗶𝗻𝗮𝗿 𝘂𝗻 𝗺𝗲𝗻𝘀𝗮𝗷𝗲
│𝗿𝗲𝗲𝗻𝘃𝗶𝗮𝗻𝗱𝗼... ⏱️
╰•┈•〘❌ 𝗔𝗡𝗧𝗜 𝗗𝗘𝗟𝗘𝗧𝗘 ❌〙•┈• ◊`.trim();
await this.sendMessage(msg.chat, {text: antideleteMessage, mentions: [participant]}, {quoted: msg})
// Using this.copyNForward might be better if the bot should forward the original message type (text, image, video, etc.)
// A simple copy might be enough, depends on what loadMessage and serializeM return.
// await this.copyNForward(msg.chat, msg).catch(e => console.log(e, msg))
} catch (e) {
console.error(e)
}}

global.dfail = (type, m, conn) => {
const msg = {
rowner: `🍭 Hola, este comando solo puede ser utilizado por el *Creador* de la Bot.`,
owner: `🍭 Hola, este comando solo puede ser utilizado por el *Creador* de la Bot y *Sub Bots*.`,
mods: `🍭 Hola, este comando solo puede ser utilizado por los *Moderadores* de la Bot.`,
premium: `🍭 Hola, este comando solo puede ser utilizado por Usuarios *Premium*.`,
group: `🍭 Hola, este comando solo puede ser utilizado en *Grupos*.`,
private: `🍭 Hola, este comando solo puede ser utilizado en mi Chat *Privado*.`,
admin: `🍭 Hola, este comando solo puede ser utilizado por los *Administradores* del Grupo.`,
botAdmin: `🍭 Hola, la bot debe ser *Administradora* para ejecutar este Comando.`,
unreg: `🍭 Hola, para usar este comando debes estar *Registrado.*\n\nUtiliza: */reg nombre.edad*\n\n> Ejemplo: /reg Daniel.17`,
restrict: `🍭 Hola, esta característica está *deshabilitada.*`
}[type];
if (msg) return conn.reply(m.chat, msg, m, global.fake || {}).then(_ => m.react('✖️'))} // Added default empty fake object and react

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizo 'handler.js'"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})

// Helper function for converting strings to regex for prefix matching
function str2Regex(str) {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}
