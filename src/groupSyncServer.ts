import { config as dotenvConfig } from 'dotenv'
import { promisify } from 'util'
import { readFile } from 'fs'
import { safeLoad } from 'js-yaml'
import { format } from 'date-fns'
import DiscordChannel from './discordChannel'
import GroupMeGroup from './groupMeGroup'

// Convert async functions to promises
const readFilePromise = promisify(readFile)

//Types
type SyncGroup = {
    syncHistory: boolean
    discordChannel: DiscordChannel
    groupMeGroup: GroupMeGroup
}

// Configure environment
dotenvConfig()

/**
 * Main class
 */
export default class GroupSync {
    _config: any
    _syncGroups: Map<string, SyncGroup>
    _serverInitalized: boolean

    constructor() {
        this._syncGroups = new Map()
    }

    async init() {
        try {
            const fileString = await readFilePromise('./config.yml', 'utf8')
            this._config = safeLoad(fileString)
        } catch (error) {
            console.error('Could not load "config.yml" file')
            throw error
        }

        for (const [syncGroupName, syncGroupConfig] of new Map(Object.entries<any>(this._config.syncGroups))) {
            try {
                const discordChannel = new DiscordChannel(
                    process.env.DISCORD_ACCESS_TOKEN,
                    syncGroupConfig.discordGuildName,
                    syncGroupConfig.discordChannelName,
                )

                const groupMeGroup = new GroupMeGroup(
                    process.env.GROUPME_ACCESS_TOKEN,
                    syncGroupConfig.groupMeBotId,
                    syncGroupConfig.groupMeGroupName,
                )

                // Wait for the APIs to initialize
                await discordChannel.init()
                await groupMeGroup.init()

                this._syncGroups.set(syncGroupName, {
                    syncHistory: syncGroupConfig.syncHistory,
                    discordChannel,
                    groupMeGroup
                })
            } catch (error) {
                console.error(`Could not load sync group "${syncGroupName}"`)
            }
        }
        
        this._serverInitalized = true
    }

    /**
     * Start the server
     */
    async start() {
        this._syncGroups.forEach((syncGroup, syncGroupName) => {
            // Check if the history needs syncing
            if (syncGroup.syncHistory) {
                console.log(`Syncing post history for group "${syncGroupName}"...`)
                GroupSync.syncHistory(syncGroup).then(() => {
                    console.log(`Post history for group "${syncGroupName}" synced`)
                    GroupSync.startSyncListeners(syncGroup)
                    console.log(`Listening and syncing posts for group "${syncGroupName}"...`)
                })
            } else {
                GroupSync.startSyncListeners(syncGroup)
                console.log(`Listening and syncing posts for group "${syncGroupName}"...`)
            }
        })
    }

    /**
     * Start the cross-post listeners
     */
    static startSyncListeners(syncGroup: SyncGroup) {
        syncGroup.groupMeGroup.onMessagePost((message: Message) => {
            syncGroup.discordChannel.postMessage(message)
        })

        syncGroup.discordChannel.onMessagePost((message: Message) => {
            syncGroup.groupMeGroup.postMessage(message)
        })
    }

    /**
     *  Sync the history of provided groups
     */
    static async syncHistory(syncGroup: SyncGroup) {
        const discordMessages = await syncGroup.discordChannel.getMessageHistory()
        const groupmeMessages = await syncGroup.groupMeGroup.getMessageHistory()

        const missingGroupmeMessages = GroupSync.findMissingMessages(discordMessages, groupmeMessages)
        const missingDiscordMessages = GroupSync.findMissingMessages(groupmeMessages, discordMessages)

        for (const message of missingGroupmeMessages.reverse()){
            await syncGroup.groupMeGroup.postMessage(message)
        }

        for (const message of missingDiscordMessages.reverse()) {
            await syncGroup.discordChannel.postMessage(message)
        }
    }

    /**
     * Returns any messages missing from sourceMessageList in targetMessageList
     * based on matching user posts to corisponding bot re-posts
     */
    static findMissingMessages(targetMessageList: Message[], sourceMessageList: Message[]) {
        let missing: Message[] = []
        targetMessageList.forEach((targetMessage => {
            const foundMessage = sourceMessageList.find(
                sourceMessage => {
                    const sourceContent = sourceMessage.bot 
                        ? sourceMessage.content.slice(sourceMessage.content.indexOf('\n')+1) 
                        : sourceMessage.content
                    const targetContent = targetMessage.bot
                        ? targetMessage.content.slice(targetMessage.content.indexOf('\n')+1)
                        : targetMessage.content
                    const sourceTimestamp = sourceMessage.bot
                        ? sourceMessage.content.split('\n')[0].slice(sourceMessage.content.split('\n')[0].lastIndexOf('at') + 3)
                        : format(sourceMessage.createdOn, "hh:mm a M/d/Y")
                    const targetTimestamp = targetMessage.bot
                        ? targetMessage.content.split('\n')[0].slice(targetMessage.content.split('\n')[0].lastIndexOf('at') + 3)
                        : format(targetMessage.createdOn, "hh:mm a M/d/Y")
                    return (sourceContent.trim() === targetContent.trim()) && (sourceTimestamp.trim() === targetTimestamp.trim())
                }
            )
            if (!foundMessage) {
                missing.push(targetMessage)
            }
        }))
        return missing
    }
}