module.exports = {
	chat: function () {
		console.log("type 'q' to exit;")
		const readline = require('readline').createInterface({input: process.stdin, output: process.stdout})

		const getInput = () => {
			readline.question("\ntype: ", (ques) => {
				if (ques === "q") {
					readline.close()
					process.exit(0)
				} else {
					this.output(ques, "test").then (str => { 
						console.log("response:\n" + str) 
						getInput()
					}).catch (err => {
						console.log("fallback:\n" + (err.message || err)) 
						getInput()
					})
				}
			})	
		}
		getInput()
	}
}