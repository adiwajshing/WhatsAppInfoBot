import { IntentData, IntentEntities } from '../../types'

export default (intents: IntentData[]) => {
    const entities: IntentEntities = {}
    const meta = {}

    let helpAnswer = ''
    /// compute the help answer from our JSON file
    const computeHelpAnswer = () => {        
		let ans = ['*I can provide information about:*']
        // go through all commands
		for (const {meta} of intents) {
            // don't include the help command or commands that don't have the required metadata
			if (!meta || !meta.description || !meta.userFacingName) {
				continue
            }
            // get the user facing name of the command, essentially the name of the command the user will see
            if (Array.isArray(meta.userFacingName)) {
                entities[meta.userFacingName[0]] = {
                    alternates: meta.userFacingName.slice(1), 
                    value: meta.userFacingName[0]
                }
            } else {
                entities[meta.userFacingName] = meta.userFacingName
            }
            
            // get 2 examples 
			const examples = "'" + meta.examples.slice(0, 2).join("', '") + "'"
            const str = "-" + meta.description + ". Eg: " + examples + "\n" +
                        " type 'help for " + meta.userFacingName[0] + "' for more details"
            // add to our list
			ans.push(str)
        }
        // add a line about communicating with the admins
		//ans.push("For suggestions & feedback, WhatsApp: " + this.processor.metadata.admins.join(", "))
        helpAnswer = ans.join("\n\n")
		console.log("computed help answer")
    }
    computeHelpAnswer()
    return {
        keywords: ['help', 'assist'],
        entities,
        answer: (entities: string[]) => {
            // if no specific help was asked for
            if (Object.keys(entities).length === 0) {
                // give generic answer
                return helpAnswer
            } else {
                return entities.map (str => {
                    const data = intents.find(({ meta }) => meta?.userFacingName && meta.userFacingName[0] === str)
                    // get the actual name of the command
                    if (!data) { // if the command does not exist
                        throw "No help available for '" + str + "' :/"
                    }
                    // create the answer
                    let ans = [
                        str + " help:",
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
        },
        meta
    } as IntentData
}