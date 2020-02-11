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
			this.data = JSON.parse( fs.readFileSync(this.filename) )
			
			console.log("read from file " + this.filename)

			if (this.customProcessor) {
				delete(this.customProcessor)		
			}

			const customProcessorFile = this.data.metadata.customProcessor
			if (customProcessorFile && customProcessorFile !== "") {
				const LanguageProcessorExt = require(customProcessorFile)

				this.customProcessor = new LanguageProcessorExt(this)
				this.customProcessor.dataFileDidLoad()
				console.log("loaded custom processor from file: " + customProcessorFile)
			} else {
				delete(this.customProcessor)
			}

		} catch (error) {
			this.data = {
				metadata: {
					unknownCommandText: "unknown command <input/>",
					defaultRegexBlank: "(?:the |)(.{1,15})",
					mapOnlyOptionInput: true,
					customProcessor: ""
				},
				templates: {
					greeting: "(hi |hello |)(,|) "
				},
				responses: {

				}
			}
			console.log("error in loading data: " + error)
		}

		this.computeQuestionMap()
	}
	computeQuestionMap () {
		this.nonSpecificMap = { }
		this.optionMap = { }
		this.regexMap = { }
		this.templateMap = { }

		for (var template in this.data.templates) {
			let obj = {str: this.data.templates[template]}
			let tags = this.processQuestion(obj, "(.*)")

			this.templateMap[template] = {
				regex: new RegExp("^"+obj.str+"$", "i"),
				associatedQuestions: [ ]
			}
		}

		for (var property in this.data.responses) {
			const op = this.data.responses[property]
			const questions = op.possibleQuestions

			for (var i in questions) {
				this.editQuestionMap(questions[i], property)
			}

			let options = Object.keys(op.options)
			options.forEach (option => {
				if (op.options[option] && op.options[option].keys) {
					op.options[option].keys.forEach(option2 => {
						let arr = this.optionMap[option2] || []
						arr.push([property, option])
						this.optionMap[option2] = arr
					})
				}

				let arr = this.optionMap[option] || []
				arr.push([property, option])
				this.optionMap[option] = arr
			})
		}
	}
	processQuestion (stringObject, defaultBlank) {
		let tags = []

		let lastTag = ""
		let currentTag = ""
		let inTag = false

		let str = stringObject.str
		var newStr = ""

		let totalTags = 0

		for (let i = 0; i < str.length;i++) {

			let char = str.charAt(i)

			if (char === "(" && !inTag && lastTag === "") {
				newStr += "("
				if (i+2 < str.length && str[i+1] !== "?" && str[i+1] !== ":") {
					newStr += "?:"
				}
				totalTags += 1
			} else if (char === "<") {
				if (inTag) {
					throw "'<' char in tag"
				}
				inTag = true
			} else if (char === ">") {
				if (!inTag) {
					throw "'>' without tag"
				}

				inTag = false
				if (currentTag[currentTag.length-1] === "/") {
					lastTag = ""
					tags.push(currentTag.slice(0, -1))
					currentTag = ""

					newStr += defaultBlank
				} else if (lastTag === "") {
					lastTag = currentTag
					tags.push(currentTag)
					currentTag = ""
				} else if ("/" + lastTag === currentTag) {
					lastTag = ""
					currentTag = ""
				} else {
					throw "tag " + lastTag + " did not close"
				}
				
			} else if (inTag) {
				currentTag += char
			} else {
				newStr += char
			}
		}
		stringObject.str = newStr
		stringObject.totalTags = totalTags

		if (inTag) {
			throw "incomplete tag " + currentTag
		}
		if (lastTag !== "") {
			throw "tag " + lastTag + " not closed"
		}

		return tags
	}
	editQuestionMap (questionData, command) {

		let question
		let requiresTemplateToMatch = false
		if (typeof questionData === "string") {
			question = questionData
		} else {
			question = questionData.question
			requiresTemplateToMatch = true
			questionData.templates.forEach(template => {
				if (this.templateMap[template]) {

					this.templateMap[template].associatedQuestions.push(question)
				} else if (template === "") {
					requiresTemplateToMatch = false
				} else {
					throw "template '" + template + "' not present"
				}
			})
			
		}

		if (question.includes("<")) {

			if (command !== null) {

				let obj = {str: question}
				const tags = this.processQuestion(obj, this.data.metadata.defaultRegexBlank)

				const regex = new RegExp("^" + obj.str + "$", "i")

				this.regexMap[question] =
					{
						command: command,
						regex: regex,
						tags: tags,
						requiresTemplate: requiresTemplateToMatch
					}
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
		if (str.length > 1 && [ "?", "!", "." ].includes(str.charAt(str.length-1))) {
			str = str.slice(0, -1)
		}

		let match
		let possibleQuestions
		if (this.templateMap.greeting) {
			match = str.match(this.templateMap.greeting.regex)
			if (match) {
				str = match[1]
				match = undefined
			}
		}

		for (var template in this.templateMap) {
			if (template === "greeting") {
				continue
			}

			match = str.match(this.templateMap[template].regex)
			if (match) {
				str = match[1]
				possibleQuestions = this.templateMap[template].associatedQuestions
				break
			}

		}
		if (!possibleQuestions) {
			possibleQuestions = Object.keys(this.regexMap)
		}

		const lcaseStr = str.toLowerCase()
		let command = this.nonSpecificMap[lcaseStr]
		let options = {}

		if (command === undefined) {
			command = this.optionMap[lcaseStr]

			if (command === undefined) {
				for (var i in possibleQuestions) {
					const info = this.regexMap[ possibleQuestions[i] ]

					if (!match && info.requiresTemplate) {
						continue
					}

					const exp = str.match(info.regex)
					
					if (exp !== null) {
						command = info.command
						const v = exp.slice(1, exp.length)
						for (var j in v) {
							options[info.tags[j]] = v[j]
						}
						break
					}
				}

				if (command === undefined) {
					return Promise.reject( this.data.metadata.unknownCommandText.replace("<input/>", str) )
				}

			} else {
				let arr = []
				let promise = Promise.resolve()
				
				for (var i in command) {
					const a = i
					
					promise = promise.then(() => {
						const cmd = command[a]
						const tag = this.tagsInAnswer(this.data.responses[cmd[0]].answer)[0]
						let ops = {}
						ops[tag] = cmd[1]
						return this.formatAnswer(cmd[0], ops)
					}).then (ans => arr.push(ans))
				}

				return promise.then (() => {
					if (arr.length === 1) {
						return arr[0]
					} else {
						return arr.map((str, index) => ((index+1) + ". " + str) ).join("\n")
					}
				})
			}
		}
	
		return this.formatAnswer(command, options)
	}
	formatAnswer (commandName, options) {
		//console.log(commandName + ", " + Object.values(options))
		
		const cmd = this.data.responses[commandName]
		let answer = cmd.answer

		if (answer === "function") {
			if (this.customProcessor === undefined || this.customProcessor[commandName] === undefined) {
				console.error("function for command '" + commandName + "' not present in custom parser;!")
				return Promise.reject("this function is unavailable at this time")
			}
			return this.customProcessor[commandName](options)
		} else {

			if (options === {}) {
				if (answer.includes("<")) {
					return Promise.reject(
				 		"Sorry, I can't answer this question.'\n" + 
						"However, I can answer for the following options:\n  " + Object.keys(cmd.options).join("\n  ")
					)
				}
			} else {
				const tag = Object.keys(options)[0]
				const optionKey = options[tag].toLowerCase()

				const gOption = this.optionMap[optionKey]
				const gTmp = gOption ? gOption.find(arr => arr[0] === commandName) : undefined

				answer = answer.replace("<" + tag + ":key>", options[tag])

				if (gOption === undefined || gTmp === undefined) {
					if (answer.includes("<" + tag + ":value>")) {
						return Promise.reject(
				 			"Sorry, I can't answer for '" + optionKey + "'\n" + 
							"However, I can answer for the following options:\n  " + Object.keys(cmd.options).join("\n  ")
						)
					} else if (cmd.onUnknownOption) {
						return this.customProcessor[cmd.onUnknownOption](options)
					}
				} else {
					let optionValue = cmd.options[ gTmp[1] ]
					if (optionValue.value) {
						optionValue = optionValue.value
					}
					
					if (optionValue.includes("function:")) {
						optionValue = optionValue.replace("function:", "")

						if (this.customProcessor === undefined || this.customProcessor[optionValue] === undefined) {
							console.error("function for option value '" + optionValue + "' not present in custom parser;!")
							return Promise.reject("this function is unavailable at this time")
						}

						return this.customProcessor[optionValue](options).then (value => {
							return answer.replace("<" + tag + ":value>", value)
						})
					} else {
						answer = answer.replace("<" + tag + ":value>", optionValue)
					}
				} 
			}
			
		}

		return Promise.resolve(answer)
	}
	tagsInAnswer (ans) {
		let inTag = false
		var tag = ""
		for (var i = 0; i < ans.length;i++) {
			if (ans[i] === "<") {
				inTag = true
			} else if (inTag && ans[i] === ":") {
				inTag = false
				break
			} else if (inTag) {
				tag += ans[i]
			}
		}
		return [tag]
	}

	save () {
		let str = JSON.stringify(this.data, null, "\t")
		this.isSavingFile = true
		fs.writeFile(this.filename, str, function (err) {
  			if (err) {
  				this.isSavingFile = false
  				throw err
  			}
  			console.log('saved data file');
		})
	}

}