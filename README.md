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
