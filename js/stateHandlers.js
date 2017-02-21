'use strict';

var Alexa = require('alexa-sdk');
var audioData = require('./audioAssets');
var constants = require('./constants');
var strings = require('./strings');
var format = require('string-format');

format.extend(String.prototype);

var stateHandlers = {
    startModeIntentHandlers : Alexa.CreateStateHandler(constants.states.START_MODE, {
        /*
         *  All Intent Handlers for state : START_MODE
         */
        'LaunchRequest' : function () {
            // Initialize Attributes
            this.attributes['editionListIndex'] = 0;
            this.attributes['editionCurrentTrack'] = 0;
            this.attributes['currentEdition'] = 0;
            this.attributes['offsetInMilliseconds'] = 0;
            this.attributes['loop'] = false;
            this.attributes['shuffle'] = false;
            this.attributes['playbackEditionCurrentTrackChanged'] = true;
            //  Change state to START_MODE
            this.handler.state = constants.states.START_MODE;

            var message = strings.start_mode_launch_message;
            var reprompt = strings.start_mode_launch_reprompt;

            this.response.speak(message).listen(reprompt);
            this.emit(':responseReady');
        },
        'Chatterbox' : function () {
            if (!this.attributes['editionListIndex']) {
                // Initialize Attributes if undefined.
                this.attributes['editionListIndex'] = 0;
                this.attributes['editionCurrentTrack'] = 0;
                this.attributes['currentEdition'] = 0;
                this.attributes['offsetInMilliseconds'] = 0;
                this.attributes['loop'] = false;
                this.attributes['shuffle'] = false;
                this.attributes['playbackEditionCurrentTrackChanged'] = true;
                //  Change state to START_MODE
                this.handler.state = constants.states.START_MODE;
            }
            controller.play.call(this);
        },
        'AMAZON.HelpIntent' : function () {
            var message = strings.start_mode_help;
            this.response.speak(message).listen(message);
            this.emit(':responseReady');
        },
        'AMAZON.StopIntent' : function () {
            var message = strings.exit_message;
            this.response.speak(message);
            this.emit(':responseReady');
        },
        'AMAZON.CancelIntent' : function () {
            var message = strings.exit_message;
            this.response.speak(message);
            this.emit(':responseReady');
        },
        'SessionEndedRequest' : function () {
            // No session ended logic
        },
        'Unhandled' : function () {
            var message = strings.unhandled_request;
            this.response.speak(message).listen(message);
            this.emit(':responseReady');
        }
    }),
    playModeIntentHandlers : Alexa.CreateStateHandler(constants.states.PLAY_MODE, {
        /*
         *  All Intent Handlers for state : PLAY_MODE
         */
        'LaunchRequest' : function () {
            /*
             *  Session resumed in PLAY_MODE STATE.
             *  If playback had finished during last session :
             *      Give welcome message.
             *      Change state to START_STATE to restrict user inputs.
             *  Else :
             *      Ask user if he/she wants to resume from last position.
             *      Change state to RESUME_DECISION_MODE
             */
            var message;
            var reprompt;

            if (this.attributes['playbackFinished']) {
                this.handler.state = constants.states.START_MODE;
                message = strings.start_mode_launch_message;
                reprompt = strings.start_mode_launch_reprompt;
            } else {
                this.handler.state = constants.states.RESUME_DECISION_MODE;
                message = strings.resume_launch_message.format(audioData.chatterbox[this.attributes['editionListIndex']].edition.toString(), audioData.chatterbox[this.attributes['editionListIndex']].recorded.replace(/(-)+/, '').toString());
                reprompt = strings.resume_launch_reprompt;
            }

            this.response.speak(message).listen(reprompt);
            this.emit(':responseReady');
        },
        'Chatterbox' : function () { controller.play.call(this) },
        'AMAZON.NextIntent' : function () { controller.playNext.call(this) },
        'AMAZON.PreviousIntent' : function () { controller.playPrevious.call(this) },
        'AMAZON.PauseIntent' : function () { controller.stop.call(this) },
        'AMAZON.StopIntent' : function () { controller.stop.call(this) },
        'AMAZON.CancelIntent' : function () { controller.stop.call(this) },
        'AMAZON.ResumeIntent' : function () { controller.play.call(this) },
        'AMAZON.LoopOnIntent' : function () { controller.loopOn.call(this) },
        'AMAZON.LoopOffIntent' : function () { controller.loopOff.call(this) },
        'AMAZON.ShuffleOnIntent' : function () { controller.shuffleOn.call(this) },
        'AMAZON.ShuffleOffIntent' : function () { controller.shuffleOff.call(this) },
        'AMAZON.StartOverIntent' : function () { controller.startOver.call(this) },
        'AMAZON.HelpIntent' : function () {
            // This will called while audio is playing and a user says "ask <invocation_name> for help"
            var message = strings.play_mode_help;
            this.response.speak(message).listen(message);
            this.emit(':responseReady');
        },
        'SessionEndedRequest' : function () {
            // No session ended logic
        },
        'Unhandled' : function () {
            var message = strings.play_mode_unhandled_request;
            this.response.speak(message).listen(message);
            this.emit(':responseReady');
        }
    }),
    remoteControllerHandlers : Alexa.CreateStateHandler(constants.states.PLAY_MODE, {
        /*
         *  All Requests are received using a Remote Control. Calling corresponding handlers for each of them.
         */
        'PlayCommandIssued' : function () { controller.play.call(this) },
        'PauseCommandIssued' : function () { controller.stop.call(this) },
        'NextCommandIssued' : function () { controller.playNext.call(this) },
        'PreviousCommandIssued' : function () { controller.playPrevious.call(this) }
    }),
    resumeDecisionModeIntentHandlers : Alexa.CreateStateHandler(constants.states.RESUME_DECISION_MODE, {
        /*
         *  All Intent Handlers for state : RESUME_DECISION_MODE
         */
        'LaunchRequest' : function () {
            var message = strings.resume_launch_message.format(audioData.chatterbox[this.attributes['editionListIndex']].edition.toString(), audioData.chatterbox[this.attributes['editionListIndex']].recorded.replace(/(-)+/, '').toString());
            var reprompt = strings.resume_launch_reprompt;
            this.response.speak(message).listen(reprompt);
            this.emit(':responseReady');
        },
        'AMAZON.YesIntent' : function () { controller.play.call(this) },
        'AMAZON.NoIntent' : function () { controller.reset.call(this) },
        'AMAZON.HelpIntent' : function () {
            var message = strings.resume_help_message.format(audioData.chatterbox[this.attributes['editionListIndex']].tracks[this.attributes['editionTrackOrder']].title);
            var reprompt = strings.resume_launch_reprompt;
            this.response.speak(message).listen(reprompt);
            this.emit(':responseReady');
        },
        'AMAZON.StopIntent' : function () {
            var message = strings.exit_message;
            this.response.speak(message);
            this.emit(':responseReady');
        },
        'AMAZON.CancelIntent' : function () {
            var message = strings.exit_message;
            this.response.speak(message);
            this.emit(':responseReady');
        },
        'SessionEndedRequest' : function () {
            // No session ended logic
        },
        'Unhandled' : function () {
            var message = strings.resume_unhandled_request;
            this.response.speak(message).listen(message);
            this.emit(':responseReady');
        }
    })
};

