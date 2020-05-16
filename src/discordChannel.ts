import * as DiscordJS from 'discord.js'
import { format } from 'date-fns'

/**
 * Class representing a Discord Channel
 */
export default class DiscordChannel {
    _accessToken: string
    _discordJSClient: DiscordJS.Client
    _guild: DiscordJS.Guild
    _guildName: string
    _channel: DiscordJS.TextChannel
    _channelName: string

    constructor(accessToken: string, guildName: string, channelName: string){
        this._accessToken = accessToken
        this._guildName = guildName
        this._channelName = channelName
        this._discordJSClient = new DiscordJS.Client()
        this._discordJSClient.login(this._accessToken)
    }

    /**
     * Initialize the GroupMe Websocket Stream
     */
    async init() {
        return new Promise(resolve => {
            this._discordJSClient.once('ready', () => {
                this._guild = this._discordJSClient.guilds.cache.find(guild => guild.name === this._guildName)
                const channel = this._guild.channels.cache.find(
                    (channel): channel is DiscordJS.TextChannel => channel.name === this._channelName
                )
                // Type Gaurd to get correct TextChannel type
                if (((channel): channel is DiscordJS.TextChannel => channel.type === 'text')(channel)){
                    this._channel = channel
                }
                console.log(`Discord channel "${this._guildName} -> ${this._channelName}" connected`)
                resolve()
            })
        })
    }

    async getMessageHistory(): Promise<Message[]> {
        let lastMessageId: string
        let result: Message[] = []
        do {
            try {
                const messageData = await this._channel.messages
                    .fetch({ limit: 100, before: lastMessageId })
                    .then(messages => {
                        if(!messages.size){
                            return
                        }
                        lastMessageId = messages.array()[messages.size-1].id
                        return messages.map(message => ({
                            user: message.author.username,
                            createdOn: new Date(message.createdTimestamp),
                            content: message.content,
                            bot: message.author.bot
                        })
                    )
                })
                if (!messageData){
                    break
                }
                result = result.concat(messageData)
            }
            catch (error) {
                console.log("Error getting discord messages")
                throw error
            }
        } while (true)
        return result
    }

    async postMessage(message: Message) {
        if (!message.bot) {
            return new Promise(resolve => {
                this._channel.send(`${message.user} posted at ${format(message.createdOn, "hh:mm a M/d/Y")}\n${message.content}`)
                setTimeout(() => {resolve()},500)
            })
        }
    }

    onMessagePost(cb: (message: Message) => void) {
        this._discordJSClient.on('message', (message) => {
            if (message.channel.id === this._channel.id && !message.member.user.bot){
                cb({
                    user: message.member.user.username,
                    createdOn: new Date(message.createdTimestamp),
                    content: message.content,
                    bot: message.author.bot
                })
            }
        })
    }
}