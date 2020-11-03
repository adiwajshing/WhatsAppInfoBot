const Baileys = require("@adiwajshing/baileys")
const fs = require("fs")

module.exports = class {
	/**
	 * Create a WhatsApp Responder
	 * @param {function} processor - a function that can generate an output for a given text
	 * @param {Object} metadata - metadata about the authentication file for WhatsApp
	 * @param {string} metadata.authFile - path to the authentication credentials for WhatsApp
	 * @param {number} metadata.maxRequestsPerSecond - maximum number of texts anybody can send & have them responded to in a second
	 * @param {boolean} [metadata.respondToPendingMessages] - should pending unread messages be responded to
	 * @param {string} [metadata.delayMessage] - message to send in case of a delay
	 * @param {number} [metadata.minimumDelayTriggerS] - minimum duration for delay trigger
	 */
	constructor(processor, metadata) {
		this.processor = processor
		this.metadata = metadata
		
		this.client = new Baileys.WAConnection()
		this.client.autoReconnect = Baileys.ReconnectMode.onAllErrors

		this.client.on ('message-new', m => this.onMessage(m))
	}
	async start () {
		const authFile = this.metadata.authFile
		fs.existsSync (authFile) && this.client.loadAuthInfo (this.metadata.authFile)
		
		const hasAuth = !!this.client.authInfo
		await this.client.connect ()

		if (hasAuth) {
			fs.writeFileSync(
				authFile, 
				JSON.stringify(
					this.client.base64EncodedAuthInfo(), 
					null, 
					"\t"
				)
			)
		}
		console.log ("Using account of: " + this.client.user.name)
		
		if (this.metadata.respondToPendingMessages) {
			const unreadMessages = await this.client.loadAllUnreadMessages ()
			console.log (`responding to ${unreadMessages.length} unread messages`)
			for (let message of unreadMessages) {
				await this.onMessage (message)
			}
		}
	}
	/**
	 * @param {Baileys.WAMessage} message 
	 */
	async onMessage (message) {
		// obviously don't respond to your own messages
		if (message.key.fromMe) return

		const senderID = message.key.remoteJid
		const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text
		if (!message.message) {
			console.log("recieved notification from " + senderID + " of type " + message.toJSON().messageStubType + "; cannot be responded to")
			return
		}
		if (!messageText) {
			console.log("recieved message from " + senderID + " with no text: " + JSON.stringify(message).slice(0, 100))
			return
		}

		// if a delay trigger is specified
		if (this.metadata.minimumDelayTriggerS && this.metadata.delayMessage) {
			// get timestamp of message
			const sendTime = message.messageTimestamp?.low || message.messageTimestamp
			const diff = (new Date().getTime()/1000)-sendTime
			if (diff > this.metadata.minimumDelayTriggerS) {
				console.log (`been ${diff} seconds since message, responding with delay message to ${senderID}`)
				// respond if not a group
				if (!senderID.includes("@g.us")) await this.sendMessage (senderID, this.metadata.delayMessage)
			}
		}

		let response
		try {
			response = await this.processor(messageText, senderID)
		} catch (err) {
			// do not respond if its a group
			if (senderID.includes("@g.us")) return
			response = (err.message || err).replace ('Error: ', '')
		}
		if (response) {
			console.log(senderID + " sent message '" + messageText + "', responding with " + response)
			await this.sendMessage(senderID, response, message)
		}
	}
	async sendMessage(toContact, message, quoted) {
		await this.client.updatePresence(toContact, Baileys.Presence.available)
		Baileys.delay (250)
		
		await this.client.chatRead(toContact)
		Baileys.delay (250)
		
		await this.client.updatePresence(toContact, Baileys.Presence.composing)
		Baileys.delay (2000)
		
		await this.client.sendMessage (toContact, message, Baileys.MessageType.text, { quoted })
	}
}