import {createInterface} from 'readline'

export const chat = (output: (input: string) => Promise<string> | string) => {
	console.log("type 'q' to exit;")
	const readline = createInterface({input: process.stdin, output: process.stdout})

	const getInput = () => {
		readline.question("\ntype: ", async (ques: string) => {
			if (ques === "q") {
				readline.close()
				process.exit(0)
			} else {
				try {
					const str = await output(ques)
					console.log("response:\n" + str) 
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