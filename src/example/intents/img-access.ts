import { IntentData } from "../../types";

const IMGS = [
	'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSS815rKFCQQ7zkA8mDW5gH45sBT0Eiu7McHw&usqp=CAU',
	'https://i.pinimg.com/originals/05/1b/7d/051b7d93394fc94c082f1801bc4ccfb2.jpg'
]
// sends a random image
export default {
	keywords: [
		'image',
		'img',
		'imag'
	],
	entities: { },
	answer: () => {
		const url = IMGS[Math.floor(Math.random()*IMGS.length)]
		return {
			text: 'here is a random image for you',
			image: { url }
		}
	},
	meta: {
		userFacingName: [ 'random image' ],
		description: 'Replies with a random image',
		examples: [
			'image pls',
			'send a random image'
		]
	}
} as IntentData