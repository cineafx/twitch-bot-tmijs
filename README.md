# twitch-bot-tmijs


## example config.json template

```json
{
  "mysqloptions": {
    "host": "example.com",
    "user": "exampleuser",
    "password": "examplepassword"
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
    "channels": ["#username", "#channel2"]
  }
}
```
