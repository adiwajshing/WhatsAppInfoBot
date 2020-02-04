var fs = require('fs')

module.exports = class Commands {
	
	constructor(filename) {
		this.filename = filename

		this.loadData()
		fs.watchFile(filename, (curr, prev) => this.loadData())
	}
	loadData () {
		try {
			const data = JSON.parse( fs.readFileSync(this.filename) )
			this.data = data.responses
			this.metadata = data.metadata
			
			console.log("read from file " + this.filename)

			if (this.commandsExt) {
				delete(this.commandsExt)		
			}

			if (this.metadata.customCommandsFile) {
				const CommandsExt = require(this.metadata.customCommandsFile)

				this.commandsExt = new CommandsExt(this)
				this.commandsExt.dataFileDidLoad()
				console.log("loaded custom commands from file: " + this.metadata.customCommandsFile)
			} else {
				delete(this.commandsExt)
			}

		} catch (error) {
			this.data = { }
			this.metadata = {
				"admins": [] 
			}
			console.log("error in loading data: " + error)
		}
		this.computeQuestionMap()
	}
	computeQuestionMap () {
		this.nonSpecificMap = { }
		this.optionMap = { }
		this.regexMap = { }

		for (var property in this.data) {

			const questions = this.data[property].possibleQuestions

			for (var i in questions) {
				this.editQuestionMap(questions[i], property)
			}

			const options = this.data[property].options
			for (var option in options) {
				let arr = this.optionMap[option] || []
				arr.push(property)
				this.optionMap[option] = arr
			}
		}

	}
	editQuestionMap (question, command) {
		if (question.includes("{0}")) {
			const regex = "^" + question.replace("{0}", "(the |)(.{2,20})") + "$"
			if (command !== null) {
				this.regexMap[regex] = command
			} else {
				delete(this.regexMap[regex])
			}
			
		} else {
			if (command !== null) {
				this.nonSpecificMap[question] = command
			} else {
				delete(this.nonSpecificMap[question])
			}
		}
	}
	executeFromString (commandStr) { execute(commandStr.split(";\n")) }

	execute (commands) {

		if (commands.length === 0) {
			throw "no commands entered"
		}
		if (commands.length === 1) {
			commands[0].splice(commands[0].length-1, 1)
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
		if (this.data[command] === undefined || this.data[command] === null) {
			throw "command '" + command + "' does not exist"
		}
	}
	create (command) {
		try {
			this.ensureCommandExists(command)
		} catch(err) {
			this.data[command] = {
				possibleQuestions: [],
				answer: "",
				options: {},
				description: ""
			}
			return
		}
		throw "command '" + command + "' already exists"
	}
	delete (command) {
		this.ensureCommandExists(command)
		for (var i in this.data[command].possibleQuestions) {
			this.editQuestionMap(this.data[command].possibleQuestions[i], null)
		}
		this.computeQuestionMap()
	}

	addQuestion (command, question) {
		this.ensureCommandExists(command)
		if (this.command[command].possibleQuestions.findIndex(question) < 0) {
			throw "question: '" + question + "' already exists in '" + command + "'"
		} 
		this.data[command].possibleQuestions.push(question)
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
		this.data[command].answer = answer
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
		this.data[command].description = description
	}

	getResponse (str) {
		if (str.charAt(str.length-1) === "?") {
			str = str.slice(0, -1)
		}
		str = str.toLowerCase()

		var command = this.nonSpecificMap[str]

		if (command === undefined) {
			command = this.optionMap[str]

			var option = null
			if (command === undefined) {

				for (var regex in this.regexMap) {

					const exp = new RegExp(regex).exec(str)
					if (exp !== null) {
						command = this.regexMap[regex]
						option = exp[2]
						break
					}

				}

				if (command === undefined) {
					return Promise.reject( "Sorry, I don't understand what is meant by '" + str + "'. Type help to know what all questions I can answer" )
				}

			} else {
				let arr = []
				let promise = Promise.resolve()
				for (var i in command) {
					const a = i
					promise = promise.then( () => this.formatAnswer(this.data[command[a]], str).then ((ans) => arr.push(ans)) )
				}
				return promise.then (() => arr.join("\n"))
			}
		}
	
		let cmd = this.data[command]
		return this.formatAnswer(cmd, option)
	}
	formatAnswer (cmd, option) {
		let answer = cmd.answer

		if (answer.includes("function:")) {
			answer = answer.replace("function:", "")
			if (this.commandsExt === undefined || this.commandsExt[answer] === undefined) {
				return Promise.reject("this function is unavailable at this time")
			}
			return this.commandsExt[answer](option)
		} else if (option !== null && option !== undefined) {
			if (cmd.options[option] === undefined) {
				return Promise.reject(
				 "Sorry, I don't understand what is meant by '" + option + "'\n" + 
				"I can answer for the following options: " + Object.keys(cmd.options).join(", ")
				)
			}
			if (answer.includes("{1}")) {
				answer = answer.replace("{0}", option).replace("{1}", cmd.options[option])
			} else {
				answer = answer.replace("{0}", cmd.options[option])
			}
		}

		return Promise.resolve(answer)
	}

	save () {
		let str = JSON.stringify(this.data, null, "\t")

		fs.writeFile(this.filename, str, function (err) {
  			if (err) throw err
  			console.log('saved commands file');
		})
	}

}