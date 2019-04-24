var tmi = require("tmi.js")
const EventEmitter = require('events')
const request = require('request')

//import of
const messageHandler = require(__dirname + '/messageHandler.js')
const moderationHandler = require(__dirname + '/moderationHandler.js')
const clientOverwrite = require(__dirname + '/clientOverwrite.js')
global.mysqlConnection = require(__dirname + '/sql.js')

//Message queue
class QueueEmitter extends EventEmitter {}
const queueEmitter = new QueueEmitter()
global.messageQueue = []
global.queueOverwrite = false

//regex
const nlRegEx = new RegExp("{nl\\d*}", 'ig')
const delayRegEx = new RegExp("\\d*}", 'ig')

//enums
global.userLevels = Object.freeze({"DEFAULT": 0, "PLEB": 0, "USER": 0, "SUB": 1, "SUBSCRIBER": 1, "VIP": 2, "MOD": 3, "MODERATOR": 3, "BROADCASTER": 4, "BOTADMIN": 5})

const timeunits = ["nanoseconds", "microseconds", "milliseconds", "seconds", "minutes", "hours", "decades", "centuries", "millennia"]

//other variables
var pastMessages = []
var addSpecialCharacter = {}
var lastMessageTime = 0
var firstConnect = true
global.globalCommandObject = {}
global.localCommandObject = {}
global.channels = {}

//options
var options = require('./config.json')
options.clientoptions.dedicated.channels = []
options.clientoptions.self.channels = []

//make wolfram alpha appid global
global.waAppid = options.waoptions.appid

//overwrite part of the original client.js
tmi.client.prototype.handleMessage = clientOverwrite.handleMessage

//creating clients
var clientDedicated = new tmi.client(options.clientoptions.dedicated)
var clientSelf = new tmi.client(options.clientoptions.self)

// Connect the clients to the server..

if (options.clientoptions.dedicated.enabled) {
  clientDedicated.connect()

  clientDedicated.on("connected", onConnect)
  clientDedicated.on("chat", onChat)
  clientDedicated.on("subscription", onSubscription)
  clientDedicated.on("resub", onResub)
  clientDedicated.on("subgift", onSubgift)
  clientDedicated.on("submysterygift", onSubmysterygift)
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
  clientSelf.on("submysterygift", onSubmysterygift)
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

    updateChannels().then(()=>{
      setInterval(updateChannels, 60000)

      messageHandler.updateCommandObjects()
      setInterval( messageHandler.updateCommandObjects, 60000)

      updateChatters()
      setInterval(updateChatters, 30000)
    }, (reason)=>{
      console.error(Error(reason))
      process.exit()
    })
  }
}

function onChat (channel, userstate, message, self) {
  if (channel === "#skynetcentral") {
    customLog("SkynetCentral: " + message)
    return
  }

  let userLevel = getUserLevel(channel, userstate)
  if (channels[channel.toLowerCase()].shouldModerate) {
    //moderationHandler.handle(this, channel, userstate, message, userLevel)
  }

  if (!channels[channel.toLowerCase()].useCommands) { return }
  messageLog(this, channel, userstate.username, message, userLevel, channels[channel.toLowerCase()].shouldModerate)
  messageHandler.handle(this, channel, userstate, message, userLevel)
}

function onSubscription (channel, username, methods, message, userstate) {
  let data = {channel: channel, username: username}
  methods.type = "sub"
  let announcementMessage = methodToMessage(channel, methods)
  if (announcementMessage) {
    announcementMessage = notificationParameter(announcementMessage, data)
    messageCallback(this, channel, userstate, announcementMessage, "notifications")
  }
}

function onResub (channel, username, months, message, userstate, methods) {
  let data = {channel: channel, username: username, months: months}
  methods.type = "resub"
  let announcementMessage = methodToMessage(channel, methods)
  if (announcementMessage) {
    announcementMessage = notificationParameter(announcementMessage, data)
    messageCallback(this, channel, userstate, announcementMessage, "notifications")
  }
}

function onSubgift (channel, username, recipient, methods, message, userstate) {
  let data = {channel: channel, username: username, recipient: recipient}
  methods.type = "subGift"
  let announcementMessage = methodToMessage(channel, methods)
  if (announcementMessage) {
    announcementMessage = notificationParameter(announcementMessage, data)
    messageCallback(this, channel, userstate, announcementMessage, "notifications")
  }
}

