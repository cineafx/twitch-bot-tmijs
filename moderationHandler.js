const emojiReg = new RegExp("[\uD83C-\uDBFF\uDC00-\uDFFF]{2}", 'g')
const request = require('request');

module.exports = {
  handle: handle,
  forsenApi: forsenApi
}

function handle (client, channel, userstate, message, userLevel) {

  let emojiCounter = emojiCount(message)

  //forsenApi(message)

  return false
}

function emojiCount (message) {
  let emojiMatch = message.match(emojiReg)

  if (emojiMatch !== null) {
    return emojiMatch.length
  } else {
    return 0
  }
}

/**
 * Checks if a message would get you banned in forsenes chat
 * @param  {[type]} message          message to check
 * @param  {[type]} callbackMetaData {callback: callbackFunction, args: [1,2,3]}
 */
function forsenApi (message, callbackMetaData) {
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
        console.log("---------------------------------------------------------")
        console.log("‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼")
        console.log("---------------------------------------------------------")
        console.log("BANNED PHRASE IN MESSAGE: " + body.input_message)
        console.log("---------------------------------------------------------")
        console.log(Object.values(callbackMetaData.args.messageObj).join("\n"))
        console.log("---------------------------------------------------------")
        console.log("‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼ ‼")
        console.log("---------------------------------------------------------")
        callbackMetaData.args.allow = false
      }
    } else {
      callbackMetaData.args.allow = true
    }
    callbackMetaData.callback(callbackMetaData.args)
  });
}
