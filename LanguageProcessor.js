const fs = require('fs')
const natural = require('natural')
/**
 * @typedef {Object} IntentData
 * @property {string[]} keywords - The keywords required to recognize an intent
 * @property {Object.<string, object>} entities - The entities in this intent
 * @property {string} answer - What to respond with when a user fires this intent (include <entity:key> & <entity:value> for entities)
 * @property {Object.<string, string>} meta - Dictionary to store some metadata
 */
/**
 * @typedef {Object} Data
 * @property {object} meta - some metadata for this file
 * @property {string} meta.parsingFailedText - text to respond with, when intents could not be recognized
 * @property {number} [meta.maxRequestsPerSecond] - max WhatsApp requests a user can make in a second
 * @property {string} [meta.whatsAppCredsFile] - file to store authentication credentials of WhatsApp Web
 * @property {string} [meta.customProcessor] - file path to class for custom responding to intents
 * @property {Object.<string, IntentData>} intents - actual intents in the data
 */
class LanguageProcessor {
    /**
     * Construct a new instance of a LanguageProcessor
     * @param {string} filename - filename of the data file
     */
    constructor(filename) {
        this.filename = filename
        /** @type {Data} */
		this.data = { }
		this.customProcessor = null
        this.tokenizer = new natural.RegexpTokenizer ({pattern: /\ /})
        this.chat = require ("./LanguageProcessor.CMDLine").chat

		this.loadData()
    }
    /** Load data from the file */
    loadData () {
        this.data = JSON.parse( fs.readFileSync(this.filename) )
        console.log("read from file " + this.filename)
        
        this.parseIntents(this.data.intents)

        if (this.customProcessor) {
            delete this.customProcessor	
        }
        const customProcessorFile = this.data.meta.customProcessor
        if (customProcessorFile && customProcessorFile !== "") {
            const LanguageProcessorExt = require(customProcessorFile)
            this.customProcessor = new LanguageProcessorExt(this)
            console.log("loaded custom processor from file: " + customProcessorFile)
        }
    }
    /**
     * 
     * @param {IntentData[]} intents 
     */
    parseIntents (intents) {
        this.trie = new natural.Trie(false)
        this.entityMap = {}

        for (var intent in intents) {
            const data = intents[intent]
            
            this.trie.addStrings (data.keywords)
            this.updateEntities (intent, data.entities)
        }
    }
    /**
     * Update the entities for a given intent
     * @param {string} intent 
     * @param {string[]} entities 
     */
    updateEntities (intent, entities) {
        this.entityMap [intent] = {}
        for (var entity in entities) {
            const allEntities = [entity].concat( entities[entity].alternates || [] )
            allEntities.forEach(alt => this.entityMap[intent][alt] = entity)
        }
    }
    /**
     * Extract all intents & corresponding entities from a given input text
     * @param {string} input - the input text
     * @returns {Object.<string, string[]>} object mapping intent to array of recognized entities for given intent eg. {timings: ["lunch", "dinner"], greeting: []}
     */
    extractIntentsAndOptions (input) {
        /**
         * Check if the input maps on exactly to some entity
         * For eg. given intents "timings" & "meals" with entities "lunch" and input as "lunch", the function will return {timings: ["lunch"], meals: ["lunch"]} 
         * @param {string} input 
         * @return {{string:string[]}} object mapping intent to recognized entities for given intent
         */
        const simpleExtract = input => {
            let recognizedIntents = {}
            for (var intent in this.entityMap) { // loop over all intents
                const thisEntities = this.entityMap[intent] // all entities present in this intent 
                const entities = Object.keys(thisEntities).filter (opt => input === opt).map (opt => thisEntities[opt]) // add if input matches the entity
                entities.length > 0 && (recognizedIntents [intent] = entities) // add to recognized intents if some entity was picked up
            }
            return recognizedIntents
        }
        /**
         * Tokenize the given input string & stem the words
         * @param {string} input 
         * @returns {string[]} array of tokenized & stemmed words
         */
        const stemInput = input => {
            const words = this.tokenizer.tokenize(input)
            return Object.keys(words).map (word => natural.PorterStemmer.stem(words[word]))
        }
        /**
         * Extract the possible intents from the stemmed words
         * @param {string[]} stemmed_words - the stemmed word array
         * @returns {string[]} array of intents recognized
         */
        const getIntents = stemmed_words => {
            const intent_wordcloud = stemmed_words.filter (word => this.trie.contains(word))
            const intents = this.data.intents
            return intent_wordcloud.flatMap (word => Object.keys(intents).filter (intent => intents[intent].keywords.includes (word)))
        }
        /**
         * Extract the entities for each corresponding intent
         * @param {string} input 
         * @returns {string[]} array of intents recognized
         */
        const extractEntities = (input, intents) => 
            Object.keys(intents).map (intent => {
                const entities = this.entityMap[intent] // all entities in the intent
                intents[intent] = Object.keys (entities).filter (opt => input.includes (opt)).map (opt => entities[opt])
            })

        // remove all punctuations and unnecessary items
        input = input.replace(/!|'|\?|\./g,"") 

        var intents = simpleExtract (input) // first, do a simple extract
        if (Object.keys(intents).length == 0) { // if nothing was picked up
            const stemmed_words = stemInput(input)
            getIntents (stemmed_words).forEach (intent => intents[intent] = {})
            extractEntities (input, intents)
        }
        return intents
    }
    /**
     * Get the response for a given input string
     * @param {string} input
     * @param {string} user - the user who is requesting the output
     * @returns {string} - the response
     */
    async output (input, user) {
        const compileAnswer = strings => strings.length===1 ? strings[0] : strings.map ((str, i) => "*"+(i+1)+".* " + str).join ("\n")

        var intents = this.extractIntentsAndOptions (input)
        const intentCount = Object.keys(intents).length
        if (intentCount > 1 && intents.greeting) { // if more than one intent was recognized & a greeting was detected too
            delete intents.greeting // remove the greeting intent
        } if (intentCount == 0) {
            throw this.data.meta.parsingFailedText.replace ("<input>", input)
        }
        console.log ("intents: " + JSON.stringify(intents))
        // compute the output for each intent & map the errors as text
        const tasks = Object.keys(intents).map (intent => this.computeOutput (intent, intents[intent], user))
        
        const outputs = await Promise.allSettled (tasks)
        const correctOutputs = outputs.filter (output => output.status==="fulfilled")

        if (correctOutputs.length > 0) {
            const strings = correctOutputs.map (output => output.value).flat ()
            return compileAnswer (strings)
        } else {
            const strings = outputs.map (output => output.value || output.reason).flat ()
            throw compileAnswer (strings)
        }
    }
    /**
     * 
     * @param {string} intent 
     * @param {string[]} entities 
     * @returns {string[]} - array of answers
     */
    async computeOutput (intent, entities, user) {
        const data = this.data.intents[intent] // data for the intent
        
		if (data.answer === "function") { // if the intent requires a function to answer
			return this.forwardOutput (intent, entities, user)
		} else if (Object.keys(entities).length === 0) {
            if (data.answer.includes("<")) { // if the answer requires an entity to answer but no entities were parsed
                throw "Sorry, I can't answer this specific query.'\n" + 
                      "However, I can answer for the following options:\n  " + Object.keys(data.entities).join("\n  ")
            } else {
                return data.answer
            }
        } else {
            const answers = entities.map (entity => {
                var answer = data.answer
                answer = answer.replace("<entity:key>", entity)
                // account for the fact that the value may be a property
                let value = data.entities [entity].value || data.entities [entity]

                if (value.includes("function:")) {
                    value = value.replace("function:", "")
                    return this.forwardOutput (value, entities, user)
                } else {
                    answer = Promise.resolve( answer.replace("<entity:value>", value) )
                }
                return answer
            })
            return Promise.all (answers)
		}
    }
    async forwardOutput (func, entities, user) {
        if (!this.customProcessor || !this.customProcessor[func]) {
            console.error("function for command '" + func + "' not present in custom parser")
            throw "This function is unavailable at this time"
        }
        return await this.customProcessor[func](entities, user)
    }
}

module.exports = LanguageProcessor

//const processor = new LanguageProcessor ("new_test_data.json")
//processor.output ("yo bro when can i get lunch").then (output => console.log (output))

