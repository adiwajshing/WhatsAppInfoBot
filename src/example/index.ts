import LanguageProcessor from './intents'
import { createBaileysResponder } from '../BaileysResponder'

createBaileysResponder(
    LanguageProcessor,
    { authFile: './auth_info.json' }
)