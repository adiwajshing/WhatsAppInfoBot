export type InputContext = {
	/** the id of the user */
	userId: string
	/** id of the message sent */
	messageId: string
	/** info about the message that was quoted (if any) */
	quotedMessage?: {
		id: string
		remoteJid: string
	} 
}
export type FileAnswer = { url: string, name?: string, mimetype?: string }
export type Answer = string | { 
	text?: string
	image?: FileAnswer
	video?: FileAnswer
	audio?: FileAnswer
	document?: FileAnswer & { name: string, mimetype: string }
	contacts?: { displayName: string, phoneNumber: string }[]
} | { 
	template: string, 
	parameters: { [_: string]: any } 
}

export type IntentAnswer = Answer | ((entities: string[], ctx: InputContext) => Promise<Answer> | Answer)
export type IntentEntities = {
	[_: string]: IntentAnswer | { alternates?: string[], value: IntentAnswer }
}
export type IntentData = ({
	/** The keywords required to recognize an intent */
	keywords: string[]
} | {
	/** regular expressions to detect the intent */
	regexps: (RegExp | string)[]
}) & {
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
	expectedStringAnswerText?: string
	entityRequiredText?: (availableEntities: string[]) => string
}
export type LanguageProcessor = {
	output: (input: string, ctx: InputContext) => Promise<Answer[]>
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