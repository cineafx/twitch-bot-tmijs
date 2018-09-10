module.exports = {
  handle: handle,
  check: function () {
    //asdf
  },
  replace: function () {
    //asdf
  }
}

function handle (channel, userstate, message, userLevel, botname) {

  var messageLC = message.toLowerCase()
  var returnMessage = ""
  var returnType = "say"

  if (messageLC.startsWith('<ping')) {
    returnMessage = "pong"
  }

  if (messageLC.startsWith('<uptime')) {
    returnMessage = "Running for $(uptime)"
  }

  if (messageLC.startsWith('!pingall')) {
    returnMessage = "Running for $(uptime)"
  }

  if (userLevel === 4 && messageLC.startsWith('<shutdown')) {
    returnMessage = "Shutting down ..."
    returnType = "shutdown"
  }

  if ( returnMessage.length !== 0 ) {
    return {returnType: returnType, returnMessage: returnMessage}
  } else {
    return null
  }
}

function pause (delay) {
  var t0 = Date.now()
  while ((Date.now() - t0) < delay) {
    (function () {})()
  }
}
