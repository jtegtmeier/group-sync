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
                console.log('Discord client connected')
                resolve()
            })
        })
    }

    async getMessageHistory(): Promise<Message[]> {
        return await this._channel.messages.fetch().then(messages => 
            messages.filter(message => message.author.bot === false)
            .map(message => ({
                user: message.author.username,
                createdOn: new Date(message.createdTimestamp),
                content: message.content,
            }))
        )
    }

    postMessage(message: Message) {
        this._channel.send(`${message.user} posted at ${format(message.createdOn, "hh:mm a d/M/Y")}\n${message.content}`)
    }

    onMessagePost(cb: (message: Message) => void) {
        this._discordJSClient.on('message', (message) => {
            if (message.channel.id === this._channel.id && !message.member.user.bot){
                cb({
                    user: message.member.user.username,
                    createdOn: new Date(message.createdTimestamp * 1000),
                    content: message.content
                })
            }
        })
    }
}