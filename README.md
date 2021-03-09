# WhatsappInfoBot - A framework to build bots generally, but specifically on WhatsApp. 

The framework uses [natural](https://github.com/NaturalNode/natural) (implemented by [@actuallysoham](https://github.com/actuallysoham)) to perform the natural language processing part. It can [Baileys](https://github.com/adiwajshing/Baileys) to interact with WhatsApp or with [SendMammy]() webhooks.

## Install

1. Edge version: `yarn add github:adiwajshing/WhatsappInfoBot`
2. Stable version: `yarn add @adiwajshing/whatsapp-info-bot`

## Building Intents

The library follows a modular design.
For example, a simple intent to answer queries about timings could look look like this:

[`timings.json`](/src/example/intents/timings.json)
``` javascript
{
    "keywords": ["timings","time","when","timing","schedule","open","close"], // the keywords to identify an intent
    "answer": "*Timings for {{entity.key}} are:*\n {{entity.value}}", // the answer for this intent
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

And use this intent like this:
``` ts
import timings from './timings.json'
import { createLanguageProcessor } from '@adiwajshing/whatsapp-info-bot/LanguageProcessor'

createLanguageProcessor([ timings ]).chat() // will start chat in terminal
```

So, if somebody asks the bot *ayy, till when does the parlour stay open?*, the bot will reply with:
    ```
    Timings for salon:
    11:00AM-7:00PM, closed on tuesdays
    ```

Here, `{{entity.key}}` maps onto the key, `salon` & `{{entity.value}}` maps onto the value, `11:00AM-7:00PM, closed on tuesdays`. 
Note: The syntax for these is the `Mustache` templating system. [Here](https://mustache.github.io/mustache.5.html) are the docs for the same.

Moreover, because `parlour` is an alternate name for *salon*, the library maps `parlour` back to the true name `salon` and then responds.

Sometimes, statically typing intents like this is too much of a pain or impossible to do. What if one wants to fetch the weather? Then, one could use a js class to describe the intent.

For example, `weather.js` could look like the following:

``` ts

export default async () => {
    const entities: {[_: string]: string} = {}

    const fetchCities = async() => {
        // fetch the cities you can answer for, possibly using a REST API
        // fetch weather.com/rest or something
        // then call this function to finally update the entities, you can leave the values blank because the answer will be fetched
        entities = {"new york": "", "sf": "", "new delhi": "", "tokyo": ""}
    }
    await fetchCities()
    return {
        keywords: ['weather', 'like'],
        entities: entities,
        answer: (entities: string[], user: string) => {
            // fetch the cities you can answer for, possibly using a REST API
            // fetch weather.com/rest or something
            return "lol I dont know"
        },
        meta: {
            userFacingName: ["weather"],
            description: "Ask about the weather in different cities",
            examples: ["weather in SF?", "new york weather", "listen fren, you better tell me what its like in Bombay"]
        }
    }
}
```

This class intent can be used very similarly, like:
``` ts
import timings from './timings.json'
import weather from './weather'
import { createLanguageProcessor } from '@adiwajshing/whatsapp-info-bot/LanguageProcessor'

(async () => {
    createLanguageProcessor(
        [ 
            timings,
            await weather()
        ],
        {
            parsingFailedText: 'I dont understand {{input}}'
        }
    ).chat() // will start chat in terminal
})()

```

### Regexp based intents

Sometimes, you require more precise intent parsing that requires regular expressions. You can add that as well. 

Example for a document access intent:
``` ts
export default {
	regexps: [
		/(?:i want to  |)access doc(?:ument|) ([a-z0-9]*)(?: and ([a-z0-9]*)|)/
	],
	entities: { },
	answer: entities => {
		return 'I see you want to access docs ' + entities.join(', ')
	},
	meta: {
		userFacingName: [ 'documents', 'document access' ],
		description: 'Access a document by ID. Of course, this is a test',
		examples: [
			'I want to access document 1234 and 5678',
			'access doc 1234'
		]
	}
}
```

## Usage over WhatsApp:

### With Baileys

``` ts
import timings from './timings.json'
import weather from './weather'
import { createLanguageProcessor, createBaileysResponder } from '@adiwajshing/whatsapp-info-bot/LanguageProcessor'

(async () => {
    const languageProcessor = createLanguageProcessor(
        [ 
            timings,
            await weather()
        ],
        {
            parsingFailedText: 'I dont understand {{input}}'
        }
    )

    createBaileysResponder(
        languageProcessor,
        {
            authFile: './auth_info.json'
            respondToPendingMessages: false // will respond to unread messages
        }
    ).start() // will connect and start responding to messages
})()
```
The first time you run the bot on WhatsApp, you will have to scan the QR code to enable WhatsApp Web.
Once you run this code, the responder will now connect to WhatsApp & it'll print out a QR code for you to scan with WhatsApp on your phone. 
Once you scan it with your phone, the bot will start recieving & responding to messages.