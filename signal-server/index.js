var WebSocketServer = require('uws').Server
var wss = new WebSocketServer({
  port: process.env.SIGNAL_SERVER_PORT || 3001
})

const connections = {
  coolrunning: {},
  smoky: {}
}

function safeSend(channel, username, event) {
  if (connections[channel] && connections[channel][username]) {
    connections[channel][username].send(event)
  }
}

wss.on('connection', ws => {
  console.log('new connection')
  ws.on('message', message => {
    const [action, data] = JSON.parse(message)
    switch (action) {
      case 'join':
        // check if data is allright
        if (!connections[data.channel] || !connections[data.channel][data.username]) {
          return
        }

        // save the channel / username on the connection object
        // for easy disconnecting later
        ws._channelName = data.channel
        ws._userName = data.username

        // get the current users in the channel
        const otherusers = Object.keys(connections[data.channel])
        const peersEvt = JSON.stringify(['peers', otherusers])
        ws.send(peersEvt)

        // broadcast join event to others
        Object.keys(connections[data.channel]).forEach(username => {
          const joinEvt = JSON.stringify(['join', data.username])
          safeSend(data.channel, username, joinEvt)
        })

        // store the connection
        connections[data.channel][data.username] = ws
        break
      case 'signal':
        const payload = {
          origin: data.origin,
          signal: data.signal
        }
        const signalEvt = JSON.stringify(['signal', payload])
        safeSend(data.channel, data.username, signalEvt)
        break
    }
  })
  ws.on('close', () => {
    const channel = ws._channelName
    const username = ws._userName
    if ( ! connections[channel][username]) {
      return
    }
    delete connections[channel][username]
    Object.keys(connections[channel]).forEach(activeUsername => {
      const leaveEvt = JSON.stringify(['leave', username])
      safeSend(channel, activeUsername, leaveEvt)
    })
  })
})
