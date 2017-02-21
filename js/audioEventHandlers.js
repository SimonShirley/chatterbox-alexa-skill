'use strict';

var Alexa = require('alexa-sdk');
var audioData = require('./audioAssets');
var constants = require('./constants');
var strings = require('./strings');
var format = require('string-format');

format.extend(String.prototype);

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
        if (this.attributes['enqueuedToken']) {
            /*
             * Since AudioPlayer.PlaybackNearlyFinished Directive are prone to be delivered multiple times during the
             * same audio being played.
             * If an audio file is already enqueued, exit without enqueuing again.
             */
            return this.context.succeed(true);
        }
        
        var enqueueIndex = this.attributes['editionCurrentTrack'];
        enqueueIndex +=1;
        // Checking if  there are any items to be enqueued.
        if (enqueueIndex === audioData.chatterbox[this.attributes["editionListIndex"]].tracks.length) {
            if (this.attributes['loop']) {
                // Enqueueing the first item since looping is enabled.
                enqueueIndex = 0;
            } else {
                // Nothing to enqueue since reached end of the list and looping is disabled.
                return this.context.succeed(true);
            }
        }
        // Setting attributes to indicate item is enqueued.
        this.attributes['enqueuedToken'] = "{0}_{1}".format(audioData.chatterbox[this.attributes['editionListIndex']].edition, enqueueIndex);

        var enqueueToken = this.attributes['enqueuedToken'];
        var playBehavior = 'ENQUEUE';
        var chatterboxEdition = audioData.chatterbox[this.attributes['editionListIndex']];
        var expectedPreviousToken = this.attributes['token'];
        var offsetInMilliseconds = 0;
        
        this.response.audioPlayerPlay(playBehavior, chatterboxEdition.tracks[enqueueIndex].mp3, enqueueToken, expectedPreviousToken, offsetInMilliseconds);
        this.emit(':responseReady');
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