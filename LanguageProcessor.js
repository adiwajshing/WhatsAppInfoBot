var fs = require('fs')
const CMDLine = require('./LanguageProcessor.CMDLine.js')

module.exports = class LanguageProcessor {
	
	constructor(filename) {
		this.filename = filename
		this.data = { }
		this.metadata = { }
		this.customProcessor = undefined
		this.isSavingFile = false

		const functions = Object.getOwnPropertyNames(CMDLine.prototype)
		for (var i in functions) {
			LanguageProcessor.prototype[functions[i]] = CMDLine.prototype[functions[i]]
		}

		this.loadData()
		fs.watchFile(filename, (curr, prev) => this.loadData())
	}
	loadData () {
		if (this.isSavingFile) {
			this.isSavingFile = false
			return
		}

		try {
			const data = JSON.parse( fs.readFileSync(this.filename) )
			this.data = data.responses
			this.metadata = data.metadata
			
			console.log("read from file " + this.filename)

			if (this.customProcessor) {
				delete(this.customProcessor)		
			}

			if (this.metadata.customCommandsFile) {
				const LanguageProcessorExt = require(this.metadata.customCommandsFile)

				this.customProcessor = new LanguageProcessorExt(this)
				this.customProcessor.dataFileDidLoad()
				console.log("loaded custom commands from file: " + this.metadata.customCommandsFile)
			} else {
				delete(this.customProcessor)
			}

		} catch (error) {
			this.data = { }
			this.metadata = {
				"admins": [],
				"unknownCommandText": "unknown command {0}",
				"maxRequestsPerSecond": 0.5
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
	parameterIndices (regexString) {
		let indices = {}
		let curIndex = -1

		for (let i = 0; i < regexString.length-2;i++) {
			let char = regexString.charAt(i)
			if (char === "(") {
				curIndex += 1
			} else if (char === "{" && regexString.charAt(i+2) === "}") {
				curIndex += 1
				const id = regexString.charAt(i+1)
				indices[id] = curIndex+1 // add 1 as we append a (the |) clause before the parameter
			}
		}
		let keys = Object.keys(indices)
		keys.sort()

		return keys.map(num => indices[num])
	}
	editQuestionMap (question, command) {
		if (question.includes("|")) {
			if (command !== null) {

				const indices = this.parameterIndices(question)
				const regex = new RegExp( "^" + question.replace("{0}", "(the |)(.{2,20})") + "$", "i" )

				this.regexMap[question] = [command, regex, indices]
			} else {
				delete(this.regexMap[question])
			}
		} else {
			if (command !== null) {
				this.nonSpecificMap[question] = command
			} else {
				delete(this.nonSpecificMap[question])
			}
		}
	}

	getResponse (str) {
		const arr = [ "?", "!", "." ]
		if (str.length > 1 && arr.includes(str.charAt(str.length-1))) {
			str = str.slice(0, -1)
		}
		const lcaseStr = str.toLowerCase()
		var command = this.nonSpecificMap[lcaseStr]
		var options = null

		if (command === undefined) {
			command = this.optionMap[lcaseStr]

			if (command === undefined) {

				for (var ques in this.regexMap) {
					const info = this.regexMap[ques]

					const exp = info[1].exec(str)
					
					if (exp !== null) {
						command = info[0]
						options = info[2].map(index => exp[ index+1 ])
						break
					}

				}

				if (command === undefined) {
					return Promise.reject( this.metadata.unknownCommandText.replace("{0}", str) )
				}

			} else {
				let arr = []
				let promise = Promise.resolve()
				
				for (var i in command) {
					const a = i
					promise = promise.then( () => this.formatAnswer(this.data[command[a]], str).then ((ans) => arr.push(ans)) )
				}

				return promise.then (() => {
					if (arr.length == 1) {
						return arr[0]
					} else {
						return arr.map((str, index) => ((index+1) + ". " + str) ).join("\n")
					}
				})
			}
		}
	
		return this.formatAnswer(this.data[command], options)
	}
	formatAnswer (cmd, options) {
		let answer = cmd.answer

		if (options.length > 1 || answer.includes("function:")) {
			answer = answer.replace("function:", "")
			if (this.customProcessor === undefined || this.customProcessor[answer] === undefined) {
				console.error("function for command '" + cmd + "' not present in custom parser!")
				return Promise.reject("this function is unavailable at this time")
			}
			return this.customProcessor[answer](options)
		} else if (options !== null) {
			const txt = options.length > 0 ? options[0].toLowerCase() : ""
			const optionValue = cmd.options[txt]

			if (optionValue === undefined || options.length === 0) {

				if (answer.includes("{0}")) {
					return Promise.reject(
				 		"Sorry, I can't answer for '" + options + "'\n" + 
						"However, I can answer for the following options:\n" + Object.keys(cmd.options).join("\n")
					)
				}	
			}

			if (answer.includes("{1}")) {
				answer = answer.replace("{0}", options[0]).replace("{1}", optionValue)
			} else {
				answer = answer.replace("{0}", optionValue)
			}
		}

		return Promise.resolve(answer)
	}

	save () {
		const data = {
			metadata: this.metadata,
			responses: this.data
		}

		let str = JSON.stringify(data, null, "\t")
		this.isSavingFile = true
		fs.writeFile(this.filename, str, function (err) {
  			if (err) {
  				this.isSavingFile = false
  				throw err
  			}
  			console.log('saved commands file');
		})
	}

}