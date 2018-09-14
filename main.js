var tmi = require("tmi.js")
const mysql = require('mysql2')

const messageHandler = require(__dirname + '/messageHandler.js')
const parameterHandler = require(__dirname + '/parameterHandler.js')

var options = require('./config.json')

var pastMessages = []
var addSpecialCharacter = new Object()
var lastMessageTime = 0
global.globalCommandObject = {}
global.localCommandObject = {}

//Set default channel to only be the users channel
options.clientoptions.dedicated.channels = ["#" + options.clientoptions.dedicated.identity.username]
options.clientoptions.self.channels = ["#" + options.clientoptions.self.identity.username]

var client = new tmi.client(options.clientoptions.dedicated)
//TODO: find a way to apply the client.on to both tmi clients
//TODO: make it a not anonymous function
//TODO: make sure global timeout applies to both at the same time!!
//TODO: make sure addSpeicalCharacter does NOT apply to both at the same time!!

global.mysqlConnection = mysql.createConnection(options.mysqloptions)

// Connect the client to the server..
client.connect()

client.on("join", onJoin )
client.on("chat", onChat)
client.on("subscription", onSubscription)
client.on("resub", onResub )
client.on("subgift", onSubgift)
client.on("giftpaidupgrade", onGiftpaidupgrade)
client.on("else", onElse)

/* -------------------------------------------------- */
/* -------------------------------------------------- */
/* ------------------ ON FUNCTIONS ------------------ */
/* -------------------------------------------------- */
/* -------------------------------------------------- */

function onJoin (channel, username, self) {
  if (self && channel === "#" + username) {
    updateChannels()
    setInterval(function () { updateChannels() }, 60000)


    messageHandler.updateCommandObjects()
    setInterval(function () { messageHandler.updateCommandObjects() }, 60000)
  }
}

function onChat (channel, userstate, message, self) {
  // Don't listen to my own messages.. for now
  //if (self) { return }

  var returner = messageHandler.handle(channel, userstate, message, getUserLevel(channel, userstate))
  if (returner !== null) {
    var returnType = returner.returnType
    var returnMessage = returner.returnMessage

    returnMessage = parameterHandler.checkAndReplace({message: returnMessage, userstate: userstate, channel: channel, uptime: process.uptime(), command: returner.command})

    sendMessage(channel, userstate.username, returnMessage)

    if (returnType === "shutdown") {
      setTimeout(function () {
        client.disconnect()
        process.exit(0)
      }, 1300)
    }
  }
}

function onSubscription (channel, username, method, message, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " pupperDank Clap")
  }
}

function onResub (channel, username, months, message, userstate, methods) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " " + months + " years pupperF Clap")
  }
}

function onSubgift (channel, username, recipient, method, message, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " pupperK pupperL " + recipient)
  }
}

function onGiftpaidupgrade (channel, username, sender, promo, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(channel, username, username + " pupperAL pupperSmile pupperAR " + sender)
  }
}

function onElse (message) {
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log(JSON.stringify(message))
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
}

/* -------------------------------------------------- */
/* -------------------------------------------------- */
/* ---------------- OTHER FUNCTIONS ----------------- */
/* -------------------------------------------------- */
/* -------------------------------------------------- */

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
