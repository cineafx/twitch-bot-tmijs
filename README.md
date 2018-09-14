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
    "admins": ["12345678", "456789123"],
    "dedicated": {
      "enabled": true,
      "options": {
          "debug": false
      },
      "connection": {
          "reconnect": true
      },
      "identity": {
          "username": "username",
          "password": "oauth:xxx"
      }
    },
    "self": {
      "enabled": true,
      "options": {
          "debug": false
      },
      "connection": {
          "reconnect": true
      },
      "identity": {
          "username": "username",
          "password": "oauth:xxx"
      }    
    }
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

  else if (msgid == 'giftpaidupgrade') {
      var username = message.tags["display-name"] || message.tags["login"];
      var sender = message.tags["msg-param-sender-name"] || message.tags["msg-param-sender-user-name"];
      var promoName = message.tags["msg-param-promo-name"];
      var giftTotal = message.tags["msg-param-promo-gift-total"];

      var userstate = message.tags;
       if (userstate) {
          userstate['message-type'] = 'giftpaidupgrade';
      }
       this.emit("giftpaidupgrade", channel, username, sender, {giftTotal, promoName}, userstate);
  }
```
```js
break;
```
