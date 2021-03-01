
import he from 'he'
import mustache from 'mustache'

export const parseTemplate = (text: string, params: {[_: string]: any}) => {
	text = mustache.render(text, params)
    text = he.decode(text)
	return text
}