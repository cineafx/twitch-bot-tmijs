module.exports = {
  handle: handle,
  updateCommandObjects: updateCommandObjects
}

function handle (channel, userstate, message, userLevel, mysqlConnection, globalCommandObject, localCommandObject) {

  var returnMessage = ""
  var returnType = "say"

  var input = splitInput(message)

  var command = getCommand(input, channel, globalCommandObject, localCommandObject)

  if (command) {
    if (userLevel >= command.userLevel) {
      returnMessage = command.response
      increaseTimesUsed(mysqlConnection, command)
      updateCommandObjects(mysqlConnection, globalCommandObject, localCommandObject)
    }
  }

  if (userLevel === 4 && input.command === "<shutdown") {
    returnMessage = "Shutting down ..."
    returnType = "shutdown"
  }

  if ( returnMessage.length !== 0 ) {
    return {returnType: returnType, returnMessage: returnMessage, command: command}
  } else {
    return null
  }
}

function increaseTimesUsed (mysqlConnection, command) {
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

function updateCommandObjects (mysqlConnection, globalCommandObject, localCommandObject) {
  for (let member in globalCommandObject) { delete globalCommandObject[member] }
  for (let member in localCommandObject) { delete localCommandObject[member] }
  mysqlConnection.query(
    'SELECT * FROM `globalCommands`',
    function (err, results, fields) {
      results.forEach( function (element) {
        globalCommandObject[element.command] = element
      })
    }
  )
  mysqlConnection.query(
    'SELECT `localCommands`.`ID`, `localCommands`.`channel`, `localCommands`.`command`, `localCommands`.`response`, `localCommands`.`userLevel`, `localCommands`.`timeout`, `localCommands`.`timesUsed`, `channels`.`channelName` FROM `localCommands` RIGHT JOIN `channels` ON `channels`.`id` = `localCommands`.`channel`',
    function (err, results, fields) {
      results.forEach( function (element) {
        localCommandObject[element.command] = element
      })
    }
  )
}

function containsGlobalCommand (input, channel, globalCommandObject) {
  return globalCommandObject.hasOwnProperty(input.command)
}

function containsLocalCommand (input, channel, localCommandObject) {
  var contains = false
  if (localCommandObject.hasOwnProperty(input.command)) {
    if ("#" + localCommandObject[input.command].channelName === channel) {
      contains = true
    }
  }
  return contains
}

function getCommand (input, channel, globalCommandObject, localCommandObject) {
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
