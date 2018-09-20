var tmi = require("tmi.js")
const mysql = require('mysql2')

const messageHandler = require(__dirname + '/messageHandler.js')

var options = require('./config.json')

var pastMessages = []
var addSpecialCharacter = new Object()
var lastMessageTime = 0
var previousLogMessage = ""
var firstConnect = true
global.globalCommandObject = {}
global.localCommandObject = {}
global.channels = {}

options.clientoptions.dedicated.channels = []
options.clientoptions.self.channels = []

var clientDedicated = new tmi.client(options.clientoptions.dedicated)
var clientSelf = new tmi.client(options.clientoptions.self)

//TODO: make sure addSpeicalCharacter does NOT apply to both at the same time!!

//cast bit(1) to boolean
//https://www.bennadel.com/blog/3188-casting-bit-fields-to-booleans-using-the-node-js-mysql-driver.htm
options.mysqloptions.typeCast = function castField ( field, useDefaultTypeCasting ) {
  // We only want to cast bit fields that have a single-bit in them. If the field
  // has more than one bit, then we cannot assume it is supposed to be a Boolean.
  if ( ( field.type === "BIT" ) && ( field.length === 1 ) ) {
    var bytes = field.buffer()
    //Account for the (hopefully rare) case in which a BIT(1) field would be NULL
    if (bytes === null) {
      return null
    }
    // A Buffer in Node represents a collection of 8-bit unsigned integers.
    // Therefore, our single "bit field" comes back as the bits '0000 0001',
    // which is equivalent to the number 1.
    return ( bytes[ 0 ] === 1 )
  }
  return ( useDefaultTypeCasting() )
}

global.mysqlConnection = mysql.createConnection(options.mysqloptions)

// Connect the clients to the server..

if (options.clientoptions.dedicated.enabled) {
  clientDedicated.connect()

  clientDedicated.on("connected", onConnect)
  clientDedicated.on("chat", onChat)
  clientDedicated.on("subscription", onSubscription)
  clientDedicated.on("resub", onResub)
  clientDedicated.on("subgift", onSubgift)
  clientDedicated.on("giftpaidupgrade", onGiftpaidupgrade)
  clientDedicated.on("else", onElse)
}
if (options.clientoptions.self.enabled) {
  clientSelf.connect()

  clientSelf.on("connected", onConnect)
  clientSelf.on("chat", onChat)
  clientSelf.on("subscription", onSubscription)
  clientSelf.on("resub", onResub)
  clientSelf.on("subgift", onSubgift)
  clientSelf.on("giftpaidupgrade", onGiftpaidupgrade)
  clientSelf.on("else", onElse)
}

/* -------------------------------------------------- */
/* -------------------------------------------------- */
/* ------------------ ON FUNCTIONS ------------------ */
/* -------------------------------------------------- */
/* -------------------------------------------------- */

function onConnect (address, port) {
  if (firstConnect) {
    firstConnect = false

    if (this === clientDedicated) {
      setTimeout(function () { updateChannels() }, 1000)
    } else {
      setTimeout(function () { updateChannels() }, 100)
    }
    setInterval(function () { updateChannels() }, 60000)

    messageHandler.updateCommandObjects()
    setInterval(function () { messageHandler.updateCommandObjects() }, 60000)
  }
}

function onChat (channel, userstate, message, self) {

  if (!channels[channel.toLowerCase()].useCommands) { return }

  // Don't listen to my own messages.. for now
  //if (self) { return }
  log(this, channel + " " + userstate.username + ": " + message)

  messageHandler.handle(this, channel, userstate, message, getUserLevel(channel, userstate))
}

function onSubscription (channel, username, method, message, userstate) {
  //{"prime":true,"plan":"Prime","planName":"Channel Subscription (forsenlol)"}
  //{"prime":false,"plan":"1000","planName":"Channel Subscription (forsenlol)"}
  //{"plan":"1000","planName":"Channel Subscription (forsenlol)"}

  if (channel === "#theonemanny") {
    if (methods.plan === "prime") {
      sendMessage(this, channel, username, "forsenPrime Clap " + username)
    } else {
      sendMessage(this, channel, username, "forsen1 forsen2 " + username)
      sendMessage(this, channel, username, "forsen3 forsen4 Clap")
    }
  }
}

function onResub (channel, username, months, message, userstate, methods) {

  if (channel === "#theonemanny") {

    let timeunits = ["nanoseconds", "microseconds", "milliseconds", "seconds", "minutes", "hours", "decades", "centuries", "millennia"]
    let timeunit = timeunits[Math.floor(Math.random() * timeunits.length)]

    if (methods.plan === "prime") {
        sendMessage(this, channel, username, "forsenPrime Clap " + username + " resubbed for " + months + " " + timeunit)

    } else {
      sendMessage(this, channel, username, "nan1 nan2 " + username + " resubbed for " + months + " " + timeunit)
      sendMessage(this, channel, username, "nan3 nan4 GuitarTime")
    }
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
  return
  /*
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log(JSON.stringify(message))
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  console.log("-----------------------------------------------------------")
  */
}

/* -------------------------------------------------- */
/* -------------------------------------------------- */
/* ---------------- OTHER FUNCTIONS ----------------- */
/* -------------------------------------------------- */
/* -------------------------------------------------- */

function updateChannels () {

  mysqlConnection.query(
    "SELECT * FROM channels",
    function (err, results, fields) {
      //fill channel array
      results.forEach( function (element) {
        element.channelName = "#" + element.channelName.trim().toLowerCase()
        channels[element.channelName] = element
      })

      //remove
      clientDedicated.getChannels().forEach( function (element) {
        if (!(Object.keys(channels).includes(element) && channels[element].dedicated)) {
          clientDedicated.part(element)
          console.log(timeStamp() + " " + clientDedicated.getUsername() + " LEAVING: " + element)
        }
      })
      clientSelf.getChannels().forEach( function (element) {
        if (!(Object.keys(channels).includes(element) && channels[element].self)) {
          clientSelf.part(element)
          console.log(timeStamp() + " " + clientSelf.getUsername() + " LEAVING: " + element)
        }
      })

      //add
      Object.keys(channels).forEach( function (channel) {
        channel = channels[channel]
        if (channel.dedicated) {
          if (!clientDedicated.getChannels().includes(channel.channelName)) {
            clientDedicated.join(channel.channelName)
            console.log(timeStamp() + " " + clientDedicated.getUsername() + " JOINING: " + channel.channelName)
          }
        }
        if (channel.self) {
          if (!clientSelf.getChannels().includes(channel.channelName)) {
            clientSelf.join(channel.channelName)
            console.log(timeStamp() + " " + clientSelf.getUsername() + " JOINING: " + channel.channelName)
          }
        }
      })
    }
  )
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

global.messageCallback = function (client, channel, userstate, returnMessage, returnType) {

  if (returnMessage.includes('{nl}')) {
    returnMessage.split('{nl}').forEach( function (returnMessageElement) {
      returnMessageElement = returnMessageElement.trim()
      sendMessage(client, channel, userstate.username, returnMessageElement)
    })
  } else {
    sendMessage(client, channel, userstate.username, returnMessage)
  }

  if (returnType === "shutdown") {
    setTimeout(function () {
      clientDedicated.disconnect()
      clientSelf.disconnect()
      process.exit(0)
    }, 1300)
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
  return "[" + datetime.slice(0, 10) + " " + datetime.slice(-13, -5) + "]"
}

function log (client, message) {
  //if (previousLogMessage !== message) {
    console.log(timeStamp() + " " + message)
    previousLogMessage = message
  //}
}
