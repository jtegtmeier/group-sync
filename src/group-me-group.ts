import { Stateless as GroupMe, IncomingStream as GroupMeStream } from 'groupme'
import { format } from 'date-fns'

/**
 * Class representing a GroupMe Group
 */
export default class GroupMeGroup {
    _accessToken: string
    _groupName: string
    _groupId: any
    _userId: any
    _stream: any
    _botId: string

    constructor(accessToken: string, botId: string, groupName: string) {
        this._accessToken = accessToken
        this._botId = botId
        this._groupName = groupName
    }

    /**
     * Initialize the GroupMe Websocket Stream
     */
    async init() {
        this._groupId = await GroupMe.Groups.index.Q(this._accessToken)
            .then((data) => data.find(({ name }) => name == this._groupName).id)
        this._userId = await GroupMe.Users.me.Q(this._accessToken)
            .then(data => data.user_id)
        this._stream = new GroupMeStream(this._accessToken, this._userId, [this._groupId])
        this._stream.connect()
        await new Promise(resolve => {
            this._stream.on('status', (message) => {
                if (message === "Websocket Connected") {
                    setTimeout(() => {
                        console.log('GroupMe client connected')
                        resolve()
                    },1000)
                }
            })
        })
    }

    /**
     * Returns messages starting at an optional id
     * 
     * @param beforeId The id of the group message to start from
     */
    async getMessages(beforeId?: string) {
        return GroupMe.Messages.index.Q(this._accessToken, this._groupId, { before_id: beforeId }).then(data => data)
    }

    async getMessageHistory() {
        let lastMessageId
        let data
        const result = []
        do {
            if (data && data.messages[data.messages.length - 1]) {
                lastMessageId = data.messages[data.messages.length - 1].id
            }
            try {
                data = await this.getMessages(lastMessageId)
                result.push(...data.messages)
            }
            catch {
                break
            }
        } while (true)
        return result
    }

    onMessagePost(cb: (message: Message) => void) {
        this._stream.on('message', data => {
            if (data.data && data.data.type === "line.create" && data.data.subject.sender_type !== 'bot'){
                cb({
                    user: data.data.subject.name,
                    createdOn: new Date(data.data.subject.created_at * 1000),
                    content: data.data.subject.text
                })
            }
        })

    }

    postMessage(message: Message) {
        GroupMe.Bots.post.Q(
            this._accessToken,
            this._botId,
            `${message.user} posted at ${format(message.createdOn, "hh:mm a d/M/Y")}\n${message.content}`,
            {}
        )
    }
}