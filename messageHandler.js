module.exports = {
  handle: function (userstate, message, botname) {

    var messageLC = message.toLowerCase()
    var returnMessage = ""
    var returnType = "say"

    if (messageLC.startsWith('<test')) {
      returnMessage = "TEST"
    }

    if (messageLC.startsWith('!xd')) {
      returnMessage = "xD"
    }

    if (messageLC.startsWith('<ping')) {
      returnMessage = "pong"
    }

    if (messageLC.startsWith('<uptime')) {
      returnMessage = "Running for $(uptime)"
    }

    if (['icdb', botname].includes(userstate.username) && messageLC.startsWith('<shutdown')) {
      returnMessage = "Shutting down ..."
      returnType = "shutdown"
    }

    if ( returnMessage.length !== 0 ) {
      return {returnType: returnType, returnMessage: returnMessage}
    } else {
      return null
    }

  },
  check: function () {
    //asdf
  },
  replace: function () {
    //asdf
  }
}

function pause(delay) {
    var t0 = Date.now();
    while((Date.now() - t0) < delay) {
        (function() {}) ();
    }
}
