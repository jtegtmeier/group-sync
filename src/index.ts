import { config as dotenvConfig } from 'dotenv'
import * as fs from 'fs'
import DiscordChannel from './discord-channel'
import GroupMeGroup from './group-me-group'
import * as yaml from 'js-yaml'

// Configure environment
dotenvConfig()

// Main method
async function server() {
    const config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'))

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
                await syncHistory()
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

// Sync History of all groups
async function syncHistory(){

}

// Run the server
server()

// Exit on Ctrl + C
process.once('SIGTERM', function (code) {
    console.log('SIGTERM received...');
    process.exit()
});