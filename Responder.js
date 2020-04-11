const WhatsAppWeb = require("Baileys")
const fs = require("fs")

module.exports = class Responder {

	constructor(languageProcessor) {
		this.processor = languageProcessor

		if (!languageProcessor.metadata.admins) {
			languageProcessor.metadata.admins = []
		}
		if (!languageProcessor.metadata.maxRequestsPerSecond) {
			languageProcessor.metadata.maxRequestsPerSecond = 1.0
		}
		if (!languageProcessor.metadata.responseTimeSeconds) {
			languageProcessor.metadata.responseTimeSeconds = [0.5,3.0]
		}
		if (!languageProcessor.metadata.whatsapp_creds_file) {
			languageProcessor.metadata.whatsapp_creds_file = "auth_info.json"
		}

		this.authFile = authFile
		this.admins = {}
		this.log = { }
		this.client = new WhatsAppWeb()
		this.client.handlers.onConnected = () => {
			const authInfo = this.client.base64EncodedAuthInfo()
    		fs.writeFileSync(this.authFile, JSON.stringify(authInfo, null, "\t"))
		}
		this.client.handlers.onUnreadMessage = (m) => this.onMessage(m)
		this.client.handlers.onError = (err) => console.log("error: " + err)

		for (var i in languageProcessor.metadata.admins) {
			this.admins[ languageProcessor.metadata.admins[i] ] = true
		}

		setInterval (() => this.clearLog(), 10*60*1000)
	}

	start () {
		try {
			const file = fs.readFileSync(this.authFile) // load the closed session back if it exists
			const authInfo = JSON.parse(file)
			this.client.login( authInfo )
		} catch (error) {
			this.client.connect()
		}
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

		const sender = message.key.remoteJid
		let messageText
		if (message.message.conversation) {
			messageText = message.message.conversation
		} else if (message.message.text) {
			messageText = message.message.text
		} else {
			console.log("recieved message from " + sender + "; cannot be responded to: " + JSON.stringify(message.message))
			return
		}
		
		if (this.log[sender]) {
			const diff = new Date().getTime() - this.log[sender]
			console.log("diff:" + diff + ", " + (1000/this.processor.metadata.maxRequestsPerSecond) )
			if (diff < (1000/this.processor.metadata.maxRequestsPerSecond) ) {
				console.log("too many requests from: " + sender)
				return
			}
		}

		this.log[sender] = new Date().getTime()

		const number = this.parseNumber(sender)
		var response = Promise.resolve()

		if (this.admins[number] === true && messageText.includes(";")) {
			try {
				this.processor.executeFromString(messageText)
				response = Promise.resolve("ok")
			} catch (err) {
				response = Promise.resolve(err)
			}
		} else {
			response = this.processor.getResponse(messageText, sender)
		}
		
		response.then (str => {
			console.log(number + " sent message '" + messageText + "', responding with " + str)
			str = str.charAt(0).toUpperCase() + str.slice(1)
			this.sendMessage(sender, str, message.key.id)
		}).catch (err => {
			console.log(number + " sent message '" + messageText + "', got error " + err)
			this.sendMessage(sender, err, message.key.id)
		})
	}
	parseNumber (contact) {
		return contact.split("@")[0]
	}
	sendMessage(toContact, message, messageID) {
		let delay = this.processor.metadata.responseTimeSeconds[0]
		setTimeout(() => this.client.updatePresence(toContact, WhatsAppWeb.Presence.available), delay*1000)
		delay += 0.5
		setTimeout(() => this.client.sendReadReceipt(toContact, messageID), delay*1000)
		delay += 0.5
		setTimeout(() => this.client.updatePresence(toContact, WhatsAppWeb.Presence.composing), delay*1000)
		delay += 2.0
		setTimeout(() => this.client.sendTextMessage(toContact, message), delay*1000)
	}
}