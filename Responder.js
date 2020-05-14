const WhatsAppWeb = require("baileys")
const fs = require("fs")

module.exports = class Responder {

	constructor(languageProcessor) {
		this.processor = languageProcessor

		if (!languageProcessor.data.metadata.admins) {
			languageProcessor.data.metadata.admins = []
		}
		if (!languageProcessor.data.metadata.maxRequestsPerSecond) {
			languageProcessor.data.metadata.maxRequestsPerSecond = 1.0
		}
		if (!languageProcessor.data.metadata.responseTimeSeconds) {
			languageProcessor.data.metadata.responseTimeSeconds = [0.5,3.0]
		}
		if (!languageProcessor.data.metadata.whatsapp_creds_file) {
			languageProcessor.data.metadata.whatsapp_creds_file = "auth_info.json"
		}

		this.authFile = languageProcessor.data.metadata.whatsapp_creds_file
		this.admins = {}
		this.log = { }
		this.client = new WhatsAppWeb()
		this.client.autoReconnect = true

		this.client.setOnUnreadMessage (m => this.onMessage(m))
		this.client.setOnUnexpectedDisconnect (err => console.log("disconnected unexpectedly: " + err))

		for (var i in languageProcessor.data.metadata.admins) {
			this.admins[ languageProcessor.data.metadata.admins[i] ] = true
		}

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
		.catch (err => console.log("got error: " + err) )
	}
	clearLog () {
		const time = new Date().getTime()
		for (var num in this.log) {
			if (time - this.log[num] > 10*60*1000) {
				delete(this.log[num])
			}
		}
	}
	onMessage (message) {
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
			if (diff < (1000/this.processor.data.metadata.maxRequestsPerSecond) ) {
				console.log("too many requests from: " + senderID)
				return
			}
		}
		this.log[senderID] = new Date().getTime()

		var response
		if (this.admins[senderID] === true && messageText.includes(";")) {
			try {
				this.processor.executeFromString(messageText)
				response = Promise.resolve("ok")
			} catch (err) {
				response = Promise.resolve(err)
			}
		} else {
			response = this.processor.getResponse(messageText, senderID)
		}
		
		response.then (str => {
			console.log(senderID + " sent message '" + messageText + "', responding with " + str)
			str = str.charAt(0).toUpperCase() + str.slice(1)
			this.sendMessage(senderID, str, message.key.id)
		}).catch (err => {
			console.log(senderID + " sent message '" + messageText + "', got error " + err)
			if (senderID.includes("@g.us")) {

			} else {
				this.sendMessage(senderID, err, message.key.id)
			}
		})
	}
	sendMessage(toContact, message, messageID) {
		let delay = this.processor.data.metadata.responseTimeSeconds[0]
		setTimeout(() => this.client.updatePresence(toContact, WhatsAppWeb.Presence.available), delay*1000)
		delay += 0.25
		setTimeout(() => this.client.sendReadReceipt(toContact, messageID), delay*1000)
		delay += 0.5
		setTimeout(() => this.client.updatePresence(toContact, WhatsAppWeb.Presence.composing), delay*1000)
		delay += 1.75
		setTimeout(() => this.client.sendTextMessage(toContact, message), delay*1000)
	}
}