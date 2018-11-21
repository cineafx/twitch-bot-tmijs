/* eslint-disable */
var api = require("./node_modules/tmi.js/lib/api");
var commands = require("./node_modules/tmi.js/lib/commands");
var eventEmitter = require("./node_modules/tmi.js/lib/events").EventEmitter;
var logger = require("./node_modules/tmi.js/lib/logger");
var parse = require("./node_modules/tmi.js/lib/parser");
var timer = require("./node_modules/tmi.js/lib/timer");
var ws = global.WebSocket || global.MozWebSocket || require("ws");
var _ = require("./node_modules/tmi.js/lib/utils");

module.exports = {
  handleMessage: handleMessage
}

function handleMessage(message) {
    if (!_.isNull(message)) {
        var channel = _.channel(_.get(message.params[0], null));
        var msg = _.get(message.params[1], null);
        var msgid = _.get(message.tags["msg-id"], null);

        // Parse badges and emotes..
        message.tags = parse.badges(parse.emotes(message.tags));

        // Transform IRCv3 tags..
        if (message.tags) {
            for(var key in message.tags) {
                if (key !== "emote-sets" && key !== "ban-duration" && key !== "bits") {
                    if (_.isBoolean(message.tags[key])) { message.tags[key] = null; }
                    else if (message.tags[key] === "1") { message.tags[key] = true; }
                    else if (message.tags[key] === "0") { message.tags[key] = false; }
                }
            }
        }

        // Messages with no prefix..
        if (_.isNull(message.prefix)) {
            switch(message.command) {
                // Received PING from server..
                case "PING":
                    this.emit("ping");
                    if (!_.isNull(this.ws) && this.ws.readyState !== 2 && this.ws.readyState !== 3) {
                        this.ws.send("PONG");
                    }
                    break;

                // Received PONG from server, return current latency..
                case "PONG":
                    var currDate = new Date();
                    this.currentLatency = (currDate.getTime() - this.latency.getTime()) / 1000;
                    this.emits(["pong", "_promisePing"], [[this.currentLatency], [this.currentLatency]]);

                    clearTimeout(this.pingTimeout);
                    break;

                default:
                    this.log.warn(`Could not parse message with no prefix:\n${JSON.stringify(message, null, 4)}`);
                    break;
            }
        }

        // Messages with "tmi.twitch.tv" as a prefix..
        else if (message.prefix === "tmi.twitch.tv") {
            switch(message.command) {
                case "002":
                case "003":
                case "004":
                case "375":
                case "376":
                case "CAP":
                    break;

                // Retrieve username from server..
                case "001":
                    this.username = message.params[0];
                    break;

                // Connected to server..
                case "372":
                    this.log.info("Connected to server.");
                    this.userstate["#tmijs"] = {};
                    this.emits(["connected", "_promiseConnect"], [[this.server, this.port], [null]]);
                    this.reconnections = 0;
                    this.reconnectTimer = this.reconnectInterval;

                    // Set an internal ping timeout check interval..
                    this.pingLoop = setInterval(() => {
                        // Make sure the connection is opened before sending the message..
                        if (!_.isNull(this.ws) && this.ws.readyState !== 2 && this.ws.readyState !== 3) {
                            this.ws.send("PING");
                        }
                        this.latency = new Date();
                        this.pingTimeout = setTimeout(() => {
                            if (!_.isNull(this.ws)) {
                                this.wasCloseCalled = false;
                                this.log.error("Ping timeout.");
                                this.ws.close();

                                clearInterval(this.pingLoop);
                                clearTimeout(this.pingTimeout);
                            }
                        }, _.get(this.opts.connection.timeout, 9999));
                    }, 60000);

                    // Join all the channels from configuration with a 2 seconds interval..
                    var joinQueue = new timer.queue(2000);
                    var joinChannels = _.union(this.opts.channels, this.channels);
                    this.channels = [];

                    for (var i = 0; i < joinChannels.length; i++) {
                        var self = this;
                        joinQueue.add(function(i) {
                            if (!_.isNull(self.ws) && self.ws.readyState !== 2 && self.ws.readyState !== 3) {
                                self.ws.send(`JOIN ${_.channel(joinChannels[i])}`);
                            }
                        }.bind(this, i))
                    }

                    joinQueue.run();
                    break;

                // https://github.com/justintv/Twitch-API/blob/master/chat/capabilities.md#notice
                case "NOTICE":
                    switch(msgid) {
                        // This room is now in subscribers-only mode.
                        case "subs_on":
                            this.log.info(`[${channel}] This room is now in subscribers-only mode.`);
                            this.emits(["subscriber", "subscribers", "_promiseSubscribers"], [[channel, true], [channel, true], [null]]);
                            break;

                        // This room is no longer in subscribers-only mode.
                        case "subs_off":
                            this.log.info(`[${channel}] This room is no longer in subscribers-only mode.`);
                            this.emits(["subscriber", "subscribers", "_promiseSubscribersoff"], [[channel, false], [channel, false], [null]]);
                            break;

                        // This room is now in emote-only mode.
                        case "emote_only_on":
                            this.log.info(`[${channel}] This room is now in emote-only mode.`);
                            this.emits(["emoteonly", "_promiseEmoteonly"], [[channel, true], [null]]);
                            break;

                        // This room is no longer in emote-only mode.
                        case "emote_only_off":
                            this.log.info(`[${channel}] This room is no longer in emote-only mode.`);
                            this.emits(["emoteonly", "_promiseEmoteonlyoff"], [[channel, false], [null]]);
                            break;

                        // Do not handle slow_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
                        case "slow_on":
                        case "slow_off":
                            break;

                        // Do not handle followers_on/off here, listen to the ROOMSTATE notice instead as it returns the delay.
                        case "followers_on_zero":
                        case "followers_on":
                        case "followers_off":
                            break;

                        // This room is now in r9k mode.
                        case "r9k_on":
                            this.log.info(`[${channel}] This room is now in r9k mode.`);
                            this.emits(["r9kmode", "r9kbeta", "_promiseR9kbeta"], [[channel, true], [channel, true], [null]]);
                            break;

                        // This room is no longer in r9k mode.
                        case "r9k_off":
                            this.log.info(`[${channel}] This room is no longer in r9k mode.`);
                            this.emits(["r9kmode", "r9kbeta", "_promiseR9kbetaoff"], [[channel, false], [channel, false], [null]]);
                            break;

                        // The moderators of this room are [...]
                        case "room_mods":
                            var splitted = msg.split(":");
                            var mods = splitted[1].replace(/,/g, "").split(":").toString().toLowerCase().split(" ");

                            for(var i = mods.length - 1; i >= 0; i--) {
                                if(mods[i] === "") {
                                    mods.splice(i, 1);
                                }
                            }

                            this.emits(["_promiseMods", "mods"], [[null, mods], [channel, mods]]);
                            break;

                        // There are no moderators for this room.
                        case "no_mods":
                            this.emit("_promiseMods", null, []);
                            break;

                        // Channel is suspended..
                        case "msg_channel_suspended":
                            this.emits(["notice", "_promiseJoin"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Ban command failed..
                        case "already_banned":
                        case "bad_ban_admin":
                        case "bad_ban_broadcaster":
                        case "bad_ban_global_mod":
                        case "bad_ban_self":
                        case "bad_ban_staff":
                        case "usage_ban":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseBan"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Ban command success..
                        case "ban_success":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseBan"], [[channel, msgid, msg], [null]]);
                            break;

                        // Clear command failed..
                        case "usage_clear":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseClear"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Mods command failed..
                        case "usage_mods":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseMods"], [[channel, msgid, msg], [msgid, []]]);
                            break;

                        // Mod command success..
                        case "mod_success":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseMod"], [[channel, msgid, msg], [null]]);
                            break;

                        // Mod command failed..
                        case "usage_mod":
                        case "bad_mod_banned":
                        case "bad_mod_mod":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseMod"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Unmod command success..
                        case "unmod_success":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseUnmod"], [[channel, msgid, msg], [null]]);
                            break;

                        // Unmod command failed..
                        case "usage_unmod":
                        case "bad_unmod_mod":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseUnmod"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Color command success..
                        case "color_changed":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseColor"], [[channel, msgid, msg], [null]]);
                            break;

                        // Color command failed..
                        case "usage_color":
                        case "turbo_only_color":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseColor"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Commercial command success..
                        case "commercial_success":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseCommercial"], [[channel, msgid, msg], [null]]);
                            break;

                        // Commercial command failed..
                        case "usage_commercial":
                        case "bad_commercial_error":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseCommercial"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Host command success..
                        case "hosts_remaining":
                            this.log.info(`[${channel}] ${msg}`);
                            var remainingHost = (!isNaN(msg.charAt(0)) ? msg.charAt(0) : 0);
                            this.emits(["notice", "_promiseHost"], [[channel, msgid, msg], [null, ~~remainingHost]]);
                            break;

                        // Host command failed..
                        case "bad_host_hosting":
                        case "bad_host_rate_exceeded":
                        case "bad_host_error":
                        case "usage_host":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseHost"], [[channel, msgid, msg], [msgid, null]]);
                            break;

                        // r9kbeta command failed..
                        case "already_r9k_on":
                        case "usage_r9k_on":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseR9kbeta"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // r9kbetaoff command failed..
                        case "already_r9k_off":
                        case "usage_r9k_off":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseR9kbetaoff"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Timeout command success..
                        case "timeout_success":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseTimeout"], [[channel, msgid, msg], [null]]);
                            break;

                        // Subscribersoff command failed..
                        case "already_subs_off":
                        case "usage_subs_off":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseSubscribersoff"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Subscribers command failed..
                        case "already_subs_on":
                        case "usage_subs_on":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseSubscribers"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Emoteonlyoff command failed..
                        case "already_emote_only_off":
                        case "usage_emote_only_off":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseEmoteonlyoff"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Emoteonly command failed..
                        case "already_emote_only_on":
                        case "usage_emote_only_on":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseEmoteonly"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Slow command failed..
                        case "usage_slow_on":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseSlow"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Slowoff command failed..
                        case "usage_slow_off":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseSlowoff"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Timeout command failed..
                        case "usage_timeout":
                        case "bad_timeout_admin":
                        case "bad_timeout_broadcaster":
                        case "bad_timeout_duration":
                        case "bad_timeout_global_mod":
                        case "bad_timeout_self":
                        case "bad_timeout_staff":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseTimeout"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Unban command success..
                        case "unban_success":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseUnban"], [[channel, msgid, msg], [null]]);
                            break;

                        // Unban command failed..
                        case "usage_unban":
                        case "bad_unban_no_ban":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseUnban"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Unhost command failed..
                        case "usage_unhost":
                        case "not_hosting":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseUnhost"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Whisper command failed..
                        case "whisper_invalid_login":
                        case "whisper_invalid_self":
                        case "whisper_limit_per_min":
                        case "whisper_limit_per_sec":
                        case "whisper_restricted_recipient":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits(["notice", "_promiseWhisper"], [[channel, msgid, msg], [msgid]]);
                            break;

                        // Permission error..
                        case "no_permission":
                        case "msg_banned":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emits([
                                "notice",
                                "_promiseBan",
                                "_promiseClear",
                                "_promiseUnban",
                                "_promiseTimeout",
                                "_promiseMod",
                                "_promiseUnmod",
                                "_promiseCommercial",
                                "_promiseHost",
                                "_promiseUnhost",
                                "_promiseR9kbeta",
                                "_promiseR9kbetaoff",
                                "_promiseSlow",
                                "_promiseSlowoff",
                                "_promiseFollowers",
                                "_promiseFollowersoff",
                                "_promiseSubscribers",
                                "_promiseSubscribersoff",
                                "_promiseEmoteonly",
                                "_promiseEmoteonlyoff"
                            ], [
                                [channel, msgid, msg],
                                [msgid], [msgid], [msgid], [msgid],
                                [msgid], [msgid], [msgid], [msgid],
                                [msgid], [msgid], [msgid], [msgid],
                                [msgid], [msgid], [msgid], [msgid],
                                [msgid], [msgid], [msgid]
                            ]);
                            break;

                        // Unrecognized command..
                        case "unrecognized_cmd":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emit("notice", channel, msgid, msg);

                            if (msg.split(" ").splice(-1)[0] === "/w") {
                                this.log.warn("You must be connected to a group server to send or receive whispers.");
                            }
                            break;

                        // Send the following msg-ids to the notice event listener..
                        case "cmds_available":
                        case "host_target_went_offline":
                        case "msg_censored_broadcaster":
                        case "msg_duplicate":
                        case "msg_emoteonly":
                        case "msg_verified_email":
                        case "msg_ratelimit":
                        case "msg_subsonly":
                        case "msg_timedout":
                        case "no_help":
                        case "usage_disconnect":
                        case "usage_help":
                        case "usage_me":
                            this.log.info(`[${channel}] ${msg}`);
                            this.emit("notice", channel, msgid, msg);
                            break;

                        // Ignore this because we are already listening to HOSTTARGET..
                        case "host_on":
                        case "host_off":
                            //
                            break;

                        default:
                            if (msg.includes("Login unsuccessful") || msg.includes("Login authentication failed")) {
                                this.wasCloseCalled = false;
                                this.reconnect = false;
                                this.reason = msg;
                                this.log.error(this.reason);
                                this.ws.close();
                            }
                            else if (msg.includes("Error logging in") || msg.includes("Improperly formatted auth")) {
                                this.wasCloseCalled = false;
                                this.reconnect = false;
                                this.reason = msg;
                                this.log.error(this.reason);
                                this.ws.close();
                            }
                            else if (msg.includes("Invalid NICK")) {
                                this.wasCloseCalled = false;
                                this.reconnect = false;
                                this.reason = "Invalid NICK.";
                                this.log.error(this.reason);
                                this.ws.close();
                            }
                            else {
                                this.log.warn(`Could not parse NOTICE from tmi.twitch.tv:\n${JSON.stringify(message, null, 4)}`);
                            }
                            break;
                    }
                    break;

                // Handle subanniversary / resub..
                case "USERNOTICE":
                    if (msgid === "resub") {
                        var username = message.tags["display-name"] || message.tags["login"];
                        var plan = message.tags["msg-param-sub-plan"];
                        var planName = _.replaceAll(_.get(message.tags["msg-param-sub-plan-name"], null), {
                            "\\\\s": " ",
                            "\\\\:": ";",
                            "\\\\\\\\": "\\",
                            "\\r": "\r",
                            "\\n": "\n"
                        });
                        var months = _.get(~~message.tags["msg-param-months"], null);
                        var prime = plan.includes("Prime");
                        var userstate = null;

                        if (msg) {
                            userstate = message.tags;
                            userstate['message-type'] = 'resub';
                        }

                        this.emits(["resub", "subanniversary"], [
                            [channel, username, months, msg, userstate, {prime, plan, planName}],
                            [channel, username, months, msg, userstate, {prime, plan, planName}]
                        ]);
                    }

                    // Handle sub
                    else if (msgid == "sub") {
                        var username = message.tags["display-name"] || message.tags["login"];
                        var plan = message.tags["msg-param-sub-plan"];
                        var planName = _.replaceAll(_.get(message.tags["msg-param-sub-plan-name"], null), {
                            "\\\\s": " ",
                            "\\\\:": ";",
                            "\\\\\\\\": "\\",
                            "\\r": "\r",
                            "\\n": "\n"
                        });
                        var prime = plan.includes("Prime");
                        var userstate = null;

                        if (msg) {
                            userstate = message.tags;
                            userstate['message-type'] = 'sub';
                        }

                        this.emit("subscription", channel, username, {prime, plan, planName}, msg, userstate);
                    }
                    /* CUSTOM START */
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

                    else if (msgid == 'submysterygift') {
                        var username = message.tags["display-name"] || message.tags["login"];
                        var giftCount = message.tags["msg-param-mass-gift-count"];
                        var senderCount = message.tags["msg-param-sender-count"];
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
                         this.emit("submysterygift", channel, username, {plan, planName}, giftCount, senderCount, userstate);
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

                    /*

                    @badges=subscriber/24,bits/10000;color=#003153;display-name=George;emotes=;id=f7c28d8b-7939-40a8-9a09-68037deafd3b;login=george;mod=0;msg-id=submysterygift;msg-param-mass-gift-count=2;msg-param-sender-count=13;msg-param-sub-plan=1000;room-id=12519;subscriber=1;system-msg=George\sis\sgifting\s2\sTier\s1\sSubs\sto\sBwana's\scommunity!\sThey've\sgifted\sa\stotal\sof\s13\sin\sthe\schannel!;tmi-sent-ts=1533764552435;turbo=0;user-id=13074;user-type= :tmi.twitch.tv USERNOTICE #bwana
                    @badges=subscriber/24,bits/10000;color=#003153;display-name=George;emotes=;id=b297ee94-7cb8-4def-9984-c17f82805a1a;login=george;mod=0;msg-id=subgift;msg-param-months=2;msg-param-recipient-display-name=Fireman17;msg-param-recipient-id=39084634;msg-param-recipient-user-name=fireman17;msg-param-sender-count=0;msg-param-sub-plan-name=Channel\sSubscription\s(bwana);msg-param-sub-plan=1000;room-id=12519;subscriber=1;system-msg=George\sgifted\sa\sTier\s1\ssub\sto\sFireman17!;tmi-sent-ts=1533764553373;turbo=0;user-id=13074;user-type= :tmi.twitch.tv USERNOTICE #bwana
                    @badges=subscriber/24,bits/10000;color=#003153;display-name=George;emotes=;id=ffef7029-23ed-4b5a-bf69-4a6e86af57c1;login=george;mod=0;msg-id=subgift;msg-param-months=2;msg-param-recipient-display-name=CptBlowUpDoll;msg-param-recipient-id=154238603;msg-param-recipient-user-name=cptblowupdoll;msg-param-sender-count=0;msg-param-sub-plan-name=Channel\sSubscription\s(bwana);msg-param-sub-plan=1000;room-id=12519;subscriber=1;system-msg=George\sgifted\sa\sTier\s1\ssub\sto\sCptBlowUpDoll!;tmi-sent-ts=1533764553430;turbo=0;user-id=13074;user-type= :tmi.twitch.tv USERNOTICE #bwana

                    {
                       "raw":"@badges=subscriber/0,premium/1;color=#008000;display-name=oldbooks;emotes=;id=89b8ed15-d662-4e0e-a744-3956db0c9769;login=oldbooks;mod=0;msg-id=giftpaidupgrade;msg-param-promo-gift-total=63523;msg-param-promo-name=Subtember;msg-param-sender-login=wetorp;msg-param-sender-name=Wetorp;room-id=43028909;subscriber=1;system-msg=oldbooks\\sis\\scontinuing\\sthe\\sGift\\sSub\\sthey\\sgot\\sfrom\\sWetorp!\\sThey're\\sone\\sof\\s63523\\sgift\\ssubs\\sto\\scontinue\\sthis\\sSubtember.;tmi-sent-ts=1536691366830;turbo=0;user-id=170192591;user-type= :tmi.twitch.tv USERNOTICE #fandy",
                       "tags":{
                          "badges":{
                             "subscriber":"0",
                             "premium":"1"
                          },Ö
                          "color":"#008000",
                          "display-name":"oldbooks",
                          "emotes":null,
                          "id":"89b8ed15-d662-4e0e-a744-3956db0c9769",
                          "login":"oldbooks",
                          "mod":false,
                          "msg-id":"giftpaidupgrade",
                          "msg-param-promo-gift-total":"63523",
                          "msg-param-promo-name":"Subtember",
                          "msg-param-sender-login":"wetorp",
                          "msg-param-sender-name":"Wetorp",
                          "room-id":"43028909",
                          "subscriber":true,
                          "system-msg":"oldbooks\\sis\\scontinuing\\sthe\\sGift\\sSub\\sthey\\sgot\\sfrom\\sWetorp!\\sThey're\\sone\\sof\\s63523\\sgift\\ssubs\\sto\\scontinue\\sthis\\sSubtember.",
                          "tmi-sent-ts":"1536691366830",
                          "turbo":false,
                          "user-id":"170192591",
                          "user-type":null,
                          "emotes-raw":null,
                          "badges-raw":"subscriber/0,premium/1"
                       },
                       "prefix":"tmi.twitch.tv",
                       "command":"USERNOTICE",
                       "params":[
                          "#fandy"
                       ]
                    }



                    {"raw":"@badges=subscriber/3,sub-gifter/1;color=#FF4500;display-name=misterwolffy;emotes=;id=af4bb498-d6ec-472a-b078-e3e67754edae;login=misterwolffy;mod=0;msg-id=submysterygift;msg-param-mass-gift-count=1;msg-param-sender-count=3;msg-param-sub-plan=1000;room-id=42481140;subscriber=1;system-msg=misterwolffy\\sis\\sgifting\\s1\\sTier\\s1\\sSubs\\sto\\sTheonemanny's\\scommunity!\\sThey've\\sgifted\\sa\\stotal\\sof\\s3\\sin\\sthe\\schannel!;tmi-sent-ts=1537293384191;turbo=0;user-id=101747604;user-type= :tmi.twitch.tv USERNOTICE #theonemanny","tags":{"badges":{"subscriber":"3","sub-gifter":"1"},"color":"#FF4500","display-name":"misterwolffy","emotes":null,"id":"af4bb498-d6ec-472a-b078-e3e67754edae","login":"misterwolffy","mod":false,"msg-id":"submysterygift","msg-param-mass-gift-count":true,"msg-param-sender-count":"3","msg-param-sub-plan":"1000","room-id":"42481140","subscriber":true,"system-msg":"misterwolffy\\sis\\sgifting\\s1\\sTier\\s1\\sSubs\\sto\\sTheonemanny's\\scommunity!\\sThey've\\sgifted\\sa\\stotal\\sof\\s3\\sin\\sthe\\schannel!","tmi-sent-ts":"1537293384191","turbo":false,"user-id":"101747604","user-type":null,"emotes-raw":null,"badges-raw":"subscriber/3,sub-gifter/1"},"prefix":"tmi.twitch.tv","command":"USERNOTICE","params":["#theonemanny"]}


                    */

                    else {
                        this.emit("else", message)
                    }
                    /* CUSTOM END */
                    break;

                // Channel is now hosting another channel or exited host mode..
                case "HOSTTARGET":
                    // Stopped hosting..
                    if (msg.split(" ")[0] === "-") {
                        this.log.info(`[${channel}] Exited host mode.`);
                        this.emits(["unhost", "_promiseUnhost"], [[channel, ~~msg.split(" ")[1] || 0], [null]]);
                    }
                    // Now hosting..
                    else {
                        var viewers = ~~msg.split(" ")[1] || 0;

                        this.log.info(`[${channel}] Now hosting ${msg.split(" ")[0]} for ${viewers} viewer(s).`);
                        this.emit("hosting", channel, msg.split(" ")[0], viewers);
                    }
                    break;

                // Someone has been timed out or chat has been cleared by a moderator..
                case "CLEARCHAT":
                    // User has been banned / timed out by a moderator..
                    if (message.params.length > 1) {
                        // Duration returns null if it's a ban, otherwise it's a timeout..
                        var duration = _.get(message.tags["ban-duration"], null);

                        // Escaping values: http://ircv3.net/specs/core/message-tags-3.2.html#escaping-values
                        var reason = _.replaceAll(_.get(message.tags["ban-reason"], null), {
                            "\\\\s": " ",
                            "\\\\:": ";",
                            "\\\\\\\\": "\\",
                            "\\r": "\r",
                            "\\n": "\n"
                        });

                        if (_.isNull(duration)) {
                            this.log.info(`[${channel}] ${msg} has been banned. Reason: ${reason || "n/a"}`);
                            this.emit("ban", channel, msg, reason);
                        } else {
                            this.log.info(`[${channel}] ${msg} has been timed out for ${duration} seconds. Reason: ${reason || "n/a"}`);
                            this.emit("timeout", channel, msg, reason, ~~duration);
                        }
                    }
                    // Chat was cleared by a moderator..
                    else {
                        this.log.info(`[${channel}] Chat was cleared by a moderator.`);
                        this.emits(["clearchat", "_promiseClear"], [[channel], [null]]);
                    }
                    break;

                // Received a reconnection request from the server..
                case "RECONNECT":
                    this.log.info("Received RECONNECT request from Twitch..");
                    this.log.info(`Disconnecting and reconnecting in ${Math.round(this.reconnectTimer / 1000)} seconds..`);
                    this.disconnect();
                    setTimeout(() => { this.connect(); }, this.reconnectTimer);
                    break;

                // Wrong cluster..
                case "SERVERCHANGE":
                    //
                    break;

                // Received when joining a channel and every time you send a PRIVMSG to a channel.
                case "USERSTATE":
                    message.tags.username = this.username;

                    // Add the client to the moderators of this room..
                    if (message.tags["user-type"] === "mod") {
                        if (!this.moderators[this.lastJoined]) { this.moderators[this.lastJoined] = []; }
                        if (this.moderators[this.lastJoined].indexOf(this.username) < 0) { this.moderators[this.lastJoined].push(this.username); }
                    }

                    // Logged in and username doesn't start with justinfan..
                    if (!_.isJustinfan(this.getUsername()) && !this.userstate[channel]) {
                        this.userstate[channel] = message.tags;
                        this.lastJoined = channel;
                        this.channels.push(channel);
                        this.log.info(`Joined ${channel}`);
                        this.emit("join", channel, _.username(this.getUsername()), true);
                    }

                    // Emote-sets has changed, update it..
                    if (message.tags["emote-sets"] !== this.emotes) {
                        this._updateEmoteset(message.tags["emote-sets"]);
                    }

                    this.userstate[channel] = message.tags;
                    break;

                // Describe non-channel-specific state informations..
                case "GLOBALUSERSTATE":
                    this.globaluserstate = message.tags;

                    // Received emote-sets..
                    if (typeof message.tags["emote-sets"] !== "undefined") {
                        this._updateEmoteset(message.tags["emote-sets"]);
                    }
                    break;

                // Received when joining a channel and every time one of the chat room settings, like slow mode, change.
                // The message on join contains all room settings.
                case "ROOMSTATE":
                    // We use this notice to know if we successfully joined a channel..
                    if (_.channel(this.lastJoined) === _.channel(message.params[0])) { this.emit("_promiseJoin", null); }

                    // Provide the channel name in the tags before emitting it..
                    message.tags.channel = _.channel(message.params[0]);
                    this.emit("roomstate", _.channel(message.params[0]), message.tags);

                    // Handle slow mode here instead of the slow_on/off notice..
                    // This room is now in slow mode. You may send messages every slow_duration seconds.
                    if (message.tags.hasOwnProperty("slow") && !message.tags.hasOwnProperty("subs-only")) {
                        if (typeof message.tags.slow === "boolean") {
                            this.log.info(`[${channel}] This room is no longer in slow mode.`);
                            this.emits(["slow", "slowmode", "_promiseSlowoff"], [[channel, false, 0], [channel, false, 0], [null]]);
                        } else {
                            this.log.info(`[${channel}] This room is now in slow mode.`);
                            this.emits(["slow", "slowmode", "_promiseSlow"], [[channel, true, ~~message.tags.slow], [channel, true, ~~message.tags.slow], [null]]);
                        }
                    }

                    // Handle followers only mode here instead of the followers_on/off notice..
                    // This room is now in follower-only mode.
                    // This room is now in <duration> followers-only mode.
                    // This room is no longer in followers-only mode.
                    // duration is in minutes (string)
                    // -1 when /followersoff (string)
                    // false when /followers with no duration (boolean)
                    if (message.tags.hasOwnProperty("followers-only") && !message.tags.hasOwnProperty("subs-only")) {
                        if (message.tags["followers-only"] === "-1") {
                            this.log.info(`[${channel}] This room is no longer in followers-only mode.`);
                            this.emits(["followersonly", "followersmode", "_promiseFollowersoff"], [[channel, false, 0], [channel, false, 0], [null]]);
                        } else {
                            var minutes = ~~message.tags["followers-only"];
                            this.log.info(`[${channel}] This room is now in follower-only mode.`);
                            this.emits(["followersonly", "followersmode", "_promiseFollowers"], [[channel, true, minutes], [channel, true, minutes], [null]]);
                        }
                    }
                    break;

                default:
                    this.log.warn(`Could not parse message from tmi.twitch.tv:\n${JSON.stringify(message, null, 4)}`);
                    break;
            }
        }

        // Messages from jtv..
        else if (message.prefix === "jtv") {
            switch(message.command) {
                case "MODE":
                    if (msg === "+o") {
                        // Add username to the moderators..
                        if (!this.moderators[channel]) { this.moderators[channel] = []; }
                        if (this.moderators[channel].indexOf(message.params[2]) < 0) { this.moderators[channel].push(message.params[2]); }

                        this.emit("mod", channel, message.params[2]);
                    }
                    else if (msg === "-o") {
                        // Remove username from the moderators..
                        if (!this.moderators[channel]) { this.moderators[channel] = []; }
                        this.moderators[channel].filter((value) => { return value != message.params[2]; });

                        this.emit("unmod", channel, message.params[2]);
                    }
                    break;

                default:
                    this.log.warn(`Could not parse message from jtv:\n${JSON.stringify(message, null, 4)}`);
                    break;
            }
        }

        // Anything else..
        else {
            switch(message.command) {
                case "353":
                    this.emit("names", message.params[2], message.params[3].split(" "));
                    break;

                case "366":
                    break;

                // Someone has joined the channel..
                case "JOIN":
                    // Joined a channel as a justinfan (anonymous) user..
                    if (_.isJustinfan(this.getUsername()) && this.username === message.prefix.split("!")[0]) {
                        this.lastJoined = channel;
                        this.channels.push(channel);
                        this.log.info(`Joined ${channel}`);
                        this.emit("join", channel, message.prefix.split("!")[0], true);
                    }

                    // Someone else joined the channel, just emit the join event..
                    if (this.username !== message.prefix.split("!")[0]) {
                        this.emit("join", channel, message.prefix.split("!")[0], false);
                    }
                    break;

                // Someone has left the channel..
                case "PART":
                    var isSelf = false;
                    // Client a channel..
                    if (this.username === message.prefix.split("!")[0]) {
                        isSelf = true;
                        if (this.userstate[channel]) { delete this.userstate[channel]; }

                        var index = this.channels.indexOf(channel);
                        if (index !== -1) { this.channels.splice(index, 1); }

                        var index = this.opts.channels.indexOf(channel);
                        if (index !== -1) { this.opts.channels.splice(index, 1); }

                        this.log.info(`Left ${channel}`);
                        this.emit("_promisePart", null);
                    }

                    // Client or someone else left the channel, emit the part event..
                    this.emit("part", channel, message.prefix.split("!")[0], isSelf);
                    break;

                // Received a whisper..
                case "WHISPER":
                    this.log.info(`[WHISPER] <${message.prefix.split("!")[0]}>: ${msg}`);

                    // Update the tags to provide the username..
                    if (!message.tags.hasOwnProperty("username")) { message.tags.username = message.prefix.split("!")[0]; }
                    message.tags["message-type"] = "whisper";

                    var from = _.channel(message.tags.username);
                    // Emit for both, whisper and message..
                    this.emits(["whisper", "message"], [
                        [from, message.tags, msg, false],
                        [from, message.tags, msg, false]
                    ]);
                    break;

                case "PRIVMSG":
                    // Add username (lowercase) to the tags..
                    message.tags.username = message.prefix.split("!")[0];

                    // Message from JTV..
                    if (message.tags.username === "jtv") {
                        // Someone is hosting the channel and the message contains how many viewers..
                        if (msg.includes("hosting you for")) {
                            var count = _.extractNumber(msg);

                            this.emit("hosted", channel, _.username(msg.split(" ")[0]), count, msg.includes("auto"));
                        }

                        // Some is hosting the channel, but no viewer(s) count provided in the message..
                        else if (msg.includes("hosting you")) {
                            this.emit("hosted", channel, _.username(msg.split(" ")[0]), 0, msg.includes("auto"));
                        }
                    }

                    else {
                        // Message is an action (/me <message>)..
                        if (msg.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)) {
                            message.tags["message-type"] = "action";
                            this.log.info(`[${channel}] *<${message.tags.username}>: ${msg.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)[1]}`);
                            this.emits(["action", "message"], [
                                [channel, message.tags, msg.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)[1], false],
                                [channel, message.tags, msg.match(/^\u0001ACTION ([^\u0001]+)\u0001$/)[1], false]
                            ]);
                        }
                        else {
                            if (message.tags.hasOwnProperty("bits")) {
                                this.emit("cheer", channel, message.tags, msg);
                            }

                            // Message is a regular chat message..
                            else {
                                message.tags["message-type"] = "chat";
                                this.log.info(`[${channel}] <${message.tags.username}>: ${msg}`);

                                this.emits(["chat", "message"], [
                                    [channel, message.tags, msg, false],
                                    [channel, message.tags, msg, false]
                                ]);
                            }
                        }
                    }
                    break;

                default:
                    this.log.warn(`Could not parse message:\n${JSON.stringify(message, null, 4)}`);
                    break;
            }
        }
    }
};