module.exports = stateHandlers;

var controller = function () {
    return {
        play: function () {
            /*
             *  Using the function to begin playing audio when:
             *      Play Audio intent invoked.
             *      Resuming audio when stopped/paused.
             *      Next/Previous commands issued.
             */
            this.handler.state = constants.states.PLAY_MODE;

            if (this.attributes['playbackFinished']) {
                // Reset to top of the playlist when reached end.
                this.attributes['editionListIndex'] = 0;
                this.attributes['editionCurrentTrack'] = 0;
                this.attributes['currentEdition'] = 0;
                this.attributes['offsetInMilliseconds'] = 0;
                this.attributes['playbackEditionCurrentTrackChanged'] = true;
                this.attributes['playbackFinished'] = false;
            }

            var token = "{0}_{1}".format(audioData.chatterbox[this.attributes['editionListIndex']].edition, this.attributes['editionCurrentTrack']);
            var playBehavior = 'REPLACE_ALL';
            var chatterboxEdition = audioData.chatterbox[this.attributes['editionListIndex']];
            var offsetInMilliseconds = this.attributes['offsetInMilliseconds'];
            // Since play behavior is REPLACE_ALL, enqueuedToken attribute need to be set to null.
            this.attributes['enqueuedToken'] = null;


            if (canThrowCard.call(this)) {
                var cardTitle = 'Chatterbox - Edition {0}'.format(chatterboxEdition.edition.toString());
                var cardContent = chatterboxEdition.tracks[this.attributes['editionCurrentTrack']].title;
                this.response.cardRenderer(cardTitle, cardContent, null);
            }

            try {
                this.response.audioPlayerPlay(playBehavior, chatterboxEdition.tracks[this.attributes['editionCurrentTrack']].mp3, token, null, offsetInMilliseconds);
            } catch (ex) {
                console.log("Error in playback: ", ex);
            }

            this.emit(':responseReady');
        },
        stop: function () {
            /*
             *  Issuing AudioPlayer.Stop directive to stop the audio.
             *  Attributes already stored when AudioPlayer.Stopped request received.
             */
            try {
                this.response.audioPlayerStop();
            } catch (ex) {
                console.log("Error in stopping playback: ", ex);
            }
            this.emit(':responseReady');
        },
        playNext: function () {
            /*
             *  Called when AMAZON.NextIntent or PlaybackController.NextCommandIssued is invoked.
             *  editionListIndex is computed using token stored when AudioPlayer.PlaybackStopped command is received.
             *  If reached at the end of the playlist, choose behavior based on "loop" flag.
             */
            var editionTrackIndex = -1;
            
            if (typeof(this.attributes['editionCurrentTrack']) == "undefined" || isNaN(Number(this.attributes['editionCurrentTrack'])))
                editionTrackIndex = -1;
            else
                editionTrackIndex = Number(this.attributes['editionCurrentTrack']);

            editionTrackIndex++;

            // Check for last audio file.
            if (editionTrackIndex >= audioData.chatterbox[this.attributes['editionListIndex']].tracks.length) {
                if (this.attributes['loop']) {
                    editionTrackIndex = 0;
                } else {
                    // Reached at the end. Thus reset state to start mode and stop playing.
                    this.handler.state = constants.states.START_MODE;

                    var message = strings.next_track_end_of_list;
                    this.response.speak(message);

                    try {
                        this.response.audioPlayerStop();
                    } catch (ex) {
                        console.log("Error in stopping playback: ", ex);
                    }
                    return this.emit(':responseReady');
                }
            }

            // Set values to attributes.
            this.attributes['editionCurrentTrack'] = editionTrackIndex;
            this.attributes['offsetInMilliseconds'] = 0;
            this.attributes['playbackEditionCurrentTrackChanged'] = true;

            controller.play.call(this);
        },
        playPrevious: function () {
            /*
             *  Called when AMAZON.PreviousIntent or PlaybackController.PreviousCommandIssued is invoked.
             *  editionListIndex is computed using token stored when AudioPlayer.PlaybackStopped command is received.
             *  If reached at the end of the playlist, choose behavior based on "loop" flag.
             */
            var editionTrackIndex = 0;
            
            if (typeof(this.attributes['editionCurrentTrack']) == "undefined" || isNaN(Number(this.attributes['editionCurrentTrack'])))
                editionTrackIndex = 0;
            else
                editionTrackIndex = Number(this.attributes['editionCurrentTrack']);

            editionTrackIndex--;
            // Check for last audio file.
            if (editionTrackIndex < 0) {
                if (this.attributes['loop']) {
                    editionListIndex = audioData.chatterbox[this.attributes['editionListIndex']].tracks.length - 1;
                } else {
                    // Reached at the end. Thus reset state to start mode and stop playing.
                    this.handler.state = constants.states.START_MODE;

                    var message = strings.previous_track_end_of_list;
                    this.response.speak(message);
                    
                    try {
                        this.response.audioPlayerStop();
                    } catch (ex) {
                        console.log("Error in stopping playback: ", ex);
                    }
                    return this.emit(':responseReady');
                }
            }
            // Set values to attributes.
            this.attributes['editionCurrentTrack'] = editionTrackIndex;
            this.attributes['offsetInMilliseconds'] = 0;
            this.attributes['playbackEditionCurrentTrackChanged'] = true;

            controller.play.call(this);
        },
        loopOn: function () {
            // Turn on loop play.
            this.attributes['loop'] = true;
            var message = 'Loop turned on.';
            this.response.speak(message);
            this.emit(':responseReady');
        },
        loopOff: function () {
            // Turn off looping
            this.attributes['loop'] = false;
            var message = 'Loop turned off.';
            this.response.speak(message);
            this.emit(':responseReady');
        },
        shuffleOn: function () {
            this.response.speak(strings.no_shuffle);
            return this.emit(':responseReady');
        },
        shuffleOff: function () {
            this.response.speak(strings.no_shuffle);
            return this.emit(':responseReady');
        },
        startOver: function () {
            // Start over the current audio file.
            this.attributes['offsetInMilliseconds'] = 0;
            controller.play.call(this);
        },
        reset: function () {
            // Reset to top of the playlist.
            this.attributes['editionListIndex'] = 0;
            this.attributes['editionCurrentTrack'] = 0;
            this.attributes['currentEdition'] = 0;
            this.attributes['offsetInMilliseconds'] = 0;
            this.attributes['playbackEditionCurrentTrackChanged'] = true;
            controller.play.call(this);
        }
    }
}();

function canThrowCard() {
    /*
     * To determine when can a card should be inserted in the response.
     * In response to a PlaybackController Request (remote control events) we cannot issue a card,
     * Thus adding restriction of request type being "IntentRequest".
     */
    
    if (this.event.request.type === 'IntentRequest' && this.attributes['playbackEditionCurrentTrackChanged']) {
        this.attributes['playbackEditionCurrentTrackChanged'] = false;
        return true;
    } else {
        return false;
    }

    return false;
}