function onSubmysterygift (channel, username, methods, massGiftCount, senderCount, userstate) {

  let data = {channel: channel, username: username, massGiftCount: massGiftCount, senderCount: senderCount}
  methods.type = "subMysteryGift"
  let announcementMessage = methodToMessage(channel, methods)
  if (announcementMessage) {
    announcementMessage = notificationParameter(announcementMessage, data)
    messageCallback(this, channel, userstate, announcementMessage, "notifications")
  }
}

function onGiftpaidupgrade (channel, username, sender, promo, userstate) {
  let data = {channel: channel, username: username, sender: sender}
  let methods = {type: "giftPaidUpgrade"}
  let announcementMessage = methodToMessage(channel, methods)
  if (announcementMessage) {
    announcementMessage = notificationParameter(announcementMessage, data)
    messageCallback(this, channel, userstate, announcementMessage, "notifications")
  }
}

function onElse (channel, message) {
  //filter out raids
  if (!JSON.stringify(message).includes("msg-id=raid;")) {
    customLog("Else: " + channel + ": " + JSON.stringify(message))
  }
}

/* -------------------------------------------------- */
/* -------------------------------------------------- */
/* ---------------- OTHER FUNCTIONS ----------------- */
/* -------------------------------------------------- */
/* -------------------------------------------------- */

function methodToMessage (channel, methods) {
  //{"prime":true,"plan":"Prime","planName":"Channel Subscription (forsenlol)"}
  //{"prime":false,"plan":"1000","planName":"Channel Subscription (forsenlol)"}
  //{"plan":"1000","planName":"Channel Subscription (forsenlol)"}
  let announcementMessage = ""

  if (methods.type === "sub" || methods.type === "resub") {
    let plans = ["Prime", "1000", "2000", "3000"]
    let planMsgs = new Array(4).fill(null)

    if (methods.type === "sub") {
      let subPrime = channels[channel].subPrime || null
      let subT1 = channels[channel].subT1 || null
      let subT2 = channels[channel].subT2 || subT1
      let subT3 = channels[channel].subT3 || subT2
      planMsgs = [subPrime, subT1, subT2, subT3]
    } else {
      let resubPrime = channels[channel].resubPrime || null
      let resubT1 = channels[channel].resubT1 || null
      let resubT2 = channels[channel].resubT2 || resubT1
      let resubT3 = channels[channel].resubT3 || resubT2
      planMsgs = [resubPrime, resubT1, resubT2, resubT3]
    }
    announcementMessage = planMsgs[plans.indexOf(methods.plan)]

  } else if (methods.type === "subGift") {
    announcementMessage = channels[channel].subGift || null

  } else if (methods.type === "subMysteryGift") {
    announcementMessage = channels[channel].subMysteryGift || null

  } else if (methods.type === "giftPaidUpgrade") {
    announcementMessage = channels[channel].giftPaidUpgrade || null
  }

  return announcementMessage
}

function notificationParameter (message, data) {
  //customLog(JSON.stringify(data))

  let channel = data.channel.substring(1) || null
  let username = data.username || null
  let secondUser = data.recipient || data.sender || null
  let months = data.months || 0
  let massGiftCount = parseInt(data.massGiftCount) || 0
  let senderCount = parseInt(data.senderCount) || 0
  let timeunit = timeunits[Math.floor(Math.random() * timeunits.length)]
  let extraS = months === 1 ? "" : "s"

  message = message.replace(new RegExp("\\${channel}", 'g'), channel)
  message = message.replace(new RegExp("\\${user}", 'g'), username)
  message = message.replace(new RegExp("\\${secondUser}", 'g'), secondUser)
  message = message.replace(new RegExp("\\${months}", 'g'), months)
  message = message.replace(new RegExp("\\${massGiftCount}", 'g'), massGiftCount)
  message = message.replace(new RegExp("\\${senderCount}", 'g'), senderCount)
  message = message.replace(new RegExp("\\${timeunit}", 'g'), timeunit)
  message = message.replace(new RegExp("\\${extraS}", 'g'), extraS)

  return message
}

async function updateChatters () {
  for (var channelKey in channels) {
    if (channels.hasOwnProperty(channelKey)) {
      let channelName = channelKey

      if (channelName.startsWith("#")) {
        channelName = channelName.substring(1).toLowerCase()
      }
      var chattersUrl = "https://tmi.twitch.tv/group/user/" + channelName + "/chatters"
      request({
        url: chattersUrl,
        method: "GET",
        JSON: true
      }, function (err, res, body) {
        if (err == null) {
          channels["#" + channelName].chatters = JSON.parse(body)
        }
      })
    }
  }
}

