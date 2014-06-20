/*
	output: once the song has been loaded the the below attributes are available
*/
var playSpeed;
var maxSubsong;
var actualSubsong;
var songName;
var songAuthor;
var songReleased;

var sourceBuffer;

function tinyRSID_loadData(arrayBuffer) {
  if (arrayBuffer) {
    var byteArray = new Uint8Array(arrayBuffer);

	var buf = Module._malloc(byteArray.length);
	Module.HEAPU8.set(byteArray, buf);
	var ret = Module.ccall('loadSidFile', 'number', ['number', 'number'], [buf, byteArray.length]);
	Module._free(buf);
													
	var array = Module.HEAP32.subarray(ret>>2, (ret>>2)+7);
	var loadAddr= Module.HEAP32[((array[0])>>2)]; // i32
	playSpeed= Module.HEAP32[((array[1])>>2)]; // i32
	maxSubsong= Module.HEAP8[(array[2])]; // i8
	actualSubsong= Module.HEAP8[(array[3])]; // i8
	songName= Module.Pointer_stringify(array[4]);
	songAuthor= Module.Pointer_stringify(array[5]);
	songReleased= Module.Pointer_stringify(array[6]);	
	sourceBuffer= Module.ccall('getSoundBuffer', 'number');
  }
}

function tinyRSID_playSong(id) {
  Module.ccall('playTune', 'number', ['number'], [id]);
}

var numberOfSamplesRendered= 0;
var numberOfSamplesToRender= 0;
var sourceBufferIdx=0;
var isPaused= 0;

function tinyRSID_genSamples(event) {
	var output = event.outputBuffer.getChannelData(0);

	if (isPaused === 1) {
		var i;
		for (i= 0; i<output.length; i++) {
			output[i]= 0;
		}		
	} else {
		var outSize= output.length;
		numberOfSamplesRendered = 0;		
		
		while (numberOfSamplesRendered < outSize)
		{
			if (numberOfSamplesToRender == 0) {
				numberOfSamplesToRender = Module.ccall('computeAudioSamples', 'number');
				sourceBufferIdx=0;			
			}
			
			var srcBufI32= sourceBuffer>>2;
			if (numberOfSamplesRendered + numberOfSamplesToRender > outSize) {
				var availableSpace = outSize-numberOfSamplesRendered;
				
				var i;
				for (i= 0; i<availableSpace; i++) {
					output[i+numberOfSamplesRendered]= Module.HEAP32[srcBufI32+sourceBufferIdx]/(0x8000);
					sourceBufferIdx+=1;
				}				
				numberOfSamplesToRender -= availableSpace;
				numberOfSamplesRendered = outSize;
			} else {
				var i;
				for (i= 0; i<numberOfSamplesToRender; i++) {
					output[i+numberOfSamplesRendered]= Module.HEAP32[srcBufI32+sourceBufferIdx]/(0x8000);
					sourceBufferIdx+=1;
				}						
				numberOfSamplesRendered += numberOfSamplesToRender;
				numberOfSamplesToRender = 0;
			} 
		}  
	}	
}

function initialAudioSetup() {
	if (typeof bufferSource != 'undefined') { 
		bufferSource.stop(0);
	} else {
		setupAudioNodes();
	}
}

function setupAudioNodes() {
	if (typeof audioCtx == 'undefined') {
		try {
			window.AudioContext = window.AudioContext||window.webkitAudioContext;
			audioCtx = new AudioContext();
		} catch(e) {
			alert('Web Audio API is not supported in this browser (get Chrome 18 or Firefox 26)');
		}
		analyzerNode = audioCtx.createAnalyser();
		var rsidNode = audioCtx.createScriptProcessor(SAMPLES_PER_BUFFER, 0, 1);
		rsidNode.onaudioprocess = tinyRSID_genSamples;		
		gainNode = audioCtx.createGain();					
		rsidNode.connect(gainNode);
		gainNode.connect(analyzerNode);
		analyzerNode.connect(audioCtx.destination);
	}
}
// getByteFrequencyData() 
function startMusicPlayback() {
	isPaused= 0;
	if (typeof bufferSource === 'undefined') {
		bufferSource = audioCtx.createBufferSource();
		if (!bufferSource.start) {
		  bufferSource.start = bufferSource.noteOn;
		  bufferSource.stop = bufferSource.noteOff;		  
		}
		bufferSource.start(0);	

	}
}

function playSong(song,subsong) {
	
	var xhr = new XMLHttpRequest();
	xhr.open("GET", song, true);
	xhr.responseType = "arraybuffer";

	xhr.onload = function (oEvent) {
		isPaused= 1;		
		tinyRSID_loadData(xhr.response);  
		tinyRSID_playSong(subsong);
		isPaused= 0;
		initialAudioSetup();			
		startMusicPlayback();
	};
	xhr.send(null);
}

function songHasStopped(){
	/*
	This is a super ugly hack to check if a song is done playing
	and starting it again. It basically checks if the first three values
	in the data array are all 0 (we could as well test more or less values)
	and if they are, restart the song.
	songIsPlaying is needed because we want to track only after
	the song has really started playing (thus having values in the array)
	Needs more work.
	*/
	array = new Uint8Array(analyzerNode.frequencyBinCount);
    analyzerNode.getByteFrequencyData(array); 
    if (array[0] != 0){
    	songIsPlaying = true;
    }     
    if (songIsPlaying){
	    if (array[0] + array[1] + array[2] == 0){
	      return true;
	    }else{
	    	return false;
	    }
	}
    
}
