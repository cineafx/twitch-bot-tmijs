module.exports = {
  checkAndReplace: function (data) {
    var message = data.message
    var uptime = data.uptime

    if (message.includes("$(uptime)")) {
      var time = process.uptime()
      var uptime = (time + "").toHHMMSS()
      message = message.replace("$(uptime)", uptime);
    }

    return message
  },
  check: function () {
    //asdf
  },
  replace: function () {
    //asdf
  }
}

String.prototype.toHHMMSS = function () { // eslint-disable-line
    var secNum = parseInt(this, 10) // don't forget the second param
    var hours = Math.floor(secNum / 3600)
    var minutes = Math.floor((secNum - (hours * 3600)) / 60)
    var seconds = secNum - (hours * 3600) - (minutes * 60)

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
    return time
}
