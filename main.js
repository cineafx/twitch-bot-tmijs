var tmi = require("tmi.js")
const mysql = require('mysql2')

const messageHandler = require(__dirname + '/messageHandler.js')
const parameterHandler = require(__dirname + '/parameterHandler.js')

var options = require('./config.json')

var pastMessages = []
var addSpecialCharacter = new Object()
var lastMessageTime = 0
var globalCommandObject = {}
var localCommandObject = {}

//Set default channel to only be the users channel
options.clientoptions.channels = ["#" + options.clientoptions.identity.username]
var client = new tmi.client(options.clientoptions)

const mysqlConnection = mysql.createConnection(options.mysqloptions)

// Connect the client to the server..
client.connect()

client.on("join", function (channel, username, self) {
  if (self && channel === "#" + username) {
    updateChannels()
    setInterval(function () { updateChannels() }, 60000)


    messageHandler.updateCommandObjects(mysqlConnection, globalCommandObject, localCommandObject)

    setInterval(function () { messageHandler.updateCommandObjects(mysqlConnection, globalCommandObject, localCommandObject) }, 60000)
  }
})


client.on("chat", function (channel, userstate, message, self) {
    // Don't listen to my own messages.. for now
    if (self) { return }

    var returner = messageHandler.handle(channel, userstate, message, getUserLevel(channel, userstate), mysqlConnection, globalCommandObject, localCommandObject)
    if (returner !== null) {
      var returnType = returner.returnType
      var returnMessage = returner.returnMessage

      returnMessage = parameterHandler.checkAndReplace({message: returnMessage, userstate: userstate, uptime: process.uptime()})

      sendMessage(channel, userstate.username, returnMessage)

      if (returnType === "shutdown") {
        setTimeout(function () {
          client.disconnect()
          process.exit(0)
        }, 1300)
      }
    }
})

client.on("subscription", function (channel, username, method, message, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " pupperDank Clap")
  }
})

client.on("resub", function (channel, username, months, message, userstate, methods) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " pupperDank Clap")
  }
})

client.on("subgift", function (channel, username, recipient, method, message, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " pupperDank Clap " + recipient)
  }
})


//functions

function updateChannels () {
  mysqlConnection.query(
    'SELECT * FROM `channels`',
    function (err, results, fields) {
      var channelsFromDB = ["#" + client.getUsername()]
      results.forEach( function (element) {
        channelsFromDB.push("#" + element.channelName)
      })

      client.getChannels().forEach( function (element) {
        if (!channelsFromDB.includes(element)) {
          client.part(element)
        }
      })

      channelsFromDB.forEach( function (element) {
        if (!client.getChannels().includes(element)) {
          client.join(element)
        }
      })
    }
  )
}

function getUserLevel (channel, userstate) {
  var userLevel = 0
  if (options.clientoptions.admins.includes(userstate["user-id"])) {
    userLevel = 4
  } else if (channel === '#' + userstate.username) {
    userLevel = 3
  } else if (userstate.mod) {
    userLevel = 2
  } else if (userstate.subscriber) {
    userLevel = 1
  }
  return userLevel
}

function cleanupGlobalTimeout () {
  while (pastMessages.length > 0 && pastMessages[0] + 30000 < new Date().getTime()) {
    pastMessages.shift()
  }
}

function checkGlobalTimeout () {
  if (pastMessages.length < 20) {
    console.log(pastMessages.length + " message(s) in the past 30 seconds")

    return false
  } else {
    return true
  }
}

function sendMessage (channel, username, message) {

  var delay = (client.getUsername() === username && !client.isMod(channel, client.getUsername())) ? 1250 : 0

  setTimeout(function () {

    var currentTimeMillis = new Date().getTime()

    //more than 1250ms since last message
    if (lastMessageTime + 1250 < currentTimeMillis || client.isMod(channel, client.getUsername())) {
      lastMessageTime = currentTimeMillis

      //anti global ban
      cleanupGlobalTimeout()
      if (!checkGlobalTimeout()) {
        pastMessages.push(new Date().getTime())

        var shouldAdd = addSpecialCharacter[channel] || false
        if (shouldAdd) {
          message = message + " \u206D"
        }
        addSpecialCharacter[channel] = !shouldAdd
        client.say(channel, message)

      } else {
        console.log("ratelimit: 20 messages in past " + (currentTimeMillis - pastMessages[0]) + "ms")
      }

    } else {
      console.log("ratelimit: Too fast as pleb " + (currentTimeMillis - lastMessageTime) + "ms")
    }

  }, delay)
}
