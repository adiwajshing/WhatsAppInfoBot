import type { WAMessage } from "@adiwajshing/baileys"
import type { AuthenticationController } from "@chatdaddy/authentication-utils"
import { LanguageProcessor, WAResponderParameters } from "./types"
import { onWAMessage } from "./WAResponder"
import got from "got"

// serverless function for interacting with SendMammy APIs

export type SendMammyResponderParameters = WAResponderParameters & {
	refreshToken: string
}

const { makeAuthenticationController } = require('@chatdaddy/authentication-utils') || {}
export const createSendMammyResponder = (processor: LanguageProcessor, metadata: SendMammyResponderParameters) => {
	if(!makeAuthenticationController) {
		throw new Error('Could not find @chatdaddy/authentication-utils')
	}
	const authController: AuthenticationController = makeAuthenticationController(
		metadata.refreshToken,
		'https://api-auth.chatdaddy.tech'
	)
	return async (event: any) => {
		const authToken = event.headers['Authorization']?.replace('Bearer ', '')
		const user = await authController.authenticate(authToken)

		const sendMessage = async(jid: string, text: string, quoted?: WAMessage) => {
			const token = await authController.getToken(user.teamId)
			await got.post(
				`https://api.sendmammy.com/messages/${jid}`,
				{
					body: JSON.stringify({
						text,
						scheduleAt: Math.floor(Date.now()/1000), // send message now
						quotedID: quoted?.key.id, // quote the message
						sendTyping: true, // send with typing indicator
						randomizeMessage: false
					}),
					headers: {
						'authorization': `Bearer ${token}`,
						'content-type': 'application/json'
					}
				}
			)
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
		}
		return { statusCode: 204 }
	}
}