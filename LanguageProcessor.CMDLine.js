module.exports = class LanguageProcessorCMDLine {

	executeFromString (commandStr) { this.execute(commandStr.split(";\n")) }

	execute (commands) {

		if (commands.length === 0) {
			throw "no commands entered"
		}

		if (commands.length === 1) {
			if (commands[0].charAt(commands[0].length-1) === ";") {
				commands[0] = commands[0].slice(0, -1)
			}
		}

		const commandList = {
			create: (str) => this.parse(/^-(.\w{2,15}?)$/, "create", str, 1),
			delete: (str) => this.parse(/^-(.\w{2,15}?)$/, "delete", str, 1),

			add_question: (str) => this.parse(/^(.\w{2,15}?) "(.*?)"$/, "addQuestion", str, 2),
			delete_question: (str) => this.parse(/^(.\w{2,15}?) "(.*?)"$/, "deleteQuestion", str, 2),

			set_answer: (str) => this.parse(/^(.\w{2,15}?) "(.*?)"$/, "setAnswer", str, 2),

			set_option: (str) => this.parse(/^(.\w{2,15}?) "(.*?)"="(.*?)"$/, "setOption", str, 3),
			delete_option: (str) => this.parse(/^(.\w{2,15}?) "(.*?)"$/, "removeOption", str, 2),

			set_description: (str) => this.parse(/^(.\w{2,15}?) "(.*?)"$/, "setDescription", str, 2)
		}
		const prevData = this.data

		for (let i = 0;i<commands.length;i++) {

			const components = commands[i].split(" ")
			const cmd = commandList[components[0]]

			if (cmd === undefined || cmd === null) {
				this.data = prevData
				throw "line " + (i+1) + ": unknown command sent: " + components[0]
			}

			try {
				cmd(components.slice(1,10).join(" "))
			} catch(err) {
				this.data = prevData
				throw "line " + (i+1) + ": " + err
			}
			
		}
		this.save()
	}
	parse(regex, exec, command, numberOfOptions) {
		const exp = regex.exec( command )
		if (exp === null) {
			throw "unable to parse '" + command + "'" 
		}

		switch (numberOfOptions) {
			case 1:
				this[exec](exp[1])
				break
			case 2:
				this[exec](exp[1], exp[2])
				break
			case 3:
				this[exec](exp[1], exp[2], exp[3])
				break
			default:
				throw "unknown number of options sent: " + numberOfOptions
				break
		}

	}


	ensureCommandExists (command) {
		if (this.data.responses[command] === undefined || this.data.responses[command] === null) {
			throw "command '" + command + "' does not exist"
		}
	}
	create (command) {
		try {
			this.ensureCommandExists(command)
		} catch(err) {
			this.data.responses[command] = {
				possibleQuestions: [],
				answer: "",
				options: {},
				meta: {
					userFacingName: command,
					description: "",
					examples: []
				},
				onUnknownOption: ""
			}
			return
		}
		throw "command '" + command + "' already exists"
	}
	delete (command) {
		this.ensureCommandExists(command)
		for (var i in this.data.responses[command].possibleQuestions) {
			this.editQuestionMap(this.data[command].possibleQuestions[i], null)
		}
		this.computeQuestionMap()
	}

	addQuestion (command, question) {
		this.ensureCommandExists(command)
		if (this.data.responses[command].possibleQuestions.findIndex(q => q === question) >= 0) {
			throw "question: '" + question + "' already exists in '" + command + "'"
		} 
		this.data.responses[command].possibleQuestions.push(question)
		this.editQuestionMap(question, command)
	}
	deleteQuestion(command, question) {
		this.ensureCommandExists(command)
		let arr = this.data[command].possibleQuestions
		let index = arr.findIndex(value => value === question)
		if (index < 0) {
			throw "question '" + question + "' does not exist"
		}
		arr.splice(index, 1)
		this.data[command].possibleQuestions = arr
		this.editQuestionMap(question, null)
	}
	setAnswer (command, answer) {
		this.ensureCommandExists(command)
		this.data.responses[command].answer = answer
	}

	setOption (command, optionKey, optionValue) {
		this.ensureCommandExists(command)
		this.data[command].options[optionKey] = optionValue
	}
	removeOption (command, optionKey) {
		this.ensureCommandExists(command)
		if (this.data[command].options[optionKey] === undefined) {
			throw "answer option does not exist: '" + optionKey + "'"
		}
		delete(this.data[command].options[optionKey])
	}

	setDescription (command, description) {
		this.ensureCommandExists(command)
		this.data[command].meta.description = description
	}

	chat () {
		console.log("type 'q' to exit;")
		const readline = require('readline').createInterface({input: process.stdin, output: process.stdout})

		const getInput = () => {
			readline.question("\ntype: ", (ques) => {
				if (ques === "q") {
					readline.close()
					process.exit(0)
				} else {
					this.getResponse(ques, "test").then (str => { 
						console.log("response:\n" + str) 
						getInput()
					}).catch (err => {
						console.log("fallback:\n" + err) 
						getInput()
					})
				}
			})	
		}
		getInput()
	}

}