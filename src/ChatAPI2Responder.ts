import type { makeAccessTokenFactory, Message, MessageAttachment, MessageCompose, Configuration } from "@chatdaddy/client"
import type { APIGatewayProxyEvent } from "aws-lambda"
import { Answer, LanguageProcessor, WAResponderParameters, FileAnswer } from "./types"

// serverless function for interacting with ChatAPI2 APIs

export type ChatApi2ResponderParameters = WAResponderParameters & {
	refreshToken: string
}

type ChatAPISendMessageOptions = {
	id: string
	accountId: string
	
	teamId: string

	answer: Answer
	quotedId?: string
}

const DEFAULT_CHATS_FETCH_SIZE = 75

const ATTACH_TYPES = ['image', 'video', 'audio', 'document', 'contact'] as const

export const createChatAPI2Responder = (
	processor: LanguageProcessor, 
	metadata: ChatApi2ResponderParameters
) => {
	let getToken: ReturnType<typeof makeAccessTokenFactory>

	return {
		handler: async (event: APIGatewayProxyEvent) => {
			const { verifyToken } = await import('@chatdaddy/client')
			
			const authToken = event.headers['Authorization']?.replace('Bearer ', '')
			const { user } = await verifyToken(authToken)
			
			console.log('received web-hook for ' + user.teamId)
	
			const body = JSON.parse(event.body)
	
			console.log('event is ', body.event)
	
			switch(body.event) {
				case 'message-insert':
					const msgs = body.data as Message[]
					for(const msg of msgs) {
						await respondToMessage(msg, user.teamId)
					}
				break
			}
	
			return { statusCode: 204 }
		},
		respondToUnrespondedChats
	}

	async function sendWAMessage({ id, accountId, answer, quotedId, teamId }: ChatAPISendMessageOptions) {
		const { MessagesApi } = await import('@chatdaddy/client')
		const messagesApi = new MessagesApi(await getConfiguration(teamId))

		const composeOpts: MessageCompose = {
			text: '',
			miscOptions: {
				withTyping: true,
				randomizeMessage: false
			},
			quoted: {
				id: quotedId,
				chatId: id
			},
		}

		if(typeof answer === 'object' && 'template' in answer) {
			throw new Error('template not supported')
		} else if(typeof answer === 'string') {
			composeOpts.text = answer
		} else {
			const attachments: MessageAttachment[] = []
			composeOpts.text = answer.text || ''
			for(const key of ATTACH_TYPES) {
				const item = answer[key] as FileAnswer
				if(item) {
					attachments.push({
						type: key,
						url: item.url,
						mimetype: item.mimetype,
						filename: item.name
					})
				}
			}
			if(attachments.length) {
				 composeOpts.attachments = attachments
			}
		}

		await messagesApi.messagesPost({
			accountId,
			chatId: id,
			messageCompose: composeOpts,
		})
	}

	async function respondToMessage(msg: Message, teamId: string) {
		if(!msg.fromMe && !msg.action) {
			console.log(`recv message on ${msg.accountId}/${msg.id} from "${msg.senderContactId}" -- "${msg.text?.slice(0, 150)}""`)
			const text = msg.text

			let responses: Answer[]
			try {
				responses = await processor.output(text, { messageId: msg.id, userId: msg.senderContactId })
			} catch (err: any) {
				// do not respond if its a group
				if (msg.chatId.includes("@g.us")) return
				responses = [
					(err.message || err).replace('Error: ', '')
				]
			}
			if (responses) {
				for(const response of responses) {
					console.log({
						message: 'replying',
						reply: response,
					})
					await sendWAMessage({
						id: msg.chatId,
						accountId: msg.accountId,
						teamId: teamId,
						answer: response,
						quotedId: msg.id
					})
				}
			}
		}
	}

	async function respondToUnrespondedChats(teamId: string) {
		const { ChatsApi } = await import('@chatdaddy/client')
		const chatsApi = new ChatsApi(await getConfiguration(teamId))

		const { data: { chats } } = await chatsApi.chatsGet(
			{
				count: DEFAULT_CHATS_FETCH_SIZE,
				lastMessageFromMe: false,
			}
		)
		console.log(`got ${chats.length} chats`)

		for(const chat of chats) {
			const msg = chat.messages?.[0]
			if(msg) {
				try {
					await respondToMessage(msg, teamId)
				} catch(error) {
					console.error(`error in responding to (${msg.chatId}, ${msg.id}): ${error}`)
				}
			}
		}

		console.log(`responded to ${chats.length} chats`)
	}

	async function getConfiguration(teamId: string): Promise<Configuration> {
		if(!getToken) {
			const { makeAccessTokenFactory } = await import('@chatdaddy/client')

			getToken = makeAccessTokenFactory({
				request: {
					refreshToken: metadata.refreshToken,
					scopes: [
						'MESSAGES_SEND_TO_ALL',
						'CHATS_ACCESS_ALL',
					]
				},
			})
		}

		return {
			accessToken: () => getToken(teamId).then(t => t.token),
			isJsonMime() {
				return true
			}
		}
	}
}