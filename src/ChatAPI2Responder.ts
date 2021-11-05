import type { makeAccessTokenFactory, Scope, JWT } from "@chatdaddy/service-auth-client"
import type { Message, MessageAttachment, MessageCompose } from "@chatdaddy/service-im-client"
import type { APIGatewayProxyEvent } from "aws-lambda"
import { Answer, LanguageProcessor, WAResponderParameters, FileAnswer } from "./types"

// serverless function for interacting with ChatAPI2 APIs

export type ChatApi2ResponderParameters = WAResponderParameters & {
	refreshToken: string
	apiUrl: string
}

type ChatAPISendMessageOptions = {
	id: string
	accountId: string
	
	teamId: string

	answer: Answer
	quotedId?: string
}

const authClient = require('@chatdaddy/service-auth-client')
export const createChatAPI2Responder = (
	processor: LanguageProcessor, 
	metadata: ChatApi2ResponderParameters
) => {
	if(!authClient) {
		throw new Error('Could not find @chatdaddy/service-auth-client')
	}
	const factory = authClient.makeAccessTokenFactory as typeof makeAccessTokenFactory
	const Scopes = authClient.Scope as typeof Scope
	const getToken = factory({
		request: {
			refreshToken: metadata.refreshToken,
			scopes: [Scopes.MessagesSendToAll, Scopes.ChatsAccessAll]
		},
	})

	const sendWAMessage = async({ id, accountId, answer, quotedId, teamId }: ChatAPISendMessageOptions) => {
		const { MessagesApi, Configuration, MessageComposeStatusEnum } = await import('@chatdaddy/service-im-client')
		const messagesApi = new MessagesApi(new Configuration({ 
			basePath: metadata.apiUrl, 
			accessToken: () => getToken(teamId).then(t => t.token) 
		}))

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
			status: MessageComposeStatusEnum.Pending,
		}

		if(typeof answer === 'object' && 'template' in answer) {
			throw new Error('template not supported')
		} else if(typeof answer === 'string') {
			composeOpts.text = answer
		} else {
			const attachments: MessageAttachment[] = []
			composeOpts.text = answer.text || ''
			for(const key of ['image', 'video', 'audio', 'document', 'contacts'] as const) {
				const item = answer[key] as FileAnswer
				if(item) {
					attachments.push({
						//@ts-expect-error
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

		await messagesApi.messagesPost(accountId, id, composeOpts)
	}

	return async (event: APIGatewayProxyEvent) => {
		const authToken = event.headers['Authorization']?.replace('Bearer ', '')
		const { user }: JWT = await authClient.verifyToken(authToken)
		
		console.log('received web-hook for ' + user.teamId)

		const body = JSON.parse(event.body)

		console.log('event is ', body.event)

		switch(body.event) {
			case 'message-insert':
				const msgs = body.data as Message[]
				for(const msg of msgs) {
					if(!msg.fromMe) {
						console.log(`recv message on ${msg.accountId}/${msg.id} from "${msg.senderContactId}" -- "${msg.text?.slice(0, 150)}""`)
						const text = msg.text

						let responses: Answer[]
						try {
							responses = await processor.output(text, { messageId: msg.id, userId: msg.senderContactId })
						} catch (err: any) {
							// do not respond if its a group
							if (msg.chatId.includes("@g.us")) continue
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
									teamId: user.teamId,
									answer: response,
									quotedId: msg.id
								})
							}
						}
					}
				}
			break
		}

		return { statusCode: 204 }
	}
}