const LanguageProcessor = require('../LanguageProcessor.js')
const processor = new LanguageProcessor("./Example/intents/", {admins: [], parsingFailedText: "could not understand <input>"})
processor.chat()


