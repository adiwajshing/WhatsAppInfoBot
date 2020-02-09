const LanguageProcessor = require('./LanguageProcessor.js')

const processor = new LanguageProcessor("test_data.json")

function createCommand () {
	processor.create("greeting")
	processor.addQuestion("greeting", "how are you")
	//processor.addQuestion("greeting", "hello [friend|enemy]")
	processor.addQuestion("greeting", "(my |)name (is |)<name/>")
	processor.setAnswer("greeting", "oh hellu <name:value>")
	processor.save()
}
if (!processor.data.responses.greeting) {
	createCommand()
}
processor.getResponse("hey, give hot water time").then (str => console.log(str))



