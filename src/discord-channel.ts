import * as DiscordJS from 'discord.js'
import { format } from 'date-fns'

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
                console.log('Discord client running')
                resolve()
            })
        })
    }

    async getMessageHistory() {
        return await this._channel.messages.fetch().then(messages => 
            messages.filter(message => message.author.bot === false)
            .map(message => ({
                id: message.id,
                timestamp: message.createdTimestamp,
                user: message.author.username,
                content: message.content,
            }))
        )
    }

    postMessage(message: Message) {
        this._channel.send(`${message.user} posted at ${format(message.timestamp, "hh:mm a d/M/Y")}\n${message.content}`)
    }

    onMessagePost(cb: (message: Message) => void) {
        this._discordJSClient.on('message', (message) => {
            if (message.channel.id === this._channel.id && !message.member.user.bot){
                cb({
                    user: message.member.user.username,
                    timestamp: new Date(),
                    content: message.content
                })
            }
        })
    }
}