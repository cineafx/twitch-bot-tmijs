const parameterHandler = require(__dirname + '/parameterHandler.js')
var lastCommandUsage = {}

module.exports = {
  handle: handle,
  updateCommandObjects: updateCommandObjects
}

function handle (client, channel, userstate, message, userLevel) {

  var returnMessage = ""
  var returnType = "say"
  var input = splitInput(message)
  var command = getCommand(input, channel)
  if (command) {
    if (userLevel >= command.userLevel) {
      let isLocal = command.hasOwnProperty("channelName")

      //create channel object if not existing
      if (!lastCommandUsage.hasOwnProperty(channel)) {
        lastCommandUsage[channel] = {}
      }
      //create localCommands object if not existing
      if (!lastCommandUsage[channel].hasOwnProperty("localCommands")) {
        lastCommandUsage[channel]["localCommands"] = {}
      }
      //create globalCommands object if not existing
      if (!lastCommandUsage[channel].hasOwnProperty("globalCommands")) {
        lastCommandUsage[channel]["globalCommands"] = {}
      }

      let commandType = isLocal ? "localCommands" : "globalCommands"
      let lastTimeUsed = lastCommandUsage[channel][commandType][command.ID] || 0
      let currentTimeMillis = new Date().getTime()

      //calculate if cooldown applies
      //The part after the || is used if both bots are trying to answer the command ... both are now allowed ... 25ms is very generous ... 5 should normally be enough though.
      if ((lastTimeUsed + command.cooldown * 1000 < currentTimeMillis) || lastTimeUsed + 25 > currentTimeMillis) {
        lastCommandUsage[channel][commandType][command.ID] = currentTimeMillis

        returnMessage = command.response
        increaseTimesUsed(command)
        setTimeout(function () { updateCommandObjects() }, 500 )
      } else {
        console.log(timeStamp() + " Command cooldown: " + ((lastTimeUsed + command.cooldown * 1000) - currentTimeMillis) + "ms of cooldown remaining")
      }
    }
  }

  /* query */
  if (userLevel === 4 && input.command === "<query" /*&& returnMessage.length !== 0*/) {
    parameterHandler.wolframAlphaApi({client: client, message: returnMessage, returnType: returnType, userstate: userstate, channel: channel, input: input})
  }

  /* eval */
  if (userLevel === 4 && input.command === "<eval") {
    try {
    returnMessage = eval(input.allParameter).toString()
    } catch (err) {
      returnMessage = err.message
    }

    ["mysql", "identity", "oauth", "host", "password", "appid"].forEach( function (element) {
      if (returnMessage.toLowerCase().includes(element)
          || input.allParameter.toLowerCase().includes(element)) {
        returnMessage = "***"
      }
    })
  }

  /* shutdown */
  if (userLevel === 4 && ["<shutdown", "<sh", "<sd"].includes(input.command)) {
    returnMessage = "Shutting down ..."
    returnType = "shutdown"
  }

  if (returnMessage.length !== 0) {
    parameterHandler.checkAndReplace({client: client, message: returnMessage, returnType: returnType, userstate: userstate, channel: channel, uptime: process.uptime(), command: command})
  }
}

function increaseTimesUsed (command) {
  var sqlStr = ''
  if (command.hasOwnProperty('channel')) {
    sqlStr = 'UPDATE `localCommands` set timesUsed = timesUsed + 1 WHERE ID = ?'
  } else {
    sqlStr = 'UPDATE `globalCommands` set timesUsed = timesUsed + 1 WHERE ID = ?'
  }
  mysqlConnection.execute(
    sqlStr,
    [command.ID]
  )
  command.timesUsed++
}

function updateCommandObjects () {
  for (let member in globalCommandObject) { delete globalCommandObject[member] }
  for (let member in localCommandObject) { delete localCommandObject[member] }
  mysqlConnection.query(
    'SELECT * FROM `globalCommands`',
    function (err, results, fields) {
      results.forEach( function (element) {
        element.command = element.command.trim().toLowerCase()
        globalCommandObject[element.command] = element
      })
    }
  )
  mysqlConnection.query(
    'SELECT `localCommands`.`ID`, `localCommands`.`channel`, `localCommands`.`command`, `localCommands`.`response`, `localCommands`.`userLevel`, `localCommands`.`cooldown`, `localCommands`.`timesUsed`, `channels`.`channelName` FROM `localCommands` LEFT JOIN `channels` ON `channels`.`id` = `localCommands`.`channel`',
    function (err, results, fields) {
      results.forEach( function (element) {
        element.command = element.command.trim().toLowerCase()
        localCommandObject[element.command] = element
      })
    }
  )
}

function containsGlobalCommand (input, channel) {
  return globalCommandObject.hasOwnProperty(input.command)
}

function containsLocalCommand (input, channel) {
  var contains = false
  if (localCommandObject.hasOwnProperty(input.command)) {
    if ("#" + localCommandObject[input.command].channelName === channel) {
      contains = true
    }
  }
  return contains
}

function getCommand (input, channel) {
  var returnObj = false

  if (containsLocalCommand(input, channel, localCommandObject)) {
    if ("#" + localCommandObject[input.command].channelName === channel) {
      returnObj = localCommandObject[input.command]
    }
  } else if (containsGlobalCommand(input, channel, globalCommandObject)) {
    returnObj = globalCommandObject[input.command]
  }
  return returnObj
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
