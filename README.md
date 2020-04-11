# WhatsappInfoBot
 
## Usage:

1. Create your data JSON file, programmed responders (more on that later)
2. Import the module: 
    ``` javascript
        const LanguageProcessor = require("WhatsAppInfoBot/LanguageProcessor.js")
        const WhatsAppResponder = require("WhatsAppInfoBot/Responder.js")
    ```
3. Create the instances:
    ``` javascript
        const processor = new LanguageProcessor("my_data.json")
        const responder = new WhatsAppResponder(processor)
    ```
    The  ```LanguageProcessor``` module is fed all the text that the bot recieves, and using the JSON file, parses the text & finds the appropriate response.
    Its constructor takes in the path to the data JSON file.

    The  ```WhatsAppResponder``` module uses [Baileys](https://github.com/adiwajshing/Baileys) to interact with WhatsApp. And it uses the ```LanguageProcessor``` module to parse the messages recieved from WhatsApp, & sends back the response computed.
4. Start recieving messages:
    ``` javascript
        responder.start()
    ```
    Once you run this code, the responder will now connect to WhatsApp & it'll print out a QR code for you to scan with WhatsApp on your phone. 
    Once you scan it with your phone, the bot will start recieving & responding to messages.
    
    Note: the bot will try & respond to all unread messages on your WhatsApp.
5. If you want to just test out how the bot's language parsing, or want to chat with it in terminal, run the following code:
    ``` javascript
        const LanguageProcessor = require("WhatsAppInfoBot/LanguageProcessor.js")
        const processor = new LanguageProcessor("my_data.json")
        processor.chat()
    ```
6. An example of the usage of the bot has been provided, you can run it using ```cd WhatsAppInfoBot/Example; node chat.js;```

## The Data

Before working with the data, please be familiar with regular expressions. If you're not, please [see here]().

1. The JSON is structured as 3 objects:
    ``` javascript
        {
            "metadata": { ... },
            "templates": { ... },
            "responses": { ... }
        }
    ```
    #### metadata
    
    Contains some basic information, and holds the following properties:
    - ``` "admins": ["10digitphone", "10digitphone"] ``` -- the admins for WhatsApp interaction (does not do much right now)
    - ``` "unknownCommandText": "I don't understand <input/>" ```  -- what the bot responds with if it could not understand what was said
    - ``` "whatsapp_creds_file": "auth_info.json" ``` -- JSON file to store the credentials for WhatsApp, so that you don't have to scan with your phone everytime you want to log in
    - ``` "maxRequestsPerSecond": 0.5 ``` -- max WhatsApp texts a user can send to the bot in one second before the bot stops responding
    - ``` "responseTimeSeconds": [0.5, 3]``` -- responds to a user with a text within the given seconds
    - ``` "defaultRegexBlank": "(?:the |)(.{1,15})" ``` -- the default template for a dynamic input 
    - ``` "mapOnlyOptionInput": true ``` -- if set to true, a user can just send in the name of an option (eg. "mail room") and the bot will map it to the question(s) it is associated with and respond.
    - ``` "customProcessor": "./Example/Commands.Help.js" ``` -- the filename of the processor for custom commands

    #### templates

    Contains a list of templates one can associate questions with. 
    
    One could have multiple questions, in the form of a 'what' question. For example, 'what is a watermelon', 'what's a watermelon', 'what are the timings for the X facility'. So, instead of having to type all the ways one can type all these questions, it would be simpler to just create a template for all 'what' questions and associate questions with that template. This is exactly what templates do.

    Examples:
    - ``` "greeting": "(hey|hi|yo)(,|) <input/>" ``` (the greeting template is special & optional, it is automatically associated with every question)
    - ``` "what": "what((’|'|)s| is| are|) <input/>" ```
	- ``` "when2": "(when|(till |)what time) (does|is) <input/> (open|close|start|end)" ```
	- ``` "when": "(till |)(when|(what |)time) (can i access|can i get|is|are) <input/>" ```

    **Note:** the ```<input/>``` tag acts as the placeholder for the actual question.
	
    #### responses

