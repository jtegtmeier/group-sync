import { config as dotenvConfig } from 'dotenv'
import { readFileSync } from 'fs'
import DiscordChannel from './discord-channel'
import GroupMeGroup from './group-me-group'
import { safeLoad } from 'js-yaml'

// Configure environment
dotenvConfig()

// Main method
async function server() {
    const config = safeLoad(readFileSync('./config.yml', 'utf8'))

    for (const groupName in config["sync-groups"]) {
        const syncGroup = config["sync-groups"][groupName]
        try {
            const discordChannel = new DiscordChannel(
                process.env.DISCORD_ACCESS_TOKEN,
                syncGroup["discord-guild"],
                syncGroup["discord-channel"],
            )

            const groupMeGroup = new GroupMeGroup(
                process.env.GROUPME_ACCESS_TOKEN,
                syncGroup["groupme-bot-id"],
                syncGroup["groupme-group"],
            )

            // Wait for the APIs to initialize
            await discordChannel.init()
            await groupMeGroup.init()

            // Check if the history needs syncing
            if (syncGroup['sync-history']) {
                console.log('Syncing history...')
                await syncHistory(discordChannel, groupMeGroup)
            }

            groupMeGroup.onMessagePost((message: Message) => {
                discordChannel.postMessage(message)
            })

            discordChannel.onMessagePost((message: Message) => {
                groupMeGroup.postMessage(message)
            })
        } catch (error) {
            console.error(error)
            console.error(`Could not load group '${groupName}' in 'config.yml'`)
        }
    }
}

/**
 *  Sync the history of provided groups
 * 
 * @param discordChannel 
 * @param groupMeGroup 
 */
async function syncHistory(discordChannel: DiscordChannel, groupMeGroup: GroupMeGroup){
    const discordMessages = await discordChannel.getMessageHistory()
    console.log(discordMessages)
}

// Run the server
server()

// Exit on Ctrl + C
process.once('SIGTERM', function (code) {
    console.log('SIGTERM received...');
    process.exit()
});