/* Tests for the playlist utilities */
(function(window, videojs) {
  'use strict';
  var Playlist = videojs.Hls.Playlist;

  module('Playlist Utilities');

  test('total duration for live playlists is Infinity', function() {
    var duration = Playlist.duration({
      segments: [{
        duration: 4,
        uri: '0.ts'
      }]
    });

    equal(duration, Infinity, 'duration is infinity');
  });

  test('interval duration accounts for media sequences', function() {
    var duration = Playlist.duration({
      mediaSequence: 10,
      endList: true,
      segments: [{
        duration: 10,
        uri: '10.ts'
      }, {
        duration: 10,
        uri: '11.ts'
      }, {
        duration: 10,
        uri: '12.ts'
      }, {
        duration: 10,
        uri: '13.ts'
      }]
    }, 0, 14);

    equal(duration, 14 * 10, 'duration includes dropped segments');
  });

  test('interval duration uses PTS values when available', function() {
    var duration = Playlist.duration({
      mediaSequence: 0,
      endList: true,
      segments: [{
        minVideoPts: 1,
        minAudioPts: 2,
        uri: '0.ts'
      }, {
        duration: 10,
        maxVideoPts: 2 * 10 * 1000 + 1,
        maxAudioPts: 2 * 10 * 1000 + 2,
        uri: '1.ts'
      }, {
        duration: 10,
        maxVideoPts: 3 * 10 * 1000 + 1,
        maxAudioPts: 3 * 10 * 1000 + 2,
        uri: '2.ts'
      }, {
        duration: 10,
        maxVideoPts: 4 * 10 * 1000 + 1,
        maxAudioPts: 4 * 10 * 1000 + 2,
        uri: '3.ts'
      }]
    }, 0, 4);

    equal(duration, ((4 * 10 * 1000 + 2) - 1) * 0.001, 'used PTS values');
  });

  test('interval duration works when partial PTS information is available', function() {
    var firstInterval, secondInterval, duration = Playlist.duration({
      mediaSequence: 0,
      endList: true,
      segments: [{
        minVideoPts: 1,
        minAudioPts: 2,
        maxVideoPts: 1 * 10 * 1000 + 1,

        // intentionally less duration than video
        // the max stream duration should be used
        maxAudioPts: 1 * 10 * 1000 + 1,
        uri: '0.ts'
      }, {
        duration: 10,
        uri: '1.ts'
      }, {
        duration: 10,
        minVideoPts: 2 * 10 * 1000 + 7,
        minAudioPts: 2 * 10 * 1000 + 10,
        maxVideoPts: 3 * 10 * 1000 + 1,
        maxAudioPts: 3 * 10 * 1000 + 2,
        uri: '2.ts'
      }, {
        duration: 10,
        maxVideoPts: 4 * 10 * 1000 + 1,
        maxAudioPts: 4 * 10 * 1000 + 2,
        uri: '3.ts'
      }]
    }, 0, 4);

    firstInterval = (1 * 10 * 1000 + 1) - 1;
    firstInterval *= 0.001;
    secondInterval = (4 * 10 * 1000 + 2) - (2 * 10 * 1000 + 7);
    secondInterval *= 0.001;

    equal(duration, firstInterval + 10 + secondInterval, 'calculated with mixed intervals');
  });

  test('interval duration accounts for discontinuities', function() {
    var duration = Playlist.duration({
      mediaSequence: 0,
      endList: true,
      segments: [{
        minVideoPts: 0,
        minAudioPts: 0,
        maxVideoPts: 1 * 10 * 1000,
        maxAudioPts: 1 * 10 * 1000,
        uri: '0.ts'
      }, {
        discontinuity: true,
        minVideoPts: 2 * 10 * 1000,
        minAudioPts: 2 * 10 * 1000,
        maxVideoPts: 3 * 10 * 1000,
        maxAudioPts: 3 * 10 * 1000,
        duration: 10,
        uri: '1.ts'
      }]
    }, 0, 2);

    equal(duration, 10 + 10, 'handles discontinuities');
  });

  test('calculates seekable time ranges from the available segments', function() {
    var playlist = {
      mediaSequence: 0,
      segments: [{
        duration: 10,
        uri: '0.ts'
      }, {
        duration: 10,
        uri: '1.ts'
      }],
      endList: true
    }, seekable = Playlist.seekable(playlist);

    equal(seekable.length, 1, 'there are seekable ranges');
    equal(seekable.start(0), 0, 'starts at zero');
    equal(seekable.end(0), Playlist.duration(playlist), 'ends at the duration');
  });

  test('master playlists have empty seekable ranges', function() {
    var seekable = Playlist.seekable({
      playlists: [{
        uri: 'low.m3u8'
      }, {
        uri: 'high.m3u8'
      }]
    });
    equal(seekable.length, 0, 'no seekable ranges from a master playlist');
  });

  test('seekable end is three target durations from the actual end of live playlists', function() {
    var seekable = Playlist.seekable({
      mediaSequence: 0,
      segments: [{
        duration: 7,
        uri: '0.ts'
      }, {
        duration: 10,
        uri: '1.ts'
      }, {
        duration: 10,
        uri: '2.ts'
      }, {
        duration: 10,
        uri: '3.ts'
      }]
    });
    equal(seekable.length, 1, 'there are seekable ranges');
    equal(seekable.start(0), 0, 'starts at zero');
    equal(seekable.end(0), 7, 'ends three target durations from the last segment');
  });

  test('adjusts seekable to the live playlist window', function() {
    var seekable = Playlist.seekable({
      targetDuration: 10,
      mediaSequence: 7,
      segments: [{
        uri: '8.ts'
      }, {
        uri: '9.ts'
      }, {
        uri: '10.ts'
      }, {
        uri: '11.ts'
      }]
    });
    equal(seekable.length, 1, 'there are seekable ranges');
    equal(seekable.start(0), 10 * 7, 'starts at the earliest available segment');
    equal(seekable.end(0), 10 * 8, 'ends three target durations from the last available segment');
  });

  test('seekable end accounts for non-standard target durations', function() {
    var seekable = Playlist.seekable({
      targetDuration: 2,
      mediaSequence: 0,
      segments: [{
        duration: 2,
        uri: '0.ts'
      }, {
        duration: 2,
        uri: '1.ts'
      }, {
        duration: 1,
        uri: '2.ts'
      }, {
        duration: 2,
        uri: '3.ts'
      }, {
        duration: 2,
        uri: '4.ts'
      }]
    });
    equal(seekable.start(0), 0, 'starts at the earliest available segment');
    equal(seekable.end(0),
          9 - (2 * 3),
          'allows seeking no further than three target durations from the end');
  });

})(window, window.videojs);
