import { randomBytes } from 'crypto'
import {createInterface} from 'readline'
import { LanguageProcessor } from './types'

export const chat = ({output}: LanguageProcessor) => {
	console.log("type 'q' to exit;")
	const readline = createInterface({input: process.stdin, output: process.stdout})

	const getInput = () => {
		readline.question("\ntype: ", async (ques: string) => {
			if (ques === "q") {
				readline.close()
				process.exit(0)
			} else {
				try {
					const ctx = { 
						userId: 'test', 
						messageId: randomBytes(8).toString('hex') 
					}
					const response = await output(ques, ctx)
					console.log("response:\n", response) 
				} catch(error) {
					console.log(`fallback:\n${error.message}\ntrace: ${error.stack}`) 
				} finally {
					getInput()
				}
			}
		})	
	}
	getInput()
}