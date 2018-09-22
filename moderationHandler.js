const emojiReg = new RegExp("[\uD83C-\uDBFF\uDC00-\uDFFF]{2}", 'g')
const noneForsenApiReg = new RegExp("poggers|hypers|ResidentSleeper|poggers|hypers|ResidentSleeper|clips\.twitch\.tv\/", 'ig')
const request = require('request');

module.exports = {
  handle: handle,
  forsenApi: forsenApi
}

function handle (client, channel, userstate, message, userLevel) {

  let emojiCounter = emojiCount(message)

  if (emojiCounter > 25) {
    console.log()
    console.log("👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇")
    console.log("Would have timed " + userstate.username + " out. (Too many emojis: " + emojiCounter + " emoji character used.")
    console.log("👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆")
    console.log()
    //args.messageObj.client.timeout(channel, userstate.username, 1, "Too many emojis: " + emojiCounter + " emoji character used.")
  }

  forsenApi(message, {callback: modAction, args: {allow: false, messageObj: {client: client, channel: channel, username: userstate.username, message: message, userLevel: userLevel}}}, false)

}

function emojiCount (message) {
  let emojiMatch = message.match(emojiReg)

  if (emojiMatch !== null) {
    return emojiMatch.length
  } else {
    return 0
  }
}

function modAction (args) {
  if (!args.allow && args.messageObj.userLevel < 2) {
    console.log()
    console.log("👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇 👇")
    console.log("Would have timed " + args.messageObj.username + " out. (Messaged mached automatic filter)")
    console.log(args.messageObj.message)
    console.log("👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆 👆")
    console.log()
    //args.messageObj.client.timeout(args.messageObj.channel, args.messageObj.username, 1, "Messaged matched automatic filter")
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
        if (logIfBanned) {
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
      }
    } else {
      callbackMetaData.args.allow = true
    }
    callbackMetaData.callback(callbackMetaData.args)
  });
}
