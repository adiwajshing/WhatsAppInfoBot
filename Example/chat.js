const LanguageProcessor = require('../LanguageProcessor.js')
const intents = [
    "./Example/intents/",
    "./Example/computed_intents/"
]
const processor = new LanguageProcessor(intents, {admins: [], parsingFailedText: "could not understand <input>"})
processor.chat()


