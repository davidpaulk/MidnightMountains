var Sound = {
   play: function(file, loop) {
      var audio = document.createElement('audio');
      audio.src = file;
      if (loop) {
          audio.loop = true;
      }
      audio.play();
      return audio;
  },
  stop: function(audio) {
    audio.pause();
  }
}
