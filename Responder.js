const sulla = require('sulla');

module.exports = class Responder {

	constructor(commands) {
		this.commands = commands
		this.admins = {}
		for (var i in commands.metadata.admins) {
			this.admins[ commands.metadata.admins[i] ] = true
		}
	}

	start () {
		sulla.create().then(client => {
			this.client = client
			this.client.onMessage(message => {
				try {
					this.onMessageReceived(message)
				} catch (error) {
					console.log("error in parsing message: " + error)
				}
				
			})
			console.log("started receiving messages")
		})
	}
	onMessageReceived (message) {
		const number = this.parseNumber(message.from)
		var response = Promise.resolve("")

		if (this.admins[number] === true && message.body.includes(";")) {
			try {
				this.commands.executeFromString(message.body)
				response = Promise.resolve("ok")
			} catch (err) {
				response = Promise.resolve(err)
			}
		} else {
			response = this.commands.getResponse(message.body)
		}
		
		response.then ((str) => {
			console.log(number + " sent message '" + message.body + "', responding with " + str)
			this.sendMessageAfterDelay(message.from, str.charAt(0).toUpperCase() + str.slice(1))
		}).catch ((err) => {
			console.log(number + " sent message '" + message.body + "', got error " + err)
			this.sendMessageAfterDelay(message.from, err)
		})
	}
	parseNumber (contact) {
		return contact.split("@")[0]
	}
	sendMessageAfterDelay(toContact, message) {
		const delayS = Math.random()*6 + 1.5
		setTimeout(() => this.sendMessage(toContact, message), delayS*1000)
	}
	sendMessage( toContact, message) {
		this.client.sendText(toContact, message)
	}
}