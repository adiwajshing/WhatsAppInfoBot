import type { WAMessage } from "@adiwajshing/baileys"
import type { makeAccessTokenFactory, Scope, JWT } from "@chatdaddy/service-auth-client"
import type { APIGatewayProxyEvent } from "aws-lambda"
import got from "got"
import { URL } from "url"
import { Answer, LanguageProcessor, WAResponderParameters } from "./types"
import { onWAMessage } from "./WAResponder"

// serverless function for interacting with SendMammy APIs

export const SENDMAMMY_URL = new URL(process.env.SENDMAMMY_URL || 'https://api.sendmammy.com')

export type SendMammyResponderParameters = WAResponderParameters & {
	refreshToken: string
}
export type SendMessageOptions = {
	jid: string 
	answer: Answer
	quotedId?: string
	token: string
}

export const sendWAMessage = async({ jid, answer, quotedId, token }: SendMessageOptions) => {
	const timestamp = Math.floor(Date.now()/1000)
	
	let path = `messages/${jid}`
	let body: any = {}
	if(typeof answer === 'object' && 'template' in answer) {
		path = `${path}/${answer.template}`
		body = { parameters: answer.parameters }
	} else if(typeof answer === 'string') {
		body = { text: answer }
	} else {
		body = answer
	}

	const result = await got.post(
		new URL(path, SENDMAMMY_URL),
		{
			body: JSON.stringify({
				...body,
				scheduleAt: timestamp, // send message now
				quotedID: quotedId, // quote the message
				withTyping: true, // send with typing indicator
				randomizeMessage: false,
				tag: Date.now().toString() + Math.floor(Math.random()*100).toString() // ensures the message is only sent out once 
			}),
			headers: {
				'authorization': `Bearer ${token}`,
				'content-type': 'application/json'
			},
			retry: {
				limit: 10,
				statusCodes: [504, 503, 502, 408],
				errorCodes: [ 'ENOTFOUND', 'ETIMEDOUT' ],
				calculateDelay: () => 250
			},
			throwHttpErrors: false
		}
	)
	if(![200].includes(result.statusCode)) {
		throw new Error(`error in pushing message: (${result.statusCode}) ${result.body}`)
	}
}

const authClient = require('@chatdaddy/service-auth-client')
export const createSendMammyResponder = (
	processor: LanguageProcessor, 
	metadata: SendMammyResponderParameters
) => {
	if(!authClient) {
		throw new Error('Could not find @chatdaddy/service-auth-client')
	}
	const factory = authClient.makeAccessTokenFactory as typeof makeAccessTokenFactory
	const Scopes = authClient.Scope as typeof Scope
	const getToken = factory({
		request: {
			refreshToken: metadata.refreshToken,
			scopes: [Scopes.MessagesSendToAll]
		},
	})

	return async (event: APIGatewayProxyEvent) => {
		const authToken = event.headers['Authorization']?.replace('Bearer ', '')
		const { user }: JWT = await authClient.verifyToken(authToken)

		const sendMessage = async(jid: string, answer: Answer, quoted?: WAMessage) => {
			const { token } = await getToken(user.teamId)
			const result = await sendWAMessage({ jid, answer, quotedId: quoted?.key.id, token })
			return result
		}
		
		console.log('received web-hook for ' + user.teamId)

		const body = JSON.parse(event.body)

		console.log('event is ', body.event)

		if((body.event === 'chat-update' && body.data.hasNewMessage) ||
			body.event === 'messages-post-sleep') {
			await Promise.all(
				body.data.messages.map((message: WAMessage) => (
					onWAMessage(message, { metadata, processor, sendMessage })
				))
			)
			return {
				statusCode: 200,
				body: JSON.stringify({ success: true })
			}
		} else if(body.event === 'initial-data-received') {
			const token = await authClient.getToken(user.teamId)
			// get all unread chats
			const result = await got.get(
				new URL(`chats?unread=true`, SENDMAMMY_URL),
				{
					headers: {
						'authorization': `Bearer ${token}`,
					}
				}
			)
			const { chats }: { chats: any[] } = JSON.parse(result.body)
			const messages: WAMessage[] = []
			for(const chat of chats) {
				let count = Math.max(chat.count, 1)
				while(!!chat.messages.length && !!count) {
					const last = chat.messages[chat.messages.length-1] as WAMessage
					if(!last.key.fromMe) {
						messages.push(last)
					}
					count -= 1
					chat.messages = chat.messages.slice(0, -1)
					if(!count) break
				}
			}
			await Promise.all(
				messages.map(message => (
					onWAMessage(message, { metadata, processor, sendMessage })
				))
			)
			return {
				statusCode: 200,
				body: JSON.stringify({ success: true })
			}
		}
		return { statusCode: 204 }
	}
}