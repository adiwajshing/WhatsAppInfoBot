import { Answer, InputContext, LanguageProcessor, WAResponderParameters } from "./types"
import type { WAMessage, WAChatUpdate, proto } from '@adiwajshing/baileys'

// file contains generic code to build a WA responder

export type WAMessageParameters = {
	sendMessage: (jid: string, reply: Answer, quoting?: WAMessage) => Promise<void>
	metadata: WAResponderParameters,
	processor: LanguageProcessor
}
export const onChatUpdate = async(
	chatUpdate: WAChatUpdate,
	p: WAMessageParameters
) => {
	if(chatUpdate.hasNewMessage) {
		let msg: WAMessage
		if(chatUpdate.messages.all) {
			msg = chatUpdate.messages.all()[0]
		} else {
			//@ts-ignore
			msg = chatUpdate.messages[0]
		}
		await onWAMessage(msg, p)
	}
}
export const onWAMessage = async(
	message: WAMessage,
	{ sendMessage, metadata, processor }: WAMessageParameters
) => {
	// obviously don't respond to your own messages
	if (message.key.fromMe) return

	const senderID = message.key.remoteJid
	const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text
	if (!message.message) {
		console.log("recieved notification from " + senderID + " of type " + message.toJSON().messageStubType + "; cannot be responded to")
		return
	}
	if (!messageText) {
		console.log("recieved message from " + senderID + " with no text: " + JSON.stringify(message).slice(0, 100))
		return
	}

	// if a delay trigger is specified
	if (metadata.minimumDelayTriggerS && metadata.delayMessage) {
		// get timestamp of message
		//@ts-ignore
		const sendTime = message.messageTimestamp?.low || message.messageTimestamp
		const diff = (Date.now()/1000)-sendTime
		if (diff > metadata.minimumDelayTriggerS) {
			console.log (`been ${diff} seconds since message, responding with delay message to ${senderID}`)
			// respond if not a group
			if (!senderID.includes("@g.us")) await sendMessage(senderID, metadata.delayMessage)
		}
	}

	let responses: Answer[]
	const ctx: InputContext = {
		userId: senderID, 
		messageId: message.key.id 
	}
	const [messageContent] = Object.values(message.message)
	if(typeof messageContent === 'object' && messageContent.contextInfo) {
		const contextInfo = messageContent.contextInfo as proto.IContextInfo
		if(contextInfo.remoteJid && contextInfo.stanzaId) {
			ctx.quotedMessage = {
				id: contextInfo.stanzaId,
				remoteJid: contextInfo.remoteJid
			}
		}
	}
	try {
		responses = await processor.output(messageText, ctx)
	} catch (err: any) {
		// do not respond if its a group
		if (senderID.includes("@g.us")) return
		responses = [
			(err.message || err).replace('Error: ', '')
		]
	}
	if (responses) {
		for(const response of responses) {
			console.log({
				message: 'replying',
				context: ctx,
				reply: response,
			})
			await sendMessage(ctx.userId, response, message)
		}
	}
}