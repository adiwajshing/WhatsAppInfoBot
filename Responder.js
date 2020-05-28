const WhatsAppWeb = require("baileys")
const fs = require("fs")

module.exports = class Responder {

	constructor(languageProcessor) {
		this.processor = languageProcessor
		
		let data = languageProcessor.data
		data.meta.whatsAppCredsFile = data.meta.whatsAppCredsFile || "auth_info.json"
		data.meta.maxRequestsPerSecond = data.meta.maxRequestsPerSecond || 1.0,

		this.authFile = data.meta.whatsAppCredsFile
		this.log = { }
		this.client = new WhatsAppWeb()
		this.client.autoReconnect = true

		this.client.setOnUnreadMessage (m => this.onMessage(m))
		this.client.setOnUnexpectedDisconnect (err => console.error("disconnected unexpectedly: " + err))

		setInterval (() => this.clearLog(), 10*60*1000)
	}
	start () {
		var authInfo = null
		try {
			const file = fs.readFileSync(this.authFile) // load the closed session back if it exists
			authInfo = JSON.parse(file)
		} catch { }
		this.client.connect (authInfo, 20*1000)
		.then (([user, _, __, unread]) => {
			const authInfo = this.client.base64EncodedAuthInfo()
			fs.writeFileSync(this.authFile, JSON.stringify(authInfo, null, "\t"))
			
			console.log ("Using account of: " + user.name)
			console.log ("Have " + unread.length + " pending messages")
			unread.forEach (m => this.onMessage(m))
		})
		.catch (err => console.error("got error: " + err) )
	}
	clearLog () {
		const time = new Date().getTime()
		for (var num in this.log) {
			if (time - this.log[num] > 10*60*1000) {
				delete(this.log[num])
			}
		}
	}
	async onMessage (message) {
		const senderID = message.key.remoteJid
		const [notificationType, messageType] = this.client.getNotificationType (message)
		if (notificationType !== "message") {
			console.log("recieved notification from " + senderID + " of type " + notificationType + "; cannot be responded to")
			return
		}
		if (messageType !== WhatsAppWeb.MessageType.text && messageType !== WhatsAppWeb.MessageType.extendedText) {
			console.log("recieved message from " + senderID + " of type " + messageType + "; cannot be responded to")
			return
		}
		const messageText = message.message.conversation ?? message.message.text
		
		if (this.log[senderID]) {
			const diff = new Date().getTime() - this.log[senderID]
			if (diff < (1000/this.processor.data.meta.maxRequestsPerSecond) ) {
				console.log("too many requests from: " + senderID)
				return
			}
		}
		
		this.log[senderID] = new Date().getTime()
		try {
			const response = await this.processor.output(messageText, senderID)
			console.log(senderID + " sent message '" + messageText + "', responding with " + response)
			this.sendMessage(senderID, response, message.key.id)
		} catch (err) {
			console.log(senderID + " sent message '" + messageText + "', got error " + err)
			if (senderID.includes("@g.us")) {
				// do not respond if its a group
			} else {
				this.sendMessage(senderID, err, message.key.id)
			}
		}
	}
	sendMessage(toContact, message, messageID) {
		let delay = 0.25

		setTimeout(() => this.client.updatePresence(toContact, WhatsAppWeb.Presence.available), delay*1000)
		delay += 0.25
		setTimeout(() => this.client.sendReadReceipt(toContact, messageID), delay*1000)
		delay += 0.5
		setTimeout(() => this.client.updatePresence(toContact, WhatsAppWeb.Presence.composing), delay*1000)
		delay += 1.75
		setTimeout(() => this.client.sendTextMessage(toContact, message, {}), delay*1000)
	}
}