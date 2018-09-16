var tmi = require("tmi.js")
const mysql = require('mysql2')

const messageHandler = require(__dirname + '/messageHandler.js')
const parameterHandler = require(__dirname + '/parameterHandler.js')

var options = require('./config.json')

var pastMessages = []
var addSpecialCharacter = new Object()
var lastMessageTime = 0
var previousLogMessage = ""
global.globalCommandObject = {}
global.localCommandObject = {}

//Set default channel to only be the users channel
options.clientoptions.dedicated.channels = ["#" + options.clientoptions.dedicated.identity.username]
options.clientoptions.self.channels = ["#" + options.clientoptions.self.identity.username]

var clientDedicated = new tmi.client(options.clientoptions.dedicated)
var clientSelf = new tmi.client(options.clientoptions.self)

//TODO: find a way to apply the client.on to both tmi clients
//TODO: make it a not anonymous function
//TODO: make sure global timeout applies to both at the same time!!
//TODO: make sure addSpeicalCharacter does NOT apply to both at the same time!!

global.mysqlConnection = mysql.createConnection(options.mysqloptions)

// Connect the clients to the server..

if (options.clientoptions.dedicated.enabled) {
  clientDedicated.connect()

  clientDedicated.on("join", onJoin )
  clientDedicated.on("chat", onChat)
  clientDedicated.on("subscription", onSubscription)
  clientDedicated.on("resub", onResub )
  clientDedicated.on("subgift", onSubgift)
  clientDedicated.on("giftpaidupgrade", onGiftpaidupgrade)
  clientDedicated.on("else", onElse)
}
if (options.clientoptions.self.enabled) {
  clientSelf.connect()

  clientSelf.on("join", onJoin )
  clientSelf.on("chat", onChat)
  clientSelf.on("subscription", onSubscription)
  clientSelf.on("resub", onResub )
  clientSelf.on("subgift", onSubgift)
  clientSelf.on("giftpaidupgrade", onGiftpaidupgrade)
  clientSelf.on("else", onElse)
}

/* -------------------------------------------------- */
/* -------------------------------------------------- */
/* ------------------ ON FUNCTIONS ------------------ */
/* -------------------------------------------------- */
/* -------------------------------------------------- */

function onJoin (channel, username, self) {
  if (self && channel === "#" + username) {

    //This is to prevent "UnhandledPromiseRejectionWarning: No response from Twitch." if you are doing stuff too fast
    if (this === clientDedicated) {
    setTimeout(function () { updateChannels() }, 1000)
    } else {
      setTimeout(function () { updateChannels() }, 0)
    }

    setInterval(function () { updateChannels() }, 60000)

    messageHandler.updateCommandObjects()
    setInterval(function () { messageHandler.updateCommandObjects() }, 60000)
  }
}

function onChat (channel, userstate, message, self) {
  // Don't listen to my own messages.. for now
  //if (self) { return }
  log(this, channel + " " + userstate.username + ": " + message)

  var returner = messageHandler.handle(channel, userstate, message, getUserLevel(channel, userstate))
  if (returner !== null) {
    var returnType = returner.returnType
    var returnMessage = returner.returnMessage

    returnMessage = parameterHandler.checkAndReplace({message: returnMessage, userstate: userstate, channel: channel, uptime: process.uptime(), command: returner.command})
    if (returnMessage.includes('{nl}')) {
      let client = this
      returnMessage.split('{nl}').forEach( function (returnMessageElement) {
        returnMessageElement = returnMessageElement.trim()
        sendMessage(client, channel, userstate.username, returnMessageElement)
      })
    } else {
      sendMessage(this, channel, userstate.username, returnMessage)
    }

    if (returnType === "shutdown") {
      setTimeout(function () {
        clientDedicated.disconnect()
        clientSelf.disconnect()
        process.exit(0)
      }, 1300)
    }
  }
}

function onSubscription (channel, username, method, message, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(this, channel, username, "forsen1 forsen2 " + username)
    sendMessage(this, channel, username, "forsen3 forsen4 Clap")
  }
}

function onResub (channel, username, months, message, userstate, methods) {
  if (channel === "#theonemanny") {
    let timeunits = ["nanoseconds", "microseconds", "milliseconds", "seconds", "minutes", "hours", "decades", "centuries", "millennia"]
    let timeunit = timeunits[Math.floor(Math.random() * timeunits.length)]

    sendMessage(this, channel, username, "nan1 nan2 " + username + " resubbed for " + months + " " + timeunit)
    sendMessage(this, channel, username, "nan3 nan4 GuitarTime")
  }
}

function onSubgift (channel, username, recipient, method, message, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(this, channel, username, username + " nymnGun cadyK forsenGun " + recipient)
  }
}

function onGiftpaidupgrade (channel, username, sender, promo, userstate) {
  if (channel === "#theonemanny") {
    sendMessage(this, channel, username, username + " pupperAL pupperSmile pupperAR " + sender)
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
  [clientDedicated, clientSelf].forEach( function (clientElement) {
    if (clientElement.getOptions().enabled) {
      var sql = "SELECT * FROM channels where self = b'1'"
      if (clientElement === clientDedicated) {
        sql = "SELECT * FROM channels where dedicated = b'1'"
      }

      mysqlConnection.query(
        sql,
        function (err, results, fields) {
          var channelsFromDB = ["#" + clientElement.getUsername()]
          results.forEach( function (element) {
            channelsFromDB.push("#" + element.channelName)
          })

          clientElement.getChannels().forEach( function (element) {
            if (!channelsFromDB.includes(element)) {
              clientElement.part(element)
              console.log(timeStamp() + " LEAVING: " + element)
            }
          })

          channelsFromDB.forEach( function (element) {
            if (!clientElement.getChannels().includes(element)) {
              clientElement.join(element)
              console.log(timeStamp() + " JOINING: " + element)
            }
          })
        }
      )

    }
  })
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

function sendMessage (client, channel, username, message) {

  var delay = (client.getUsername() === username && !client.isMod(channel, client.getUsername())) ? 1250 : 0

  setTimeout(function () {

    var currentTimeMillis = new Date().getTime()

    //more than 1250ms since last message
    if (lastMessageTime + 1225 < currentTimeMillis || client.isMod(channel, client.getUsername())) {
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
        console.log(timeStamp() + " ratelimit: 20 messages in past " + (currentTimeMillis - pastMessages[0]) + "ms")
      }

    } else {
      console.log(timeStamp() + " ratelimit: Too fast as pleb " + (currentTimeMillis - lastMessageTime) + "ms")
    }

  }, delay)
}

function timeStamp () {
  var datetime = new Date().toISOString()
  return "[" + datetime.slice(0,10) + " " + datetime.slice(-13, -5) + "]"
}

function log (client, message) {
  if (previousLogMessage !== message) {
    console.log(timeStamp() + " " + message)
    previousLogMessage = message
  }
}
