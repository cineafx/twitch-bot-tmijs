const emojiReg = new RegExp("[\uD83C-\uDBFF\uDC00-\uDFFF]{2}", 'g')

module.exports = {
  handle: handle
}

function handle(client, channel, userstate, message, userLevel) {

  emojiCount(message)

}

function emojiCount(message) {
  let emojiMatch = message.match(emojiReg)

  if (emojiMatch !== null) {
    return emojiMatch.length
  } else {
    return 0
  }
}
