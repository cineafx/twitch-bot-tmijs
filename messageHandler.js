module.exports = {
  handle: handle,
  check: function () {
    //asdf
  },
  replace: function () {
    //asdf
  }
}

function handle (channel, userstate, message, userLevel) {

  var returnMessage = ""
  var returnType = "say"

  var input = splitInput(message)

  if (input.command === "<ping") {
    returnMessage = "pong"
  }

  if (input.command === "<uptime") {
    returnMessage = "Running for $(uptime)"
  }

  if (input.command === "!pingall") {
    returnMessage = "Running for $(uptime)"
  }

  if (input.command === "<check") {
    returnMessage = "Userlevel of " + userstate.username + ": " + userLevel
  }

  if (userLevel === 4 && input.command === "<shutdown") {
    returnMessage = "Shutting down ..."
    returnType = "shutdown"
  }

  if ( returnMessage.length !== 0 ) {
    return {returnType: returnType, returnMessage: returnMessage}
  } else {
    return null
  }
}

function splitInput (input) {
  var output = {}

  var split = input.split(' ') || null

  output.command = split[0].toLowerCase() || null
  output.firstParameter = split[1] || null
  output.allParameter = split.slice(1).join(" ") || null

  return output
}

function pause (delay) {
  var t0 = Date.now()
  while ((Date.now() - t0) < delay) {
    (function () {})()
  }
}
