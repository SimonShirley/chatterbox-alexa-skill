'use strict';

var Alexa = require('alexa-sdk');
//var audioData = require('./audioAssets');
var constants = require('./constants');
var mysql = require('mysql');
var appInfo = require("./appInfo");
var format = require('string-format');

format.extend(String.prototype);

// create MySQL connection pool
var pool = mysql.createPool({
    host: appInfo.mysql_data.host,
    user: appInfo.mysql_data.username,
    password: appInfo.mysql_data.password,
    database: appInfo.mysql_data.database_name,
    ssl: "Amazon RDS"
});

// Binding audio handlers to PLAY_MODE State since they are expected only in this mode.
var audioEventHandlers = Alexa.CreateStateHandler(constants.states.PLAY_MODE, {
    'PlaybackStarted' : function () {
        /*
         * AudioPlayer.PlaybackStarted Directive received.
         * Confirming that requested audio file began playing.
         * Storing details in dynamoDB using attributes.
         */
        this.attributes['token'] = getToken.call(this);
        this.attributes['editionCurrentTrack'] = getCurrentTrack.call(this);
        this.attributes['playbackFinished'] = false;
        this.emit(':saveState', true);
    },
    'PlaybackFinished' : function () {
        /*
         * AudioPlayer.PlaybackFinished Directive received.
         * Confirming that audio file completed playing.
         * Storing details in dynamoDB using attributes.
         */
        this.attributes['playbackFinished'] = true;
        this.attributes['enqueuedToken'] = false;
        this.emit(':saveState', true);
    },
    'PlaybackStopped' : function () {
        /*
         * AudioPlayer.PlaybackStopped Directive received.
         * Confirming that audio file stopped playing.
         * Storing details in dynamoDB using attributes.
         */
        this.attributes['token'] = getToken.call(this);
        this.attributes['editionCurrentTrack'] = getCurrentTrack.call(this);
        this.attributes['offsetInMilliseconds'] = getOffsetInMilliseconds.call(this);
        this.emit(':saveState', true);
    },
    'PlaybackNearlyFinished' : function () {
        /*
         * AudioPlayer.PlaybackNearlyFinished Directive received.
         * Using this opportunity to enqueue the next audio
         * Storing details in dynamoDB using attributes.
         * Enqueuing the next audio file.
         */
        var self = this;

        if (self.attributes['enqueuedToken']) {
            /*
             * Since AudioPlayer.PlaybackNearlyFinished Directive are prone to be delivered multiple times during the
             * same audio being played.
             * If an audio file is already enqueued, exit without enqueuing again.
             */
            return self.context.succeed(true);
        }
        
        var enqueueIndex = self.attributes['editionCurrentTrack'];
        enqueueIndex++;

        pool.getConnection(function(err, currentConnection) {
            currentConnection.query("SELECT COUNT(*) AS `track_count` FROM `tbl_edition_tracks` WHERE `edition_id` = ?", [self.attributes["currentTrackId"]], function(error, results, fields) {
                if (error) throw error;

                // Checking if  there are any items to be enqueued.
                if (enqueueIndex > results[0].track_count) {
                    if (self.attributes['loop']) {
                        // Enqueueing the first item since looping is enabled.
                        enqueueIndex = 1;
                    } else {
                        // Nothing to enqueue since reached end of the list and looping is disabled.
                        return self.context.succeed(true);
                    }
                }

                // Setting attributes to indicate item is enqueued.
                self.attributes['enqueuedToken'] = "{0}_{1}".format(self.attributes["currendEditionId"], enqueueIndex);

                var enqueueToken = self.attributes['enqueuedToken'];
                var playBehavior = 'ENQUEUE';
                var expectedPreviousToken = self.attributes['token'];
                var offsetInMilliseconds = 0;

                currentConnection.query("SELECT `track_url` FROM `tbl_edition_tracks` WHERE `edition_id` = ? AND `track_number` = ?", [self.attributes["currentEditionId"], enqueueIndex], function(error, results, fields) {
                    currentConnection.release();

                    if (error) throw error;                    
                    
                    self.response.audioPlayerPlay(playBehavior, results[0].track_url, enqueueToken, expectedPreviousToken, offsetInMilliseconds);
                    self.emit(':responseReady');
                });    
            });
        });
    },
    'PlaybackFailed' : function () {
        //  AudioPlayer.PlaybackNearlyFinished Directive received. Logging the error.
        console.log("Playback Failed : %j", this.event.request.error);
        this.context.succeed(true);
    }
});

module.exports = audioEventHandlers;

function getToken() {
    // Extracting token received in the request.
    return this.event.request.token;
}

function getCurrentTrack() {
    // Extracting index from the token received in the request.
    var tokenValue = this.event.request.token;
    var tokenSegments = tokenValue.split("_");
    return Number(tokenSegments[1]);
}

function getOffsetInMilliseconds() {
    // Extracting offsetInMilliseconds received in the request.
    return this.event.request.offsetInMilliseconds;
}