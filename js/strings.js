'use strict';

var strings = {
    'start_mode_launch_message' : 'Welcome to Chatterbox, the Talking Newspaper. You can say, play the latest edition, play edition number 1950 or play last week\'s edition.',
    'start_mode_launch_reprompt' : 'You can say, play the audio, to begin.',
    'start_mode_help' : 'Welcome to Chatterbox, the Talking Newspaper. You can say, play the latest edition, play edition number 1950 or play last week\'s edition.',
    'play_mode_help' : 'You are listening to Chatterbox, the Talking Newspaper. You can say, Next or Previous to navigate through the edition. At any time, you can say Pause to pause the audio and Resume to resume.',
    'play_mode_unhandled_request' : 'Sorry, I could not understand. You can say, Next or Previous to navigate through the edition.',
    'resume_launch_message' : 'You were listening to edition number <say-as interpret-as="cardinal">{0}</say-as>, recorded on <say-as interpret-as="date" format="dmy">{1}</say-as>. Would you like to resume?',
    'resume_launch_reprompt' : 'You can say yes to resume or no to play from the top.',
    'resume_help_message' : 'You were listening to {0}. Would you like to resume?',
    'resume_unhandled_request' : 'Sorry, this is not a valid command. Please say "help", to hear what you can say.',
    'unhandled_request' : 'Sorry, I could not understand. Please say, play the audio, to begin the Chatterbox Talking Newspaper edition.',
    'exit_message' : 'Goodbye.',
    'next_track_end_of_list' : 'You have reached at the end of this edition.',
    'previous_track_end_of_list' : 'You have reached at the start of the playlist.',
    'no_shuffle' : 'I\'m sorry. Chatterbox Talking Newspaper tracks cannot be shuffled.',
    'edition_unavailable' : 'I\'m sorry, edition number {0} is currently unavailable',
    'edition_no_number_unavailable' : 'I\'m sorry. This edition is currently unavailable',
    'playing_edition_date' : 'Playing edition number <say-as interpret-as="cardinal">{0}</say-as>, recorded on <say-as interpret-as="date" format="dmy">{1}</say-as>.',
    'cannot_play_audio' : 'I\'m sorry. There has been a problem playing this Chatterbox edition. Please try again later.'
}

module.exports = strings;