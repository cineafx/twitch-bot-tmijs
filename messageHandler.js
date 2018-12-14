const parameterHandler = require(__dirname + '/parameterHandler.js')
const request = require('request')
const splitTime = new RegExp(/(\d+)([smhd])?/, "i")
const nukeRegGetParameter = new RegExp(/(.+?)(?: (\d+[smhd]?))?(?: (\d+[smhd]?))?$/, "i")
const nukeRegIsReg = new RegExp(/(?:^\/)(.*)(?:\/[gimuy]*$)/)
var lastCommandUsage = {}

module.exports = {
  handle: handle,
  updateCommandObjects: updateCommandObjects
}

function handle (client, channel, userstate, message, userLevel) {

  var returnMessage = ""
  var returnType = "say"
  var input = splitInput(message)
  var command = getCommand(input, channel, userLevel)
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
  if (userLevel === userLevels.BOTADMIN && input.command === "<query") {
    parameterHandler.wolframAlphaApi({client: client, message: returnMessage, returnType: returnType, userstate: userstate, channel: channel, input: input})
  }

  /* nuke */
  if (userLevel > userLevels.MODERATOR && input.command === "<nuke") {
    returnMessage = ""

    if (input.allParameter !== null) {
      let parameter = input.allParameter.match(nukeRegGetParameter)

      let searchTerm = parameter[1]
      let searchTime = parameter[2] || "1m"
      let timeoutLength = parameter[3] || "1s"

      searchTime = stringTimeToSeconds(searchTime)
      timeoutLength = stringTimeToSeconds(timeoutLength)

      if (searchTerm && !isNaN(searchTime) && timeoutLength > 0) {

        let inputReg = searchTerm.match(nukeRegIsReg)
        if (inputReg && inputReg.length > 0) {
          searchTerm = inputReg[1]
        }
        searchTerm = new RegExp(searchTerm, "gi")

        mysqlConnection.query(
          "SELECT username, message, userLevel FROM IceCreamDataBase.messageLog WHERE channelID = ? AND TIMESTAMPDIFF(SECOND,`timestamp`,CURRENT_TIMESTAMP()) < ?",
          [channels[channel].ID, searchTime],
          function (err, results, fields) {
            let messageArray = []
            results.forEach( function (element) {
              if (element.userLevel < userLevels.MODERATOR && element.message.match(searchTerm)) {
                let tString = ".timeout " + element.username + " " + timeoutLength + " Nuked with: " + searchTerm.toString()
                if (!messageArray.includes(tString)) {
                  messageArray.push(tString)
                }
              }
            })
            messageArray.push("Nuked " + messageArray.length + " people with: " + searchTerm.toString())
            batchSay(client, channel, messageArray)
          }
        )
      }
    }
  }

  /* batchSay */
  if (userLevel === userLevels.BOTADMIN && input.command === "<batchsay") {
    returnMessage = ""
    let batchUrl = input.firstParameter
    request({
      url: batchUrl,
      method: "GET"
    }, function (err, res, body) {
      let messageArray = body.split(/(?:\n|\r\n)+/g)
      batchSay(client, channel, messageArray)
    })
  }

  /* eval */
  if (userLevel === userLevels.BOTADMIN && input.command === "<eval") {
    try {
    returnMessage = eval(input.allParameter).toString()
    } catch (err) {
      returnMessage = err.message
    }

    ["mysql", "identity", "oauth", "host", "password", "appid", "waAppid"].forEach( function (element) {
      if (returnMessage.toLowerCase().includes(element)
          || input.allParameter.toLowerCase().includes(element)) {
        returnMessage = "***"
      }
    })
  }

  /* shutdown */
  if (userLevel === userLevels.BOTADMIN && ["<shutdown", "<sh", "<sd", "<restart", "<rs", "<reboot", "<rb"].includes(input.command)) {
    returnMessage = "Shutting down ..."
    returnType = "shutdown"
  }

  if (returnMessage.length !== 0) {
    parameterHandler.checkAndReplace({client: client, message: returnMessage, returnType: returnType, userstate: userstate, channel: channel, uptime: process.uptime(), command: command, input: input})
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
        globalCommandObject[element.ID] = element
      })
    }
  )
  mysqlConnection.query(
    'SELECT `localCommands`.`ID`, `localCommands`.`channel`, `localCommands`.`command`, `localCommands`.`response`, `localCommands`.`userLevel`, `localCommands`.`cooldown`, `localCommands`.`timesUsed`, `channels`.`channelName` FROM `localCommands` LEFT JOIN `channels` ON `channels`.`id` = `localCommands`.`channel`',
    function (err, results, fields) {
      results.forEach( function (element) {
        element.command = element.command.trim().toLowerCase()
        localCommandObject[element.ID] = element
      })
    }
  )
}

