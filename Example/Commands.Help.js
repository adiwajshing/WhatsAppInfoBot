/* 
    Example usage of a custom response. We create a help command here.
    We go through all the response data we have & using some metadata help the user in interacting with the bot
*/
module.exports = class HelpCommand {

    constructor (processor) {
        this.processor = processor
        
        this.helpAnswer = ""
        this.userFacingNameMap = {}
        
        this.computeHelpAnswer()
    }
    // called if the commands were modified
    commandsDidModify () {

    }
    /// compute the help answer from our JSON file
    computeHelpAnswer () {
		this.userFacingNameMap = {}

		var ans = [
			"*I can provide information about:*"
        ]
        // go through all commands
		for (var command in this.processor.data.responses) {
            // get the command's metadata
            const meta = this.processor.data.responses[command].meta
            // don't include the help command or commands that don't have the required metadata
			if (command === "help" || meta.description === undefined) {
				continue
            }
            // get the user facing name of the command, essentially the name of the command the user will see
            if (typeof meta.userFacingName == 'object') {
                meta.userFacingName.forEach (name => this.userFacingNameMap[name] = command)
            } else {
                this.userFacingNameMap[meta.userFacingName] = command
            }
            
            // get 2 examples 
			const examples = "'" + meta.examples.slice(0, 2).join("', '") + "'"
            const str = "-" + meta.description + ". Eg: " + examples + "\n" +
                        " type 'help for " + meta.userFacingName[0] + "' for more details"
            // add to our list
			ans.push(str)
        }
        // add a line about communicating with the admins
		ans.push("For suggestions & feedback, WhatsApp: " + this.processor.data.metadata.admins.join(", "))
		this.helpAnswer = ans.join("\n\n")

		console.log("computed help answer")
    }
    // function that is called when somebody calls the help command; return a string promise
	help (options, id) {
        let str
        // if no specific help was asked for
		if (Object.keys(options).length === 0) {
            // give generic answer
			str = this.helpAnswer
		} else {
			const option = options.cmd // which command was help asked for
			const ref = this.userFacingNameMap[option] // get the actual name of the command
			if (ref === undefined) { // if the command does not exist
				return Promise.reject("No help available for '" + option + "' :/")
			}

			const cmd = this.processor.data.responses[ref] // get the command's data
			if (cmd.meta === undefined) { // if it has no metadata
				return Promise.reject("No help available for '" + option + "' :/")
            }
            // create the answer
			let ans = [
				option + " help:",
				"What it does: " + cmd.meta.description,
				"Example usage:",
				"- '" + cmd.meta.examples.join("'\n- '") + "'",
			]
			let cmdOptions = Object.keys(cmd.options) // if it has options,
			if (cmdOptions.length > 0) {
                // mention all the options it can answer for
				ans.push("I can answer for:")
				ans.push(" " + cmdOptions.join("\n "))
            }
            // compile the answer
			str = ans.join("\n")
		}
		// send the answer off
		return Promise.resolve(str)
	}
}