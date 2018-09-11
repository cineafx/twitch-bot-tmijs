# twitch-bot-tmijs


## example config.json template

```json
{
  "mysqloptions": {
    "host": "example.com",
    "user": "exampleuser",
    "password": "examplepassword",
    "database": "exampledatabase"
  },
  "clientoptions": {
    "options": {
        "debug": true
    },
    "connection": {
        "reconnect": true
    },
    "identity": {
        "username": "username",
        "password": "oauth:xxx"
    },
    "admins": ["12345678", "456789123"]
  }
}
```
&nbsp;

&nbsp;
---
This is a custom addition to `node_modules/tmi.js/lib/client.js` in the usernotice part
```js
// Handle subanniversary / resub..
case "USERNOTICE":
  if (msgid === "resub") {
    /*XXX*/
  }

    // Handle sub
  else if (msgid == "sub") {
    /*XXX*/
  }
```
```js
  else if (msgid == 'subgift') {
    var username = message.tags["display-name"] || message.tags["login"];
    var recipient = message.tags["msg-param-recipient-display-name"] || message.tags["msg-param-recipient-user-name"];
    var plan = message.tags["msg-param-sub-plan"];
    var planName = _.replaceAll(_.get(message.tags["msg-param-sub-plan-name"], null), {
      "\\\\s": " ",
      "\\\\:": ";",
      "\\\\\\\\": "\\",
      "\\r": "\r",
      "\\n": "\n"
    });
    var userstate = message.tags;
     if (userstate) {
      userstate['message-type'] = 'subgift';
    }
     this.emit("subgift", channel, username, recipient, {plan, planName}, userstate);
  }
```
```js
break;```
