const emojiReg = new RegExp("[\uD83C-\uDBFF\uDC00-\uDFFF]{2}", 'g')
const noneForsenApiReg = new RegExp("poggers|hypers|ResidentSleeper|poggers|hypers|pogu|ResidentSleeper|twitch\.tv\/|blood", 'ig')
const request = require('request');

module.exports = {
  handle: handle,
  forsenApi: forsenApi
}

function handle (client, channel, userstate, message, userLevel) {

  let emojiCounter = emojiCount(message)

  if (emojiCounter > 25) {
    modAction (client, channel, userstate.username, message, userLevel, {"permanent":false, "length":1, "name":"EmojiSpam",	"phrase":emojiCounter})
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

function forsenApiCallback (args) {
  if (!args.allow && args.messageObj.userLevel < 2) {
    modAction (args.messageObj.client,
      args.messageObj.channel,
      args.messageObj.username,
      args.messageObj.message,
      args.messageObj.userLevel,
      args.banphrase_data)
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
          modAction (callbackMetaData.args.messageObj.client,
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
        callbackMetaData.args.banphrase_data = body.banphrase_data
      }
    } else {
      callbackMetaData.args.allow = true
    }
    callbackMetaData.callback(callbackMetaData.args)
  });
}

function modAction (client, channel, username, message, userLevel, banphrase_data) {


  mysqlConnection.execute(
    "INSERT INTO `IceCreamDataBase`.`modActionLog` (`clientUsername`, `channelID`, `username`, `message`, `userLevel`, `timeoutLength`, `reason`) VALUES (?, ?, ?, ?, ?, ?, ?);",
    [client.getUsername(), channels[channel].ID, username, message, userLevel, banphrase_data.length, banphrase_data.name + ": " + banphrase_data.phrase]
  )


  if (banphrase_data.length >= 0) {
    console.log("👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇")
    console.log("👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇")
    console.log("Would have timed " + username + " out. (" + banphrase_data.name + ": " + banphrase_data.phrase + ")")
    console.log(message)
    console.log("👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆")
    console.log("👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆")

    banphrase_data.length = 1
    //client.timeout(channel, username, banphrase_data.length, "Matched banphrase: " + banphrase_data.name)
  }
}
