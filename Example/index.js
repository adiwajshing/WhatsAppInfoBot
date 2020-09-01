const LanguageProcessor = require('../LanguageProcessor.js')
const Responder = require ('../Responder')

const metadata = JSON.parse( 
    require("fs").readFileSync("./Example/metadata.json") 
)
const intents = [
    "./Example/intents/",
    "./Example/computed_intents/"
]
const processor = new LanguageProcessor(intents, metadata)
new Responder (processor.output, metadata).start ()