const WhatsAppWeb = require("Baileys")
const fs = require("fs")

module.exports = class Responder {

	constructor(languageProcessor, authFile) {
		this.processor = languageProcessor

		if (!languageProcessor.metadata.admins) {
			languageProcessor.metadata.admins = []
			languageProcessor.metadata.maxRequestsPerSecond = 1.0
			languageProcessor.metadata.responseTimeSeconds = [0.5,3.0]
		}
		this.authFile = authFile
		this.admins = {}
		this.log = { }
		this.client = new WhatsAppWeb()
		this.client.onConnected = () => {
			const authInfo = this.client.base64EncodedAuthInfo()
    		fs.writeFileSync(this.authFile, JSON.stringify(authInfo, null, "\t"))
		}
		this.client.onUnreadMessage = (m) => this.onMessage(m)
		this.client.onError = (err) => this.log("error: " + err)

		for (var i in languageProcessor.metadata.admins) {
			this.admins[ languageProcessor.metadata.admins[i] ] = true
		}

		setInterval (() => this.clearLog(), 10*60*1000)
	}

	start () {
		try {
			const file = fs.readFileSync(this.authFile) // load a closed session back if it exists
			const authInfo = JSON.parse(file)
			client.login( authInfo )
		} catch {
			client.connect()
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
			this.sendMessageAfterDelay(sender, str.charAt(0).toUpperCase() + str.slice(1))
		}).catch (err => {
			console.log(number + " sent message '" + messageText + "', got error " + err)
			this.sendMessageAfterDelay(sender, err)
		})
	}
	parseNumber (contact) {
		return contact.split("@")[0]
	}
	sendMessageAfterDelay(toContact, message) {
		const responseTimeRange = this.processor.metadata.responseTimeSeconds
		const delayS = (responseTimeRange[1]-responseTimeRange[0]) * Math.random() + responseTimeRange[0]
		setTimeout(() => this.sendMessage(toContact, message), delayS*1000)
	}
	sendMessage(toContact, message) {
		this.client.sendTextMessage(toContact, message)
		this.client.sendText(toContact, message)
	}
}