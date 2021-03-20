import type { MessageOptions, MessageType, WAConnection, WAMessage } from '@adiwajshing/baileys'
import { Answer, LanguageProcessor, WAResponderParameters } from "./types";
import { onChatUpdate, onWAMessage } from "./WAResponder";
import { promises as fs } from "fs";

export type BaileysResponderParameters = WAResponderParameters & {
	authFile: string
}
export const createBaileysResponder = (
	processor: LanguageProcessor,
	metadata: BaileysResponderParameters
) => {
	const Baileys = require('@adiwajshing/baileys')
	if(!Baileys) throw new Error('Baileys not found')

	const connection: WAConnection = new Baileys.WAConnection()
	connection.autoReconnect = Baileys.ReconnectMode.onAllErrors

	const sendMessage = async(jid: string, answer: Answer, quoted: WAMessage) => {

		let type: MessageType
		let content: any
		let options: Partial<MessageOptions> = {}
		if(typeof answer === 'object' && 'template' in answer) {
			throw new Error('Baileys responder does not support templates')
		} else if(typeof answer === 'string') {
			content = answer
			type = Baileys.MessageType.conversation
		} else {
			if(answer.image) {
				content = answer.image
				options = { caption: answer.text }
				type = Baileys.MessageType.imageMessage
			} else if(answer.video) {
				content = answer.video
				options = { caption: answer.text }
				type = Baileys.MessageType.videoMessage
			} else if(answer.audio) {
				content = answer.video
				type = Baileys.MessageType.audioMessage
			} else if(answer.document) {
				content = answer.document
				type = Baileys.MessageType.documentMessage
			} else if(answer.contacts) {
				throw new Error('No support for contact messages right now')
			} else {
				content = answer.text
				type = Baileys.MessageType.conversation
			}
		}

		await connection.updatePresence(jid, Baileys.Presence.available)
		Baileys.delay (250)
		
		await connection.chatRead(jid)
		Baileys.delay (250)
		
		await connection.updatePresence(jid, Baileys.Presence.composing)
		Baileys.delay (2000)
		
		await connection.sendMessage(jid, content, type, { quoted, ...options })
	}

	connection.on('chat-update', update => (
		onChatUpdate(update, { sendMessage, metadata, processor })
	))

	return {
		start: async() => {
			const {authFile} = metadata
			const authExists = await fs.access(authFile).catch(() => false)
			authExists && connection.loadAuthInfo(authFile)
			
			const hasAuth = connection.canLogin()
			await connection.connect()

			if (hasAuth) {
				fs.writeFile(
					authFile, 
					JSON.stringify(
						connection.base64EncodedAuthInfo(), 
						null, 
						"\t"
					)
				)
			}
			console.log ("Using account of: " + connection.user.name)
			
			if (metadata.respondToPendingMessages) {
				const unreadMessages = await connection.loadAllUnreadMessages()
				console.log (`responding to ${unreadMessages.length} unread messages`)
				for (let message of unreadMessages) {
					await onWAMessage(message, { sendMessage, metadata, processor })
				}
			}
		},
		close: () => connection.close()
	}
}