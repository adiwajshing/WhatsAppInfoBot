const Commands = require('./Commands.js')
const WhatsappResponder = require('./Responder.js')

const commands = new Commands("botData.json")
//setTimeout(() => commands.getResponse("lunch").then ( str => console.log(str) ), 1000)

const responser = new WhatsappResponder(commands)
responser.start()