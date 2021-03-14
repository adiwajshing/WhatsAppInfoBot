import greeting from './greeting.json'
import timings from './timings.json'
import docAccess from './doc-access'
import imgAccess from './img-access'
import help from './help'

import { createLanguageProcessor } from '../../LanguageProcessor'

export default createLanguageProcessor(
	[ 
		greeting, 
		timings, 
		docAccess,
		imgAccess,
		help([greeting, timings, docAccess, imgAccess]) // generate help for our intents
	], 
	{ 
		parsingFailedText: "Sorry we couldn't understand '{{input}}'"
	}
)