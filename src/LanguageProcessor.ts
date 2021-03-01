import natural from 'natural'
import mustache from 'mustache'
import { chat as cmdLineChat } from './LanguageProcessor.CMDLine'
import { IntentData, LanguageProcessorMetadata } from './types'

export const createLanguageProcessor = (intents: IntentData[], metadata: LanguageProcessorMetadata = {}) => {
	const tokenizer = new natural.RegexpTokenizer ({pattern: /\ /})
	const trie = new natural.Trie(false)
	// add keywords to trie
	intents.forEach(intent => trie.addStrings(intent.keywords))
	
	/**
     * Extract all intents & corresponding entities from a given input text
     * @param input - the input text
     * @returns array of recognized intents and corresponding entities
     */
    const extractIntentsAndOptions = (input: string) => {
		const findEntities = (intent: IntentData, input: string, method: 'includes' | 'equals') => (
			Object.keys(intent.entities).filter(entity => {
				const list = [
					entity,
					//@ts-ignore
					...(intent.entities[entity].alternates || [])
				] as string[]
				if(list.find(item => (
					method === 'includes' ? input.includes(item) : input === item
				))) {
					return entity
				}
			})
		)
        /**
         * Check if the input maps on exactly to some entity
         * For eg. given intents "timings" & "meals" with entities "lunch" and input as "lunch", the function will return {timings: ["lunch"], meals: ["lunch"]} 
         */
        const extractEntities = (input: string, intents: IntentData[], method: 'includes' | 'equals') => (
			intents.map(intent => {
				const entities = findEntities(intent, input, method)
				if(entities.length > 0) {
					return { intent, entities }
				}
			}).filter(Boolean)
		)
        /** Tokenize the given input string & stem the words */
        const stemInput = (input: string) => {
            const words = tokenizer.tokenize(input)
            return words.map(word => natural.PorterStemmer.stem(word))
        }
        /** Extract the possible intents from the stemmed words */
        const getIntents = (stemmed_words: string[]) => {
            const intent_wordcloud = stemmed_words.filter(word => trie.contains(word))
			const wordCloudSet = new Set(intent_wordcloud.flat())
            return intents.filter(({ keywords }) => (
				!!keywords.find(keyword => wordCloudSet.has(keyword))
			))
        }
        // remove all punctuations and unnecessary items
        input = input.toLowerCase().replace(/’|!|'|\?|\./g, '').trim()
		// first, do a simple extract
        let extractedIntents = extractEntities(input, intents, 'equals') 
        if (extractedIntents.length == 0) { // if nothing was picked up
            const stemmedWords = stemInput(input)
            const intents = getIntents(stemmedWords)
            extractedIntents = intents.map(intent => ({ 
				intent, 
				entities: findEntities(intent, input, 'includes') 
			})).filter(Boolean)
        }
		
        return extractedIntents
    }
    const computeOutput = async(data: IntentData, entities: string[], user: string) => {    
		let answer: string | string[]
        if (typeof data.answer === 'function') { // if the intent requires a function to answer
            answer = await data.answer(entities, user)
		} else if(Object.keys(entities).length === 0) {
            if (data.answer.includes("{{")) { // if the answer requires an entity to answer but no entities were parsed
                throw new Error(
					metadata.entityRequiredText(Object.keys(data.entities))
				)
            }
            answer = data.answer
        } else {
            answer = await Promise.all(
				entities.map (key => {
					// account for the fact that the 'value' may be a property
					const entityObj = data.entities[key]
					const value = typeof entityObj === 'object' ? entityObj.value : entityObj
					
					if(typeof value === 'function') return value(entities, user)
					else {
						const mustacheParams = { entity: { key, value } }
						if(typeof data.answer !== 'string') {
							throw new Error(mustache.render(metadata.expectedStringAnswerText, mustacheParams))
						}
						return mustache.render(data.answer, mustacheParams)
					}
				})
			)
		}
		return answer
    }
	/**
     * Get the response for a given input string
     * @param user - ID of the user who is requesting the output
     * @returns the response
     */
    const output = async (input: string, user: string) => {
        const compileAnswer = (strings: string[]) => (
			strings.length===1 ? 
			strings[0] : 
			strings.map ((str, i) => `*${i+1}.* ${str}`).join ("\n")
		)

        let extractedIntents = extractIntentsAndOptions(input)
        const intentCount = extractedIntents.length
        if (extractedIntents.length > 1) { // if more than one intent was recognized & a greeting was detected too
            extractedIntents = extractedIntents.filter(intent => !intent.intent.isGreeting)
        } if (intentCount == 0) {
            throw new Error( 
				mustache.render(metadata.parsingFailedText, { input })
            )
        }
        // compute the output for each intent & map the errors as text
        const tasks = extractedIntents.map(({ intent, entities }) => (
			computeOutput(intent, entities, user)
		))
        const outputs = await Promise.allSettled(tasks)
        const correctOutputs = outputs.filter(output => output.status === 'fulfilled')

        if (correctOutputs.length > 0) {
            const strings = correctOutputs.map(output => (output as PromiseFulfilledResult<string>).value).flat()
            return compileAnswer(strings)
        } else {
            const strings = outputs.map(output => (
				//@ts-ignore
				output.value || output.reason
			)).flat()
            throw new Error( compileAnswer(strings) )
        }
    }
	const chat = () => cmdLineChat(ip => output(ip, 'test'))

	if(!metadata.entityRequiredText) {
		metadata.entityRequiredText = availableEntities => (
			"Sorry, I can't answer this specific query.\n" + 
			"However, I can answer for the following options:\n  " + availableEntities.join("\n  ")
		)
	}
	if(!metadata.expectedStringAnswerText) {
		metadata.expectedStringAnswerText = 'Expected a string for {{entity.key}}'
	}
	if(!metadata.parsingFailedText) {
		metadata.parsingFailedText = 'Unknown command: {{input}}'
	}
	if(process.argv.includes('--chat')) {
		chat()
	}
	return {
		output,
		chat
	}
}