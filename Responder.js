const sulla = require('sulla');

module.exports = class Responder {

	constructor(languageProcessor) {
		this.processor = processor
		this.admins = {}
		this.log = { }

		for (var i in processor.metadata.admins) {
			this.admins[ processor.metadata.admins[i] ] = true
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
			console.log("diff:" + diff + ", " + (1000/this.processor.metadata.maxRequestsPerSecond) )
			if (diff < (1000/this.processor.metadata.maxRequestsPerSecond) ) {
				console.log("too many requests from: " + message.from)
				return
			}
		}

		this.log[message.from] = new Date().getTime()

		const number = this.parseNumber(message.from)
		var response = Promise.resolve()

		if (this.admins[number] === true && message.body.includes(";")) {
			try {
				this.processor.executeFromString(message.body)
				response = Promise.resolve("ok")
			} catch (err) {
				response = Promise.resolve(err)
			}
		} else {
			response = this.processor.getResponse(message.body)
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
		const delayS = Math.random()*3 + 1.0
		setTimeout(() => this.sendMessage(toContact, message), delayS*1000)
	}
	sendMessage( toContact, message) {
		this.client.sendText(toContact, message)
	}
}