function getGlobalCommandID (input, channel, userLevel) {
  var cmdIDs = []
  for (var key in globalCommandObject) {
    let element = globalCommandObject[key]
    if (element.command === input.command) {
      if (element.userLevel <= userLevel) {
        cmdIDs.push(element)
      }
    }
  }
  if (cmdIDs.length > 0) {
    var elementWithHighestUserLevel = {userLevel: -1}
    cmdIDs.forEach( function (element) {
      if (element.userLevel > elementWithHighestUserLevel.userLevel) {
        elementWithHighestUserLevel = element
      }
    })
    return elementWithHighestUserLevel.ID
  } else {
    return -1
  }
}

function getLocalCommandID (input, channel, userLevel) {
  var cmdIDs = []
  for (var key in localCommandObject) {
    let element = localCommandObject[key]
    if (element.command === input.command) {
      if ("#" + element.channelName === channel && element.userLevel <= userLevel) {
        cmdIDs.push(element)
      }
    }
  }
  if (cmdIDs.length > 0) {
    var elementWithHighestUserLevel = {userLevel: -1}
    cmdIDs.forEach( function (element) {
      if (element.userLevel > elementWithHighestUserLevel.userLevel) {
        elementWithHighestUserLevel = element
      }
    })
    return elementWithHighestUserLevel.ID
  } else {
    return -1
  }
}

function getCommand (input, channel, userLevel) {
  var returnObj = false

  var localCmdID = getLocalCommandID(input, channel, userLevel)
  if (localCmdID !== -1) {
    returnObj = localCommandObject[localCmdID]
  } else {
    var globalCmdID = getGlobalCommandID(input, channel, userLevel)
    if (globalCmdID !== -1) {
      returnObj = globalCommandObject[globalCmdID]
    }
  }
  return returnObj
}

function splitInput (input) {
  var output = {}
  var split = input.split(' ') || null

  output.command = split[0].toLowerCase() || null
  output.firstParameter = split[1] || null
  output.secondParameter = split[2] || null
  output.thirdParameter = split[3] || null
  output.allParameter = split.slice(1).join(" ") || null

  return output
}

async function batchSay (client, channel, messageArray) {
  if (queueOverwrite) {
    return false
  }

  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("Starting batchSay with " + messageArray.length + " lines.")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  var startTime = process.uptime()
  queueOverwrite = true
  var messagesPerChunk = 80
  var delayBetweenChunks = 30
  for (var i = 0; i < messageArray.length; i++) {
    client.say(channel, messageArray[i])
    if (i !== 0 && i % messagesPerChunk === 0) {
      console.log("-----------------------------------------------------------")
      console.log("-----------------------------------------------------------")
      console.log("Ran " + i + "/" + messageArray.length + " lines.")
      console.log("Took " + Math.floor(process.uptime() - startTime) + " seconds so far.")
      console.log("-----------------------------------------------------------")
      console.log("-----------------------------------------------------------")
      await new Promise(resolve => {
        setTimeout(resolve, delayBetweenChunks * 1000)
      })
    }
  }

  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("Ran " + messageArray.length + " lines.")
  console.log("Took " + Math.floor(process.uptime() - startTime) + " seconds.")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("Starting cooldown!")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  await new Promise(resolve => {
    setTimeout(resolve, delayBetweenChunks * 1000)
  })
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("Cooldown over")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  queueOverwrite = false
}

function stringTimeToSeconds (input) {
  let split = input.match(splitTime)
  let number = split[1] || 1
  let unit = split[2] || "m"
  let multiplier = 1

  switch (unit) {
    case "d":
      multiplier = 86400
      break
    case "h":
      multiplier = 3600
      break
    case "m":
      multiplier = 60
      break
  }
  if (!isNaN(number) ) {
    return number * multiplier
  } else {
    return -1
  }
}
