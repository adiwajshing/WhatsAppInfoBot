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
        
        let helpEntities = {}
		var ans = ["*I can provide information about:*"]
        // go through all commands
		for (var intent in this.processor.data.intents) {
            // get the command's metadata
            const meta = this.processor.data.intents[intent].meta
            // don't include the help command or commands that don't have the required metadata
			if (intent === "help" || !meta || !meta.description) {
				continue
            }
            // get the user facing name of the command, essentially the name of the command the user will see
            if (Array.isArray(meta.userFacingName)) {
                helpEntities[meta.userFacingName[0]] = {alternates: meta.userFacingName.slice (1), value: intent}
                meta.userFacingName.forEach (name => this.userFacingNameMap[name] = intent)
            } else {
                helpEntities[meta.userFacingName] = intent
                this.userFacingNameMap[meta.userFacingName] = intent
            }
            
            // get 2 examples 
			const examples = "'" + meta.examples.slice(0, 2).join("', '") + "'"
            const str = "-" + meta.description + ". Eg: " + examples + "\n" +
                        " type 'help for " + meta.userFacingName[0] + "' for more details"
            // add to our list
			ans.push(str)
        }
        // add a line about communicating with the admins
		ans.push("For suggestions & feedback, WhatsApp: " + this.processor.data.meta.admins.join(", "))
        this.helpAnswer = ans.join("\n\n")
        this.processor.updateEntities ("help", helpEntities)

		console.log("computed help answer")
    }
    /**
     * Function that is called when somebody calls the help command
     * @param {string[]} entities 
     * @param {string} user 
     */
	help (entities, user) {
        // if no specific help was asked for
		if (Object.keys(entities).length === 0) {
            // give generic answer
			return this.helpAnswer
		} else {
            return entities.map (str => {
                const entity = this.userFacingNameMap[str]
                const data = this.processor.data.intents[entity]
                // get the actual name of the command
                if (!data) { // if the command does not exist
                    throw "No help available for '" + option + "' :/"
                }
                // create the answer
                let ans = [
                    entity + " help:",
                    "What it does: " + data.meta.description,
                    "Example usage:",
                    "- '" + data.meta.examples.join("'\n- '") + "'",
                ]
                let entities = Object.keys(data.entities) // if it has options,
                if (entities.length > 0) {
                    // mention all the options it can answer for
                    ans.push("I can answer for:")
                    ans.push(" " + entities.join("\n "))
                }
                // compile the answer
                return ans.join("\n")
            })            
		}
	}
}