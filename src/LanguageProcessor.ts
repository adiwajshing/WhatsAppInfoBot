import natural from 'natural'
import { chat as cmdLineChat } from './CMDLineChat'
import { Answer, InputContext, IntentData, LanguageProcessorMetadata } from './types'
import { parseTemplate } from './utils'

const OBJECT_KEYS = new Set([ 'template', 'image', 'video', 'audio', 'document' ])

export const createLanguageProcessor = (intents: IntentData[], metadata: LanguageProcessorMetadata = {}) => {
	const tokenizer = new natural.RegexpTokenizer ({pattern: /\ /})
	const trie = new natural.Trie(false)
	// add keywords to trie
	intents.forEach(intent => {
		if('keywords' in intent) {
			trie.addStrings(intent.keywords)
		}
	})
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
         * For eg. if method=='equals' -- given intents "timings" & "meals" with entities "lunch" and input as "lunch", the function will return {timings: ["lunch"], meals: ["lunch"]} 
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
        /** Extract the possible keyword-based intents from the stemmed words */
		const getPossibleIntents = (input: string) => {
			const stemmedWords = stemInput(input)
			const wordCloudSet = new Set(
				stemmedWords.filter(word => trie.contains(word)).flat()
			)
			return intents.map(intent => {
				let entities: string[]
				if('keywords' in intent) {
					if(!!intent.keywords.find(keyword => wordCloudSet.has(keyword))) {
						entities = findEntities(intent, input, 'includes') 
					}
				} else {
					for(const regexp of intent.regexps) {
						const result = new RegExp(regexp, 'gi').exec(input)
						if(!result) continue

						entities = []
						let i = 1
						while(typeof result[i] !== 'undefined') {
							entities.push(result[i])
							i += 1
						}
					}
				}
				if(entities) {
					return {
						intent,
						entities
					}
				}
			})
			.filter(Boolean)
		}
        // remove all punctuations and unnecessary items
        input = input.toLowerCase().replace(/’|!|'|\?|\./g, '').trim()
		// first, do a simple extract
        let extractedIntents = extractEntities(input, intents, 'equals')
        if (extractedIntents.length == 0) { // if nothing was picked up
            extractedIntents = getPossibleIntents(input)
        }
        return extractedIntents
    }
    const computeOutput = async(data: IntentData, entities: string[], ctx: InputContext) => {    
		let answer: Answer | Answer[]
        if (typeof data.answer === 'function') { // if the intent requires a function to answer
            answer = await data.answer(entities, ctx)
		} else if(entities.length === 0) {
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
					
					if(typeof value === 'function') return value(entities, ctx)
					else {
						const mustacheParams = { entity: { key, value } }
						if(typeof data.answer !== 'string') {
							throw new Error(parseTemplate(metadata.expectedStringAnswerText, mustacheParams))
						}
						return parseTemplate(data.answer, mustacheParams)
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
    const output = async (input: string, ctx: InputContext) => {
        const compileAnswer = (strings: (string | { text: string })[]) => (
			strings.length===1 ? 
			//@ts-ignore
			(strings[0].text || strings[0]) : 
			//@ts-ignore
			strings.map ((str, i) => `*${i+1}.* ${str.text || str}`).join("\n")
		) as string

        let extractedIntents = extractIntentsAndOptions(input)
        if (extractedIntents.length > 1) { // if more than one intent was recognized & a greeting was detected too
            extractedIntents = extractedIntents.filter(intent => !intent.intent.isGreeting)
        } if (extractedIntents.length === 0) {
            throw new Error( 
				parseTemplate(metadata.parsingFailedText, { input })
            )
        }
        // compute the output for each intent & map the errors as text
        const tasks = extractedIntents.map(({ intent, entities }) => (
			computeOutput(intent, entities, ctx)
		))
        const outputs = await Promise.allSettled(tasks)
        const correctOutputs = outputs.map(output => (
			output.status === 'fulfilled' && output.value
		)).filter(Boolean).flat()
		const errorOutputs = outputs.map(output => (
			output.status === 'rejected' && (output.reason?.message || output.reason) as string
		)).filter(Boolean).flat()

        if (!!correctOutputs.length) {
			// check if all answers are strings
			const allStrings = !correctOutputs.find(item => (
				typeof item === 'object' && 
				!!Object.keys(item).filter(k => OBJECT_KEYS.has(k)).length
			))
			if(allStrings) {
				return [
					compileAnswer(correctOutputs as { text: string }[])
				]
			}
            return correctOutputs
        } else {
            throw new Error(compileAnswer(errorOutputs))
        }
    }
	const chat = () => cmdLineChat({ output })

	if(!metadata.entityRequiredText) {
		metadata.entityRequiredText = availableEntities => (
			"Sorry, I can't answer this specific query.\n" + 
			"However, I can answer for the following options:\n  " + availableEntities?.join("\n  ")
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