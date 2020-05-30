const LanguageProcessor = require('../LanguageProcessor.js')
const Responder = require ('../Responder')

const metadata = JSON.parse( require("fs").readFileSync("./Example/metadata.json") )
const processor = new LanguageProcessor("./Example/intents/", metadata)
new Responder (processor.output, metadata).start ()



