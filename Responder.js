const WhatsAppWeb = require("@adiwajshing/baileys")
const fs = require("fs")

module.exports = class {
	/**
	 * Create a WhatsApp Responder
	 * @param {function} processor - a function that can generate an output for a given text
	 * @param {Object} metadata - metadata about the authentication file for WhatsApp
	 * @param {string} metadata.authFile - path to the authentication credentials for WhatsApp
	 * @param {number} metadata.maxRequestsPerSecond - maximum number of texts anybody can send & have them responded to in a second
	 */
	constructor(processor, metadata) {
		this.processor = processor
		this.metadata = metadata
		
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
			const file = fs.readFileSync(this.metadata.authFile) // load the closed session back if it exists
			authInfo = JSON.parse(file)
		} catch { }
		this.client.connect (authInfo, 20*1000)
		.then (([user, _, __, unread]) => {
			const authInfo = this.client.base64EncodedAuthInfo()
			fs.writeFileSync(this.metadata.authFile, JSON.stringify(authInfo, null, "\t"))
			
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
		const messageText = message.message.conversation || message.message.text
		
		if (this.log[senderID]) {
			const diff = new Date().getTime() - this.log[senderID]
			if (diff < (1000/this.metadata.maxRequestsPerSecond) ) {
				console.log("too many requests from: " + senderID)
				return
			}
		}
		
		this.log[senderID] = new Date().getTime()
		try {
			const response = await this.processor(messageText, senderID)
			console.log(senderID + " sent message '" + messageText + "', responding with " + response)
			this.sendMessage(senderID, response, message.key.id)
		} catch (err) {
			console.log(senderID + " sent message '" + messageText + "', got error " + err)
			if (senderID.includes("@g.us")) {
				// do not respond if its a group
			} else if (typeof err === 'string') {
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