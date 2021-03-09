import greeting from './greeting.json'
import timings from './timings.json'
import help from './help'

import { createLanguageProcessor } from '../../LanguageProcessor'
import docAccess from './doc-access'

export default createLanguageProcessor(
	[ 
		greeting, 
		timings, 
		docAccess,
		help([greeting, timings]) // generate help for our two intents
	], 
	{ 
		parsingFailedText: "Sorry we couldn't understand {{input}}"
	}
)