async function updateChannels () {

  let results = await mysqlConnection.query(
    "SELECT * FROM channels LEFT JOIN notifications ON ID = channelID;")
  //clears old channels array
  channels = {}
  //fill channel array
  results.forEach( function (element) {
    element.channelName = "#" + element.channelName.trim().toLowerCase()
    channels[element.channelName] = element
  })

  //remove
  if (options.clientoptions.dedicated.enabled) {
    clientDedicated.getChannels().forEach( function (element) {
      if (!(Object.keys(channels).includes(element) && channels[element].dedicated)) {
        clientDedicated.part(element)
        console.log(timeStamp() + " " + clientDedicated.getUsername() + " LEAVING: " + element)
      }
    })
  }
  if (options.clientoptions.self.enabled) {
    clientSelf.getChannels().forEach( function (element) {
      if (!(Object.keys(channels).includes(element) && channels[element].self)) {
        clientSelf.part(element)
        console.log(timeStamp() + " " + clientSelf.getUsername() + " LEAVING: " + element)
      }
    })
  }

  //add
  for (channel of Object.keys(channels)) {
    channel = channels[channel]
    if (options.clientoptions.dedicated.enabled && channel.dedicated) {
      if (!clientDedicated.getChannels().includes(channel.channelName)) {
        clientDedicated.join(channel.channelName)
        console.log(timeStamp() + " " + clientDedicated.getUsername() + " JOINING: " + channel.channelName)
      }
    }
    if (options.clientoptions.self.enabled && channel.self) {
      if (!clientSelf.getChannels().includes(channel.channelName)) {
        clientSelf.join(channel.channelName)
        console.log(timeStamp() + " " + clientSelf.getUsername() + " JOINING: " + channel.channelName)
      }
    }
    await (() => { return new Promise(resolve => setTimeout(resolve, 75)) })()
  }
  return Promise.resolve(1)
}

async function cleanupGlobalTimeout () {
  while (pastMessages.length > 0 && pastMessages[0] + 30000 < new Date().getTime()) {
    pastMessages.shift()
  }
}

function checkGlobalTimeout (client, higherRate) {
  let plebRatelimit = 20
  let modRatelimit = 100
  //stupid hardcode ... bot 2.0 is going to be there at some point *TODO*
  if (client.getUsername().toLowerCase() === "icecreamdatabase") {
    modRatelimit = 7500
  }
  if (pastMessages.length < (higherRate ? modRatelimit : plebRatelimit)) {
    console.log(pastMessages.length + " message(s) in the past 30 seconds (Current limit: " + (higherRate ? modRatelimit : plebRatelimit) + ")")

    return false
  } else {
    return true
  }
}

function getUserLevel (channel, userstate) {
  var userLevel = userLevels.PLEB
  if (options.clientoptions.admins.includes(userstate["user-id"])) {
    userLevel = userLevels.BOTADMIN
  } else if (channel === '#' + userstate.username) {
    userLevel = userLevels.BROADCASTER
  } else if (userstate.mod) {
    userLevel = userLevels.MODERATOR
  } else if (userstate.hasOwnProperty('badges') && userstate.hasOwnProperty('vip') && userstate.badges.vip === "1") {
    userLevel = userLevels.VIP
  } else if (userstate.subscriber) {
    userLevel = userLevels.SUBSCRIBER
  }
  return userLevel
}

global.messageCallback = function (client, channel, userstate, returnMessage, returnType) {

  if (returnType === "shutdown") {
    setTimeout(function () {
      clientDedicated.disconnect()
      clientSelf.disconnect()
      process.exit(0)
    }, 1500)
  }

  if (!queueOverwrite) {
    if (typeof userstate === "undefined" || !userstate) {
      userstate = {username: ""}
    }
    messageQueue.push({checked: false, isBeingChecked: false, allow: false, messageObj: {client: client, channel: channel, username: userstate.username, message: returnMessage}})
    queueEmitter.emit('event')
  }
}

queueEmitter.on('event', function () {
  //makes it run asynchronously
  setImmediate(function () {
    if (messageQueue.length > 0) {
      if (messageQueue[0].checked) {
        if (messageQueue[0].allow) {
          queueEmitter.emit('event')
          let msgObj = messageQueue.shift().messageObj
          handleNewLine(msgObj.client, msgObj.channel, msgObj.username, msgObj.message)
        } else {
          messageQueue.shift()
        }
      } else if (!messageQueue[0].isBeingChecked) {
        messageQueue[0].isBeingChecked = true

        messageQueue[0].allow = !moderationHandler.containsNword(messageQueue[0].messageObj.message)
        messageQueue[0].checked = true
        updateMessageQueue(messageQueue[0])
        messageQueue[0].isBeingChecked = false
        /*
        moderationHandler.forsenApi(messageQueue[0].messageObj.message, {callback: updateMessageQueue, args: messageQueue[0]}, true)
        */
      }
    }
  })
})

