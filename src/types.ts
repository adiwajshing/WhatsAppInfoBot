export type IntentAnswer = string | ((entities: string[], user: string) => Promise<string> | string)
export type IntentEntities = {
	[_: string]: IntentAnswer | { alternates?: string[], value: IntentAnswer }
}
export type IntentData = {
	/** The keywords required to recognize an intent */
	keywords: string[]
	/** The entities in this intent mapped to their respective answers */
	entities: IntentEntities
	answer: IntentAnswer
	/** Some metadata about the command */
	meta?: { 
		description?: string
		userFacingName?: string | string[]
		examples?: string[]
	}
	/** 
	 * is this a greeting intent?
	 * If this is picked up alongside another intent -- it is ignored
	 */
	isGreeting?: boolean
}
export type LanguageProcessorMetadata = {
	parsingFailedText?: string
	entityRequiredText?: (availableEntities: string[]) => string
}
export type LanguageProcessor = {
	output: (input: string, user: string) => Promise<string>
}
export type Responser = {
	start: () => void | Promise<void>
	close: () => void | Promise<void>
}
export type CreateResponder<T> = (processor: LanguageProcessor, args: T) => Responser

export type WAResponderParameters = {
	/** send a sorry for delay message 
	 * if message is responded to X seconds after being received */
	minimumDelayTriggerS?: number
	/** the content of the sorry for delay message */
	delayMessage?: string
	/** should the app respond to pending messages on a reconnect */
	respondToPendingMessages?: boolean
}