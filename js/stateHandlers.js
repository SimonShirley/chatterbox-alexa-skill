'use strict';

var Alexa = require('alexa-sdk');
var format = require('string-format');
var mysql = require('mysql');
var dateformat = require('dateformat');

var constants = require('./constants');
var strings = require('./strings');
var appInfo = require("./appInfo");

format.extend(String.prototype);

var stateHandlers = {
    startModeIntentHandlers : Alexa.CreateStateHandler(constants.states.START_MODE, {
        /*
         *  All Intent Handlers for state : START_MODE
         */
        'LaunchRequest' : function () {
            // Initialize Attributes
            this.attributes['editionCurrentTrack'] = 1;
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
            var self = this;

            if (!self.attributes['currentEditionId']) {
                // Initialize Attributes if undefined.
                self.attributes['editionCurrentTrack'] = 1;
                self.attributes['offsetInMilliseconds'] = 0;
                self.attributes['loop'] = false;
                self.attributes['shuffle'] = false;
                self.attributes['playbackEditionCurrentTrackChanged'] = true;
                //  Change state to START_MODE
                self.handler.state = constants.states.START_MODE;

                var currentConnection = getMySQLConnection();

                currentConnection.query("SELECT `id` FROM `tbl_edition` ORDER BY `recorded_date` DESC LIMIT 1", function(error, results, fields) {
                    if (error) throw error;
                    self.attributes["currentEditionId"] = results[0].id;

                    controller.play.call(self);
                });
            } else {
                controller.play.call(self);
            }
        },
        'ChatterboxLatest' : function() {
            var self = this;

            //  Change state to PLAY_MODE
            self.handler.state = constants.states.PLAY_MODE;

            var currentConnection = getMySQLConnection();

            currentConnection.query("SELECT `id`, `edition_number`, `recorded_date` FROM `tbl_edition` ORDER BY `recorded_date` DESC LIMIT 1", function(error, results, fields) {
                if (error) throw error;
                
                controller.reset.call(self);
                self.attributes["currentEditionId"] = results[0].id;
                self.attributes['playbackFinished'] = false;

                self.response.speak(strings.playing_edition_date.format(results[0].edition_number, getDateAsNumber(recorded_date)));
                controller.play.call(self);
            });
        },
        'ChatterboxSpecificEdition' : function() {
            var self = this;
            var inputValue = self.event.request.intent.slots.edition_number.value;
            var currentConnection = getMySQLConnection();

            if (!isNaN(inputValue)) { // check to see if the input is a number
                inputValue = parseInt(inputValue);

                currentConnection.query("SELECT `id`, `edition_number`, `recorded_date` FROM `tbl_edition` WHERE `edition_number` = ?", [ self.event.request.intent.slots.edition_number.value ], function(error, results, fields) {
                    if (error) throw error;

                    if (results.length > 0) {
                        //  Change state to PLAY_MODE
                        self.handler.state = constants.states.PLAY_MODE;
                        
                        controller.reset.call(self);
                        self.attributes["currentEditionId"] = results[0].id;
                        self.attributes['playbackFinished'] = false;

                        self.response.speak(strings.playing_edition_date.format(results[0].edition_number, getDateAsNumber(results[0].recorded_date)));
                        controller.play.call(self);
                    } else {
                        self.response.speak(strings.edition_unavailable.format(self.event.request.intent.slots.edition_number.value));
                        self.emit(":responseReady");
                    }
                });
            } else { // if the value is some sort of date
                var editionDate = "";
                var dateMatches = inputValue.match(/(\d{4})-W([01-53])/);

                if (inputValue.match(/^[0-9]{4}-(((0[13578]|(10|12))-(0[1-9]|[1-2][0-9]|3[0-1]))|(02-(0[1-9]|[1-2][0-9]))|((0[469]|11)-(0[1-9]|[1-2][0-9]|30)))$/).length > 0) {
                    editionDate = inputValue;
                } else if (dateMatches.length > 0) {
                    try {
                        editionDate = getThursdayOfISOWeek(dateMatches[1], dateMatches[0]);
                    } catch (ex) { }
                }

                currentConnection.query("SELECT `id`, `edition_number` FROM `tbl_edition` WHERE `recorded_date` = '?'", [ editionDate ], function(error, results, fields) {
                    if (error) throw error;

                    if (results.length > 0) {
                        //  Change state to PLAY_MODE
                        self.handler.state = constants.states.PLAY_MODE;
                        
                        controller.reset.call(self);
                        self.attributes["currentEditionId"] = results[0].id;
                        self.attributes['playbackFinished'] = false;

                        this.response.speak(strings.playing_edition_date.format(results[0].edition_number, editionDate.split('-').join('')));
                        controller.play.call(self);
                    } else {
                        self.response.speak(strings.edition_no_number_unavailable);
                        this.emit(":responseReady");
                    }
                });
            }

            currentConnection.end();
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
            var self = this;
            var message;
            var reprompt;

            if (self.attributes['playbackFinished']) {
                self.handler.state = constants.states.START_MODE;
                message = strings.start_mode_launch_message;
                reprompt = strings.start_mode_launch_reprompt;

                self.response.speak(message).listen(reprompt);
                self.emit(':responseReady');

                return;
            } else {
                self.handler.state = constants.states.RESUME_DECISION_MODE;

                var currentConnection = getMySQLConnection();

                currentConnection.query("SELECT `edition_number`, `recorded_date` FROM `tbl_edition` WHERE `id` = ?", [self.attributes["currentEditionId"]], function(error, results, fields) {
                    if (error) throw error;

                    message = strings.resume_launch_message.format(results[0].edition_number.toString(), dateformat(results[0].recorded_date, "yyyymmdd"));
                    reprompt = strings.resume_launch_reprompt;

                    self.response.speak(message).listen(reprompt);
                    self.emit(':responseReady');
                });      

                currentConnection.end();          
            }
        },
        'Chatterbox' : function () { controller.play.call(this); },
        'ChatterboxLatest' : function () {
            this.handler.state = constants.states.START_MODE;
            this.emitWithState('ChatterboxLatest');
        },
        'ChatterboxSpecificEdition' : function () {
            this.handler.state = constants.states.START_MODE;
            this.emitWithState('ChatterboxSpecificEdition');
        },
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
            var self = this;
            var currentConnection = getMySQLConnection();

            currentConnection.query("SELECT `edition_number`, `recorded_date` FROM `tbl_edition` WHERE `id` = ?", [self.attributes["currentEditionId"]], function(error, results, fields) {
                if (error) throw error;

                if (results.length < 1) {
                    controller.reset.call(self);

                    self.handler.state = constants.states.START_MODE;
                    self.emitWithState("Chatterbox");
                    return;
                }

                var message = strings.resume_launch_message.format(results[0].edition_number.toString(), dateformat(results[0].recorded_date, "yyyymmdd"));
                var reprompt = strings.resume_launch_reprompt;

                self.response.speak(message).listen(reprompt);
                self.emit(':responseReady');
            });      

            currentConnection.end();
        },
        'Chatterbox' : function() {
            this.handler.state = constants.states.START_MODE;
            this.attributes["playbackFinished"] = false;
            this.emitWithState('Chatterbox');
        },
        'ChatterboxLatest' : function () {
            this.handler.state = constants.states.START_MODE;
            this.emitWithState('ChatterboxLatest');
        },
        'ChatterboxSpecificEdition' : function () {
            this.handler.state = constants.states.START_MODE;
            this.emitWithState('ChatterboxSpecificEdition');
        },
        'AMAZON.YesIntent' : function () { controller.play.call(this) },
        'AMAZON.NoIntent' : function () {
            this.handler.state = constants.states.START_MODE;
            controller.reset.call(this);

            var message = strings.start_mode_launch_message;
            var reprompt = strings.start_mode_launch_reprompt;

            this.response.speak(message).listen(reprompt);
            this.emit(":responseReady");
        },
        'AMAZON.HelpIntent' : function () {
            var self = this;
            var currentConnection = getMySQLConnection();

            currentConnection.query("SELECT `edition_number`, `recorded_date` FROM `tbl_edition` WHERE `id` = ?", [self.attributes["currentEditionId"]], function(error, results, fields) {
                if (error) throw error;

                var message = strings.resume_launch_message.format(results[0].edition_number.toString(), dateformat(results[0].recorded_date, "yyyymmdd"));
                var reprompt = strings.resume_launch_reprompt;

                self.response.speak(message).listen(reprompt);
                self.emit(':responseReady');
            });      

            currentConnection.end();
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
            var self = this;
            self.handler.state = constants.states.PLAY_MODE;

            if (self.attributes['playbackFinished']) {
                // Reset to top of the playlist when reached end.
                controller.reset.call(self);
                self.attributes['playbackFinished'] = false;

                self.handler.state = constants.states.START_MODE;
                self.response.speak(strings.start_mode_launch_message).listen(strings.start_mode_launch_reprompt);
                self.emit(':responseReady');

                return;
            } else {
                var token = "{0}_{1}".format(self.attributes["currentEditionId"], self.attributes["editionCurrentTrack"]);
                var playBehavior = 'REPLACE_ALL';
                var offsetInMilliseconds = self.attributes['offsetInMilliseconds'];

                // Since play behavior is REPLACE_ALL, enqueuedToken attribute need to be set to null.
                self.attributes['enqueuedToken'] = null;

                var currentConnection = getMySQLConnection();

                currentConnection.query("SELECT `edition`.`edition_number`, `tracks`.`track_title`, `tracks`.`track_url` FROM `tbl_edition` AS `edition` INNER JOIN `tbl_edition_tracks` AS `tracks` ON `tracks`.`edition_id` =  `edition`.`id` WHERE `edition`.`id` = ? AND `tracks`.`track_number` = ?", [self.attributes["currentEditionId"], self.attributes["editionCurrentTrack"]], function(error, results, fields) {
                    if (error) throw error;

                    if (canThrowCard.call(self)) {
                        var cardTitle = 'Chatterbox - Edition {0}'.format(results[0].edition_number.toString());
                        var cardContent = results[0].track_title;
                        self.response.cardRenderer(cardTitle, cardContent, null);
                    }

                    try {
                        self.response.audioPlayerPlay(playBehavior, results[0].track_url, token, null, offsetInMilliseconds);
                    } catch (ex) {
                        console.log("Error in playback: ", ex);
                    }

                    self.emit(':responseReady');
                });      

                currentConnection.end();
            }
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
            var self = this;
            var editionTrackIndex = 0;
            var currentConnection = getMySQLConnection();
            var editionTrackCount = 0;
            
            if (typeof(self.attributes['editionCurrentTrack']) == "undefined" || isNaN(Number(self.attributes['editionCurrentTrack'])))
                editionTrackIndex = 0;
            else
                editionTrackIndex = Number(self.attributes['editionCurrentTrack']);

            editionTrackIndex++;            

            currentConnection.query("SELECT COUNT(*) AS `track_count` FROM `tbl_edition_tracks` WHERE `edition_id` = ?", [self.attributes["currentEditionId"]], function(error, results, fields) {
                if (error) throw error;

                // Check for last audio file.
                if (editionTrackIndex > results[0].track_count) {
                    if (self.attributes['loop']) {
                        editionTrackIndex = 1;
                    } else {
                        // Reached at the end. Thus reset state to start mode and stop playing.
                        self.attributes["playbackFinished"] = true;

                        var message = strings.next_track_end_of_list;
                        self.response.speak(message);

                        try {
                            self.response.audioPlayerStop();
                        } catch (ex) {
                            console.log("Error in stopping playback: ", ex);
                        }

                        return self.emit(':responseReady');
                    }
                }

                // Set values to attributes.
                self.attributes['editionCurrentTrack'] = editionTrackIndex;
                self.attributes['offsetInMilliseconds'] = 0;
                self.attributes['playbackEditionCurrentTrackChanged'] = true;

                controller.play.call(self);
            });      

            currentConnection.end();
        },
        playPrevious: function () {
            /*
             *  Called when AMAZON.PreviousIntent or PlaybackController.PreviousCommandIssued is invoked.
             *  editionListIndex is computed using token stored when AudioPlayer.PlaybackStopped command is received.
             *  If reached at the end of the playlist, choose behavior based on "loop" flag.
             */
            var self = this;
            var editionTrackIndex = 1;
            
            if (typeof(self.attributes['editionCurrentTrack']) == "undefined" || isNaN(Number(self.attributes['editionCurrentTrack'])))
                editionTrackIndex = 1;
            else
                editionTrackIndex = Number(self.attributes['editionCurrentTrack']);

            editionTrackIndex--;

            // Check for last audio file.
            if (editionTrackIndex < 1) {
                if (self.attributes['loop']) {
                    var currentConnection = getMySQLConnection();
                    
                    currentConnection.query("SELECT MAX(`track_number`) FROM `tbl_edition_tracks` WHERE `edition_id` = ?", [self.attributes["currentEditionId"]], function(error, results, fields) {
                        if (error) throw error;

                        editionTrackIndex = results[0].track_number;

                        // Set values to attributes.
                        self.attributes['editionCurrentTrack'] = editionTrackIndex;
                        self.attributes['offsetInMilliseconds'] = 0;
                        self.attributes['playbackEditionCurrentTrackChanged'] = true;

                        controller.play.call(self);
                        return;
                    });

                    currentConnection.end();
                } else {
                    // Reached at the end. Thus reset state to start mode and stop playing.
                    self.handler.state = constants.states.START_MODE;

                    self.attributes["offsetInMilliseconds"] = 0;
                    self.attributes["editionCurrentTrack"] = 1;

                    var message = strings.previous_track_end_of_list;
                    self.response.speak(message);
                    
                    try {
                        self.response.audioPlayerStop();
                    } catch (ex) {
                        console.log("Error in stopping playback: ", ex);
                    }
                    return self.emit(':responseReady');
                }
            }
            // Set values to attributes.
            self.attributes['editionCurrentTrack'] = editionTrackIndex;
            self.attributes['offsetInMilliseconds'] = 0;
            self.attributes['playbackEditionCurrentTrackChanged'] = true;

            controller.play.call(self);
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
            this.attributes['editionCurrentTrack'] = 1;
            this.attributes['offsetInMilliseconds'] = 0;
            this.attributes['playbackEditionCurrentTrackChanged'] = true;
            this.attributes["playbackFinished"] = true;
            this.attributes["currentEditionId"] = null;
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

function getMySQLConnection() {
    var connection = mysql.createConnection({
        host: appInfo.mysql_data.host,
        user: appInfo.mysql_data.username,
        password: appInfo.mysql_data.password,
        database: appInfo.mysql_data.database_name,
        ssl: "Amazon RDS"
    });

    connection.connect();

    return connection;
}

function getThursdayOfISOWeek(w, y) {
    var simple = new Date(y, 0, 1 + (w - 1) * 7);
    var dow = simple.getDay();
    var ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

    ISOweekStart = ISOweekStart.setDate(result.getDate() + 3); // add 3 days as the ISO week begins on a Monday

    var month = '' + (ISOweekStart.getMonth() + 1),
        day = '' + ISOweekStart.getDate(),
        year = ISOweekStart.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

function getDateAsNumber(stringDate) {
    var recorded_date = new Date(stringDate);
    var recorded_year = recorded_date.getFullYear();
    var recorded_month = recorded_date.getMonth() + 1;
    var recorded_day = recorded_date.getDate();
    
    if (recorded_month.toString().length < 2)
        recorded_month = "0".concat(recorded_month);

    if (recorded_day.toString().length < 2)
        recorded_day = "0".concat(recorded_day);

    return [recorded_year, recorded_month, recorded_day].join('');
}