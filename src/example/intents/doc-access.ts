import { IntentData } from "../../types";

export default {
	regexps: [
		/(?:i want to  |)access doc(?:ument|) ([a-z0-9]*)(?: and ([a-z0-9]*)|)/
	],
	entities: { },
	answer: entities => {
		return 'I see you want to access docs ' + entities.join(', ')
	},
	meta: {
		userFacingName: [ 'documents', 'document access' ],
		description: 'Access a document by ID. Of course, this is a test',
		examples: [
			'I want to access document 1234 and 5678',
			'access doc 1234'
		]
	}
} as IntentData