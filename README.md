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
In `clientOverwrite.js` is a custom addition to tmi.js for `subgift` and `giftpaidupgrade`.
