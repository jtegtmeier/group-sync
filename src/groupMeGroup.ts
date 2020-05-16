import { promisify } from 'util'
import { Stateless as GroupMe, IncomingStream as GroupMeStream } from 'groupme'
import { format } from 'date-fns'

// Convert async API functions to promises
const fetchGroups = promisify(GroupMe.Groups.index)
const fetchUserInfo = promisify(GroupMe.Users.me)
const fetchGroupMessages = promisify(GroupMe.Messages.index)
const postGroupMessage = promisify(GroupMe.Bots.post)

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
     * Initialize the GroupMe Class
     */
    async init() {
        // Get group and user info
        this._groupId = await fetchGroups(this._accessToken)
            .then((data) => data.find(({ name }) => name == this._groupName).id)
        this._userId = await fetchUserInfo(this._accessToken)
            .then(data => data.user_id)

        // Setup the group stream
        this._stream = new GroupMeStream(this._accessToken, this._userId, [this._groupId])
        this._stream.connect()
        await new Promise(resolve => {
            this._stream.on('status', (message) => {
                if (message === "Websocket Connected") {
                    setTimeout(() => {
                        console.log(`GroupMe group "${this._groupName}" connected`)
                        resolve()
                    },1000)
                }
            })
        })
    }

    /**
     * Returns messages starting at an optional id
     * 
     * @param offsetId The id (desc) of the group message to start from
     */
    async getMessages(offsetId?: string): Promise<{ messages: Message[], lastMessageId?: string }> {
        return fetchGroupMessages(
            this._accessToken, 
            this._groupId, 
            { before_id: offsetId }
        ).then(data => data && data.messages && ({
            messages: data.messages.map(message => ({
                user: message.name,
                createdOn: new Date(message.created_at * 1000),
                content: message.text,
                bot: message.sender_type === "bot"
            })),
            lastMessageId: data.messages[data.messages.length - 1].id
        }))
    }

    /**
     * Get all messages from a group
     * (excludes "GroupMe" system messages)
     */
    async getMessageHistory(): Promise<Message[]> {
        let lastMessageId: string
        let result: Message[] = []
        do {
            try {
                const messageData = await this.getMessages(lastMessageId)
                result = result.concat(messageData.messages)
                lastMessageId = messageData.lastMessageId
            }
            catch {
                break
            }
        } while (true)
        return result.filter(message => message.user !== "GroupMe")
    }

    onMessagePost(cb: (message: Message) => void) {
        this._stream.on('message', data => {
            if (
                data.data 
                && data.data.type === "line.create" 
                && data.data.subject.sender_type !== 'bot' 
                && data.data.subject.name !== "GroupMe"
            ){
                cb({
                    user: data.data.subject.name,
                    createdOn: new Date(data.data.subject.created_at * 1000),
                    content: data.data.subject.text,
                    bot: data.data.subject.sender_type === "bot"
                })
            }
        })

    }

    async postMessage(message: Message) {
        if(!message.bot){
            return new Promise(resolve => {
                postGroupMessage(
                    this._accessToken,
                    this._botId,
                    `${message.user} posted at ${format(message.createdOn, "hh:mm a M/d/Y")}\n${message.content}`,
                    {}
                ).then(() => {
                    setTimeout(() => { resolve() }, 500)
                })
            })
        }
    }
}