# WhatsappInfoBot - A framework to build bots generally, but specifically on WhatsApp. 

It uses [natural](https://github.com/NaturalNode/natural) (implemented by [@actuallysoham](https://github.com/actuallysoham)) to perform the natural language processing part & [Baileys](https://github.com/adiwajshing/Baileys) to interact with WhatsApp.

## Install

Install using npm: ` npm install github:adiwajshing/WhatsappInfoBot `

## Building Intents

The library follows a modular design. Every intent must be placed in separate files & in a single folder. So, you will have an `intents/` directory and in there a collection of intents that are either programmatic `.js` files or `.json` files. 

For example, a simple intent to answer queries about timings could look look like this:

[`timings.json`](/Example/intents/timings.json)
``` javascript
{
    "keywords": ["timings","time","when","timing","schedule","open","close"], // the keywords to identify an intent
    "answer": "*Timings for <entity:key> are:*\n <entity:value>", // the answer for this intent
    "entities": { // list of things the bot can answer for the `timings` intent
        "piano room": "6:00AM-12:00AM",
        "lunch": "12:15PM-02:30PM",
        "breakfast": "08:00AM-10:30AM",
        "snacks": "04:45PM-06:15PM",
        "dinner": "07:30PM-10:15PM",
        "laundry": "dropoff: Mon & Thu 08:00AM-02:00PM\npickup: Wed & Sat 04:30PM-06:00PM",
        "library": "all the time fren, except friday",
        "salon": {
            "alternates": ["parlour", "parlor", "saloon"], // alternate names for the same entity
            "value": "11:00AM-7:00PM, closed on tuesdays"
        },
        "asg": "shuts at 11:30PM"
    },
    "meta": { // some optional metadata to maybe create user facing documentation, see Example/intents/help.js
        "userFacingName": ["timings"],
        "description": "Timings for facilities",
        "examples": ["mail room timings", "timing 4 dinner", "yo bro, when can i get lunch"]
    }
}
```

So, if somebody asks the bot *ayy, till when does the parlour stay open?*, the bot will reply with:
    ```
    Timings for salon:
    11:00AM-7:00PM, closed on tuesdays
    ```

Here, `<entity:key>` maps onto the key, `salon` & `<entity:value>` maps onto the value, `11:00AM-7:00PM, closed on tuesdays`.
Moreover, because `parlour` is an alternate name for *salon*, the library maps `parlour` back to the true name `salon` and then responds.

Sometimes, statically typing intents like this is too much of a pain or impossible to do. What if one wants to fetch the weather? Then, one could use a js class to describe the intent.

For example, `weather.js` could look like the following:

``` javascript

module.exports = class {
    constructor (processor) {
        this.processor = processor // the instance of LanguageProcessor.js that created this instance
        this.keywords = ["weather", "like"] // keywords to identify the intent
        this.entities = {} // leave empty for now, you can fetch city names later and update the entities
        this.meta = { // set some metadata
            "userFacingName": ["weather"],
            "description": "Ask about the weather in different cities",
            "examples": ["weather in SF?", "new york weather", "listen fren, you better tell me what its like in Bombay"]
        }
        fetchCities ()
    }
    async fetchCities () {
        // fetch the cities you can answer for, possibly using a REST API
        // fetch weather.com/rest or something
        // then call this function to finally update the entities, you can leave the values blank because the answer will be fetched
        updateEntities ("weather", {"new york": "", "sf": "", "new delhi": "", "tokyo": ""}) 
    }
    /**
     * Async function that is called when somebody calls the `weather` command
     * @param {string[]} entities - what city?
     * @param {string} user - ID of the user
     */
    async answer (entities, user) {
        // fetch the cities you can answer for, possibly using a REST API
        // fetch weather.com/rest or something
        return "lol I dont know"
    }
}

```

## Usage:

1. Populate your intents folder with the intents you built. See this [example folder](/Example) for reference.
2. To simply test your intents out in terminal, see [here](/Example/chat.js):
    ``` javascript
    const LanguageProcessor = require('WhatsAppInfoBot/LanguageProcessor.js')
    const processor = new LanguageProcessor("./path/to/intents/", {parsingFailedText: "Oh no, I could not understand <input>"})
    processor.chat() // chat in terminal
    ```
2. To run your bot on WhatsApp, see [here](/Example/index.js): 
    ``` javascript
        const LanguageProcessor = require("WhatsAppInfoBot/LanguageProcessor.js")
        const WhatsAppResponder = require("WhatsAppInfoBot/Responder.js")

        const metadata = {
            parsingFailedText: "Oh no, I could not understand <input>", // what to say when the bot failed to understand what was being said
            admins: [ // admins of this bot, optional, is used for the help.js intent
                "23123123123",
                "12123123123"
            ],
            maxRequestsPerSecond: 0.33, // max requests a user can make in a second
            authFile: "./Example/auth_info.json" // path to the file where the WhatsApp credentials will be stored
        }
        const processor = new LanguageProcessor("./Example/intents/", metadata) // create the processor
        new Responder (processor.output, metadata).start () // start the WhatsApp Responder
    ```
    The first time you run the bot on WhatsApp, you will have to scan the QR code to enable WhatsApp Web.
    Once you run this code, the responder will now connect to WhatsApp & it'll print out a QR code for you to scan with WhatsApp on your phone. 
    Once you scan it with your phone, the bot will start recieving & responding to messages.
    
    **Note:** the bot will try & respond to all unread messages on your WhatsApp.
