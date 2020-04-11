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
Also, an example of the data file is provided in the [examples folder](Example/test_data.json)

The JSON is structured as 3 objects:
``` javascript
    {
        "metadata": { ... },
        "templates": { ... },
        "responses": { ... }
    }
```

#### metadata

Contains some basic information, and holds the following fields:
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

The templates are all regular expressions with an ```<input/>``` tag that acts as the placeholder for the actual question.

Examples:
- ``` "greeting": "(hey|hi|yo)(,|) <input/>" ``` (the greeting template is special & optional, it is automatically associated with every question)
- ``` "what": "what((’|'|)s| is| are|) <input/>" ```
- ``` "when2": "(when|(till |)what time) (does|is) <input/> (open|close|start|end)" ```
- ``` "when": "(till |)(when|(what |)time) (can i access|can i get|is|are) <input/>" ```

#### responses

Now, we come to the meat of the data file. This part contains data about all the questions the bot can answer. It is a dictionary, mapping the name of a command to information about it. 

**Simple example:**
``` javascript
    "commandName": {
        "possibleQuestions": [
            "what an amazing question",
            {
                "question": "is a (regex|regexp|regular expression) question",
                "templates": ["what"]
            },
            {
                "question": "to use (regex|regexp|regular expression) question",
                "templates": ["when", ""]
            }
        ],
        "answer": "look it up fren",
        "options": {},
        "meta": {}
    }
```

1. the ``` possibleQuestions ``` field holds an array of the possible questions that are associated with this command. 
    - The first question will match only when someone types in the text exactly like that (no regex).
    - The second question is a regex string and will match only with the "what" template. It won't match without the what template.
    - The third question is also a regex string and will match with the "when" template & by its own. The "" string in the templates field allows for that

2. the ``` answer ``` field holds a string for the answer. The bot will respond with this string when one of the questions match.

**Example of a command with dyanmic input:**
``` javascript
"timings": {
    "possibleQuestions": [
        {
            "question": "tim(e|ing(s|)) (for |4 |of )<time/>",
            "templates": ["what","give",""]
        },
        {
            "question": "<time/> tim(e|ing(s|))",
            "templates": ["what","give",""]
        },
        {
            "question": "<time/>",
            "templates": ["when","when2"]
        }
    ],
    "answer": "*<time:key> timings:*\n <time:value>",
    "options": {
        "mail room": {
            "keys": ["mailroom", "mailzz room"],
            "value": "Mon-Fri: 07:00PM-10:00PM, 07:00AM-10:00PM\nSat-Sun: 08:00AM-11:AM, 08:00PM-11:00PM"
        },
        "hot water": "Mon-Fri: 07:00PM-10:00PM, 07:00AM-10:00PM\nSat-Sun: 08:00AM-11:AM, 08:00PM-11:00PM"
    },
    "onUnknownOption": "",
    "meta": {
        "userFacingName": ["timings", "timing", "time"],
        "description": "Timings for facilities",
        "examples": ["mail room timings", "timing 4 mailroom"]
    }
}
```

1. this time, the ``` possibleQuestions ``` contain a tag -- ```<time/>```. The name of this tag is arbritrary and holds no value. The tag is a placeholder for any of the options laid out in the ``` options ``` field. However, for a question with a straightforward text answer, you can only have one option.
2. the answer field contains a ``` <time:key> ``` & ``` <time:value> ``` field. The 'key' represents the name of the option the user typed in, whereas the value is the value associated with that option. 
    For example if the question is "what are the timings for hot water?", then ``` <time/> = "hot water",  <time:key> = "hot water", <time:value> = "Mon-Fri: 07:00PM-10:00PM,..." ```
3. the ``` options ``` field contains all the options the tag (```<time/>```) can be the placeholder for. If an option can be associated with more than one strings, then that can be accomodated as well. For example, you want "mail room", "mailroom" & "mailzz room" to all be associated with one answer, then you could insert the option as follows:
    ``` javascript
        "mail room": {
            "keys": ["mailroom", "mailzz room"],
            "value": "Mon-Fri: 07:00PM-10:00PM, 07:00AM-10:00PM\nSat-Sun: 08:00AM-11:AM, 08:00PM-11:00PM"
        }
    ```
4. the ``` onUnknownOption ``` field contains the name of a function that the bot could execute (if not empty) in case the option the user entered could not be matched with anything. 

**Example of functional command:**
``` javascript
"theTime": {
    "possibleQuestions": [
        {
            "question": "time in <place/>",
            "templates": ["what","give",""]
        }
    ],
    "answer": "*Time in <place:key>*:\n<place:value>",
    "options": {
        "New York": "function:timePlace",
        "New Delhi": "function:timePlace",
        "San Francisco": "I won't tell you"
    },
    "onUnknownOption": "function:timePlace",
    "meta": {
        "userFacingName": ["timings", "timing", "time"],
        "description": "the time in a given city",
        "examples": ["mail room timings", "timing 4 mailroom"]
    }
}
```

This time, when an option matches or even if it doesn't a function is called to process the request, the function being ```timePlace()```. Unless, it's the "San Francisco" option, then it would just respond with "I won't tell you". One can use a mixture of functions & plain texts in a command.

The ```timePlace()``` function must be placed in the ```"customProcessor"``` file mentioned in the metadata and could be structured as:
``` javascript
function timePlace (options, id) {
    console.log(options) // output: {place: "Tokyo"}
    const date = new Date()
    // too lazy to write code for time zones or whatever
    return Promise.resolve(date.toString())
}
```
**Note:** the function must return a promise. This allows the bot to fetch things asynchronously from the web and respond in a few seconds too, without holding up the application.

So, when someone types in "what's the time in Tokyo?": 
1. the bot will check if such an option exists.
2. as it doesn't it'll fallback on the ```onUnknownOption``` field.
3. if the ```onUnknownOption``` field contains a function, which it does in this case, it'll execute the function.
4. then it'll place the returned value of the function in place of the ```<place:value>``` tag.
5. finally, the bot will respond with:
    "*Time in Tokyo*:
    13:20 24 April 2020"

**Other stuff:**
Moreover, a functional command can have more than one command. In the previous example, it could also have a ```<details/>``` tag in addition to the ```<place/>```.