function updateMessageQueue (args) {
  if (messageQueue.length > 0) {
    messageQueue.forEach( function (element, index) {
      if (element.messageObj === args.messageObj) {
        messageQueue[index].checked = true
        messageQueue[index].allow = args.allow
      }
    })
  }
  queueEmitter.emit('event')
}

function handleNewLine (client, channel, username, message) {
  if (nlRegEx.test(message)) {
    let delay = !isMOD(client, channel, client.getUsername()) && !isVIP(channel, client.getUsername()) ? 1250 : 0
    let currentDelay = 0

    console.log(client.getUsername() + " " + delay)

    let regNls = message.match(nlRegEx)
    let regDelay = message.match(delayRegEx)
    //this is simply needed to not cause errors later at currentDelay += regDelay[index]
    //message.split is 1 longer than regDelay --> would throw array out of bound
    regDelay.push('{nl}')

    //get the raw number from {nlXXXX}
    //if only {nl} return 0
    regDelay.forEach( function (element, index) {
      regDelay[index] = parseInt(element) || 0
    })

    message.split(nlRegEx).forEach( function (messageElement, index) {
      messageElement = messageElement.trim()
      setTimeout(function () {
        sendMessage(client, channel, username, messageElement)
      }, currentDelay)

      currentDelay += regDelay[index]
      //only add the "pleb delay" if pleb.
      if (regDelay[index] < delay) {
        //Imagine regDelay[index] is 1000ms and delay is 1250ms
        //because the 1000ms where already added earlier now only the delay of 250 needs to be added
        currentDelay += delay - regDelay[index]
      }
    })
  } else {
    sendMessage(client, channel, username, message)
  }
}

function sendMessage (client, channel, username, message) {
  let isSelfMessage = client.getUsername() === username
  let isBotMOD = isMOD(client, channel, client.getUsername())
  let isBotVIP = isVIP(channel, client.getUsername())

  var delay = (isSelfMessage && !isBotMOD && !isBotVIP) ? 1250 : 0
  //Allows for better grouping if sending multi messages from both bots at the same time
  if (client === clientSelf) {
    delay += 50
  }

  setTimeout(function () {
    var currentTimeMillis = new Date().getTime()
    //more than 1250ms since last message
    if (lastMessageTime + 1225 < currentTimeMillis || isBotMOD || isBotVIP) {
      lastMessageTime = currentTimeMillis

      //anti global ban
      cleanupGlobalTimeout()
      if (!checkGlobalTimeout(client, isBotMOD || isBotVIP)) {
        pastMessages.push(new Date().getTime())
        var shouldAdd = addSpecialCharacter[channel] || false
        if (shouldAdd) {
          message = message + " \u2800"
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

global.timeStamp = function () {
  var datetime = new Date().toISOString()
  return "[" + datetime.slice(0, 10) + " " + datetime.slice(-13, -5) + "]"
}

function isVIP (channel, username) {
  if (channels[channel].hasOwnProperty('chatters') && channels[channel].chatters.hasOwnProperty('chatters')) {
    return channels[channel].chatters.chatters.vips.includes(username)
  } else {
    return false
  }
}

function isMOD (client, channel, username) {
  if (channels[channel].hasOwnProperty('chatters') && channels[channel].chatters.hasOwnProperty('chatters')) {
    return channels[channel].chatters.chatters.moderators.includes(username)
  } else {
    return false
  }
}

function messageLog (client, channel, username, message, userLevel, shouldModerate) {

  if (shouldModerate) {
    mysqlConnection.execute(
      "INSERT INTO messageLog (`clientUsername`, `channelID`, `username`, `message`, `userLevel`) VALUES (?, ?, ?, ?, ?);",
      [client.getUsername(), channels[channel].ID, username, message, userLevel]
    )

    mysqlConnection.execute(
      "DELETE FROM messageLog WHERE TIMESTAMPDIFF(MINUTE,`timestamp`,CURRENT_TIMESTAMP()) > 60;"
    )
  }

  console.log(timeStamp() + " " + channel + " " + username + ": " + message)
}

function customLog (message) {
  mysqlConnection.execute(
    "INSERT INTO customLog (message) VALUES (?);",
    [message]
  )

  console.log("--- " + timeStamp() + " " + message)
}
