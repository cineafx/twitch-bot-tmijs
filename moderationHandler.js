const emojiReg = new RegExp("[\uD83C-\uDBFF\uDC00-\uDFFF]{2}", 'g')
const brailleReg = new RegExp("[\u2800-\u28FF]", 'g')
const blockReg = new RegExp("[\u2580-\u259F]", 'g')
const cyrillicPattern = new RegExp(/[\u0400-\u04FF]/, 'g')
const noneForsenApiReg = new RegExp("poggers|hypers|ResidentSleeper|pogu|twitch\.tv\/|blood|feelsweirdman|nymn|RaccAttack|gift|#|enigma|cmonBruh|kkk|report|doki|hahaa|worgen|ñ|pump", 'ig') // eslint-disable-line
const nWordReg = new RegExp(/\b(?:N|n|ñ|7V|IV)\s?[liI1y!j]\s?(?:[GgbB6934Qqğ]\s?){2,}(?!arcS|l|Ktlw|ylul)/,'g') // eslint-disable-line
const nWordReg2 = new RegExp(/\b(?:\/\\\/|N|n|ñ)\s?[liI1eyj]\s?[GgbB934Qqğ6]\s?[Ggb6B934Qqğk](?!arcS)/,'g') // eslint-disable-line
const request = require('request')

module.exports = {
  handle: handle,
  forsenApi: forsenApi,
  containsNword: containsNword
}

function handle (client, channel, userstate, message, userLevel) {

  let emojiCounter = matchCount(message, emojiReg)
  if (emojiCounter > 30 && userLevel < userLevels.MODERATOR) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "EmojiSpam",	"phrase": emojiCounter})
  }

  let brailleCounter = matchCount(message, brailleReg)
  if (brailleCounter > 45 && userLevel < userLevels.MODERATOR) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "BrailleSpam",	"phrase": brailleCounter})
  }

  let blockCounter = matchCount(message, blockReg)
  if (blockCounter > 45 && userLevel < userLevels.MODERATOR) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "BlockSpam",	"phrase": blockCounter})
  }

  if (cyrillicPattern.test(message)) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "Cyrillic letters",	"phrase": message.match(cyrillicPattern)[0]})
  }
  /*
  if (nWordReg.test(message)) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "Nword",	"phrase": message.match(nWordReg)[0]})
  }

  if (nWordReg2.test(message)) {
    modAction(client, channel, userstate.username, message, userLevel, {"permanent": false, "length": 1, "name": "Nword",	"phrase": message.match(nWordReg2)[0]})
  }
  */
  //forsenApi(message, {callback: forsenApiCallback, args: {allow: false, messageObj: {client: client, channel: channel, username: userstate.username, message: message, userLevel: userLevel}}}, false)

}

function matchCount (message, regex) {
  let matches = message.match(regex)

  if (matches !== null) {
    return matches.length
  } else {
    return 0
  }
}

function forsenApiCallback (args) {
  if (!args.allow && args.messageObj.userLevel < userLevels.MODERATOR) {
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

function containsNword (message) {
  return nWordReg.test(message) || nWordReg2.test(message)
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

    if (["EmojiSpam", "BrailleSpam", "BlockSpam", "Nword"].includes(banphraseData.name)) {
      client.timeout(channel, username, banphraseData.length, "Matched banphrase: " + banphraseData.name)
    }
  }
}
