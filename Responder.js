const sulla = require('sulla');

module.exports = class Responder {

	constructor(commands) {
		this.commands = commands
		this.admins = {}
		this.log = { }
		this.requestsPerSecond = 0.5

		for (var i in commands.metadata.admins) {
			this.admins[ commands.metadata.admins[i] ] = true
		}

		setInterval (() => this.clearLog(), 10*60*1000)
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
	clearLog () {
		const time = new Date().getTime()
		for (var num in this.log) {
			if (time - this.log[num] > 10*60*1000) {
				delete(this.log[num])
			}
		}
	}
	onMessageReceived (message) {
		if (this.log[message.from]) {
			const diff = new Date().getTime() - this.log[message.from]
			console.log("diff:" + diff + ", " + (1000/this.commands.metadata.maxRequestsPerSecond) )
			if (diff < (1000/this.commands.metadata.maxRequestsPerSecond) ) {
				console.log("too many requests from: " + message.from)
				return
			}
		}

		this.log[message.from] = new Date().getTime()

		const number = this.parseNumber(message.from)
		var response = Promise.resolve()

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