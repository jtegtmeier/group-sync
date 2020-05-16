import GroupSyncServer from './groupSyncServer'

const server = new GroupSyncServer()

server.init().then(() => {
    server.start()
})

// Exit on Ctrl + C
process.once('SIGTERM', function (code) {
    console.log('SIGTERM received...');
    process.exit(1)
});