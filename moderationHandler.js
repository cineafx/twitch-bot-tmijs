const emojiReg = new RegExp("[\uD83C-\uDBFF\uDC00-\uDFFF]{2}", 'g')
const brailleReg = new RegExp("[\u2800-\u28FF]", 'g')
const noneForsenApiReg = new RegExp("poggers|hypers|ResidentSleeper|poggers|hypers|pogu|ResidentSleeper|twitch\.tv\/|blood|feelsweirdman|nymn|RaccAttack|gift|#|enigma|cmonBruh|kkk|report", 'ig') // eslint-disable-line
const request = require('request')

module.exports = {
  handle: handle,
  forsenApi: forsenApi
}

function handle (client, channel, userstate, message, userLevel) {

  let emojiCounter = emojiCount(message)

  if (emojiCounter > 30 && userLevel < 3) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "EmojiSpam",	"phrase": emojiCounter})
  }

  let brailleCounter = brailleCount(message)

  if (brailleCounter > 65 && userLevel < 3) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "BrailleSpam",	"phrase": brailleCounter})
  }

  forsenApi(message, {callback: forsenApiCallback, args: {allow: false, messageObj: {client: client, channel: channel, username: userstate.username, message: message, userLevel: userLevel}}}, false)

}

function emojiCount (message) {
  let emojiMatch = message.match(emojiReg)

  if (emojiMatch !== null) {
    return emojiMatch.length
  } else {
    return 0
  }
}

function brailleCount (message) {
  let brailleMatch = message.match(brailleReg)

  if (brailleMatch !== null) {
    return brailleMatch.length
  } else {
    return 0
  }
}

function forsenApiCallback (args) {
  if (!args.allow && args.messageObj.userLevel < 2) {
    modAction(args.messageObj.client,
      args.messageObj.channel,
      args.messageObj.username,
      args.messageObj.message,
      args.messageObj.userLevel,
      args.banphraseData)
  }
}

/**
 * Checks if a message would get you banned in forsenes chat
 * @param  String message          message to check
 * @param  {object} callbackMetaData {callback: callbackFunction, args: {allow: false, messageObj: {client: x, channel: x, username: x, message: x, userLevel: x}}}
 * @param  boolean logIfBanned should write a log message if contains something banned
 */
function forsenApi (message, callbackMetaData, logIfBanned) {
  //Stuff that should not be flagged by the forsenApi
  message = message.replace(noneForsenApiReg, "")

  request({
    url: "https://forsen.tv/api/v1/banphrases/test",
    method: "POST",
    json: true,
    body: {
      "message": message
    }
  }, function (err, res, body) {
    if (err === null) {
      if (!body.banned) {
        callbackMetaData.args.allow = true
      } else {
        console.log(JSON.stringify(body))

        if (logIfBanned) {
          modAction(callbackMetaData.args.messageObj.client,
            callbackMetaData.args.messageObj.channel,
            callbackMetaData.args.messageObj.username,
            callbackMetaData.args.messageObj.message,
            callbackMetaData.args.messageObj.userLevel,
            -1,
            "logIfBanned")

          console.log("-------------------------------------------------------")
          console.log("‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼")
          console.log("-------------------------------------------------------")
          console.log("Client:    " + callbackMetaData.args.messageObj.client.getUsername())
          console.log("Channel:   " + callbackMetaData.args.messageObj.channel)
          console.log("Username:  " + callbackMetaData.args.messageObj.username)
          console.log("Message:   " + callbackMetaData.args.messageObj.message)
          console.log("UserLevel: " + callbackMetaData.args.messageObj.userLevel)
          console.log("-------------------------------------------------------")
          console.log("‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼")
          console.log("-------------------------------------------------------")
        }
        callbackMetaData.args.allow = false
        callbackMetaData.args.banphraseData = body["banphrase_data"]
      }
    } else {
      callbackMetaData.args.allow = true
    }
    callbackMetaData.callback(callbackMetaData.args)
  })
}

function modAction (client, channel, username, message, userLevel, banphraseData) {


  mysqlConnection.execute(
    "INSERT INTO `IceCreamDataBase`.`modActionLog` (`clientUsername`, `channelID`, `username`, `message`, `userLevel`, `timeoutLength`, `reason`) VALUES (?, ?, ?, ?, ?, ?, ?);",
    [client.getUsername(), channels[channel].ID, username, message, userLevel, banphraseData.length, banphraseData.name + ": " + banphraseData.phrase]
  )


  if (banphraseData.length >= 0) {
    console.log("👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇")
    console.log("👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇")
    console.log("Would have timed " + username + " out. (" + banphraseData.name + ": " + banphraseData.phrase + ")")
    console.log(message)
    console.log("👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆")
    console.log("👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆")

    banphraseData.length = 1

    if (["EmojiSpam", "BrailleSpam"].includes(banphraseData.name)) {
      client.timeout(channel, username, banphraseData.length, "Matched banphrase: " + banphraseData.name)
    }

  }
}
