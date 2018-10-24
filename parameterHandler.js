const apiRegExp = new RegExp("\\${api=(.*?)}", 'i')

const request = require('request')

module.exports = {
  checkAndReplace: checkAndReplace,
  api: api,
  wolframAlphaApi: wolframAlphaApi
}

function checkAndReplace (data) {
  var message = data.message
  data.returnMessage = data.message

  user(data)
  channel(data)
  uptime(data)
  timesUsed(data)

  if (!api(data)) {
    messageCallback(data.client, data.channel, data.userstate, data.returnMessage, data.returnType)
  }
}

function user (data) {
  if (data.returnMessage.includes("${user}")) {
    data.returnMessage = data.returnMessage.replace(new RegExp("\\${user}", 'g'), data.userstate.username)
  }
}

function channel (data) {
  if (data.returnMessage.includes("${channel}")) {
    data.returnMessage = data.returnMessage.replace(new RegExp("\\$\\{channel\\}", 'g'), data.channel)
  }
}

function uptime (data) {
  if (data.returnMessage.includes("${uptime}")) {
    var time = process.uptime()
    var uptime = (time + "").toDDHHMMSS()
    data.returnMessage = data.returnMessage.replace(new RegExp("\\$\\{uptime\\}", 'g'), uptime)
  }
}

function timesUsed (data) {
  if (data.returnMessage.includes("${timesUsed}")) {
    data.returnMessage = data.returnMessage.replace(new RegExp("\\$\\{timesUsed\\}", 'g'), data.command.timesUsed)
  }
}

function api (data) {

  if (apiRegExp.test(data.returnMessage)) {
    let apiUrl = data.returnMessage.match(apiRegExp)[1]
    let apiMethod = "GET"
    let apiClientId = data.client.getOptions().options.clientId

    data.client.api({
      url: apiUrl,
      method: apiMethod,
      headers: {
        "Client-ID": apiClientId
      }
    }, function (err, res, body) {
      if (err == null) {
        data.returnMessage = data.returnMessage.replace(new RegExp(apiRegExp, 'g'), body)
      } else {
        data.returnMessage = data.returnMessage.replace(new RegExp(apiRegExp, 'g'), err)
      }

        messageCallback(data.client, data.channel, data.userstate, data.returnMessage, data.returnType)
    })

    return true
  } else {
    return false
  }
}

function wolframAlphaApi (data) {
  //https://api.wolframalpha.com/v1/result?i=" +  + "&appid=" + asdf
  let input = data.input.allParameter

  let apiUrl = "https://api.wolframalpha.com/v1/result?i=" + encodeURIComponent(input) + "&appid=" + waAppid

  request({
    url: apiUrl,
    method: "GET"
  }, function (err, res, body) {
    data.returnMessage = "Query returned: "
    if (err == null) {
      data.returnMessage += body
    } else {
      data.returnMessage += err
    }

    messageCallback(data.client, data.channel, data.userstate, data.returnMessage, data.returnType)
  })
}

String.prototype.toDDHHMMSS = function () { // eslint-disable-line
    var secNum = parseInt(this, 10) // don't forget the second param
    var days = Math.floor(secNum / 86400)
    var hours = Math.floor((secNum - (days * 86400)) / 3600)
    var minutes = Math.floor((secNum - (days * 86400) - (hours * 3600)) / 60)
    var seconds = secNum - (days * 86400) - (hours * 3600) - (minutes * 60)

    /*
    if (hours < 10) { hours = "0" + hours }
    if (minutes < 10) { minutes = "0" + minutes }
    if (seconds < 10) { seconds = "0" + seconds }
    */

    var time = seconds + 's'
    if (minutes > 0 || hours > 0) {
      time = minutes + 'm ' + time
    }
    if (hours > 0) {
      time = hours + 'h ' + time
    }
    if (days > 0) {
      time = days + 'd ' + time
    }
    return time
}
