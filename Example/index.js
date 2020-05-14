const LanguageProcessor = require('../LanguageProcessor.js')
const Responder = require ('../Responder')
const processor = new LanguageProcessor("test_data.json")

new Responder (processor).start ()


