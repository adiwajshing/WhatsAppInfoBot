import type { WAConnection, WAMessage } from '@adiwajshing/baileys'
import { LanguageProcessor, WAResponderParameters } from "./types";
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

	const sendMessage = async(jid: string, message: string, quoted: WAMessage) => {
		await connection.updatePresence(jid, Baileys.Presence.available)
		Baileys.delay (250)
		
		await connection.chatRead(jid)
		Baileys.delay (250)
		
		await connection.updatePresence(jid, Baileys.Presence.composing)
		Baileys.delay (2000)
		
		await connection.sendMessage(jid, message, Baileys.MessageType.text, { quoted })
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