/*
 * To Find videoId in Rhythm System:
 *   1. Upload Video to instream, safest to create new line item for this video
 *   2. In AdOps UI, search Creative using name used to upload video and look at url for unique id,
 *      for example: https://mp.rnmd.net/adops/creative_videos/61729  - 61729
 *   3. Look at Video Preview URL Source at: http://mp.rnmd.net/adops/creative_videos/61729/preview
 *   4. Find videoId by inspecting flv url: ...15_mp3_ab32000_ap0/00003440-11405565.flv  - 00003440-11405565
 *   5. 00003440-11405565 is the videoId to pass in
 *
 */
 
var insideRhythmSDK = false;
net.rnmd.sdk.rhythmAdDisplayed = function() {
    net.rnmd.sdk.rhythmPinAd();
    insideRhythmSDK = true;
}

function $(id){return document.getElementById(id);}

var videoElement;
eVideo.src =  "http://stream.geo.rnmd.net/directindex/master/"+ eVideo.videoId+".m3u8?vdm=HLS&appId=mraid-ad-unit&userId=mraid-ad-unit";
var intervals;
var quarTiles = 1;
var runIdParam= "&runId="+eVideo.runId;
if(eVideo.runId === undefined || eVideo.runId === ""){
    runIdParam = "";
}
var impTrackingUrl = "http://rhythmtrk.rnmd.net/event/thirdPartyEvent?category=RhythmTracking&action=28&label="+eVideo.impLabel+"&adId="+ eVideo.adId +runIdParam;
var clickTrackingUrl = "http://rhythmtrk.rnmd.net/event/thirdPartyEvent?category=RhythmTracking&action=29&label="+eVideo.clickLabel+"&adId="+eVideo.adId+runIdParam;

var overlay_wants_endcard = false;
var video_completed = false;

var mraidCounter = 0;
var mraidAvailable = true;
if (typeof mraid === "undefined") {
    var mraid;
}

//mraid object stub for when mraid is not available
function createMraidStub(){
    mraid = new Object();   
    mraid.isViewable = function(){
        return true;
    };
    mraid.getState =function(){
        return "default";
    }
    mraid.expand = function(){
        return false;
    }
    mraid.addEventListener = function(arg1, callback){
        return false;
    }    
    mraid.removeEventListener = function(arg1, callback){
        return false;
    }
    mraid.close = function(){
        return false;
    }
}
//mraid object end    

// wait for document to load, then check for mraid object
window.addEventListener("load", function(){
    var loadinterval = setInterval(function(){
        mraidCounter++;        
        if(mraidCounter > 10){ // mraid not instantiated yet, so falling back to browser mode
            mraidAvailable = false;
            createMraidStub();
        }
        if(typeof mraid !== "undefined"){
            clearInterval(loadinterval);
            var videotag = document.createElement('VIDEO');
            videotag.setAttribute('id', eVideo.id);
            videotag.setAttribute('webkit-playsinline', '');
            videotag.setAttribute('src', eVideo.src);
            document.body.appendChild(videotag);
/*
            var styleTag = document.createElement('style');
            document.head.appendChild(styleTag);            
            var addedCSS = document.createTextNode(
                'video{'+
                    'position:absolute;'+
                    'left:0px;'+
                    'top:0px;'+
                '}'+
                '@media (orientation:portrait) {'+
                    'body {'+
                         '-webkit-transform:rotate(90deg);'+
                    '}'+               
                '}'                       
            );
            document.getElementsByTagName("style")[0].appendChild(addedCSS);    
*/            
            videoElement = $(eVideo.id);
            if(mraid.getState() === 'loading'){
                mraid.addEventListener('ready', applicationReady);  
            }else{
                    applicationReady();
            }
            resizeArea();
        }
    },100);
}, false);
    
function overlayIframe(){
    if (eVideo.overlayUrl !== '') {
        var iframeTag = document.createElement('IFRAME');
        iframeTag.setAttribute('src', eVideo.overlayUrl);
        iframeTag.setAttribute('id', "iframe_"+eVideo.id);
        document.body.appendChild(iframeTag);
        $("iframe_"+eVideo.id).onload = function(){
            sendMessage("SET_SDK_VERSION=5.4.2");
            sendMessage("OVERRIDE_SDK_CALLS");
        };
        $("iframe_"+eVideo.id).style.position = "absolute";
        $("iframe_"+eVideo.id).style.bottom = "0px";
        $("iframe_"+eVideo.id).style.left = "0px";
        $("iframe_"+eVideo.id).style.zIndex = "99999";  
        $("iframe_"+eVideo.id).style.border = "none";              
        $("iframe_"+eVideo.id).width = "100%";
        $("iframe_"+eVideo.id).height ="100%";
    }
}

function expandAndPlay() {
//    mraid.useCustomClose(true);
 //  var properties = mraid.getExpandProperties();
////mraid.setOrientationProperties({"allowOrientationChange":true});
  //  mraid.setExpandProperties({width:properties.height, height:properties.width, useCustomClose: false}); 
    window.setTimeout(function(){mraid.expand();},200); // need to delay so that sdk has chance to see the webview uri event
    try{
      videoElement.play();
    }catch(e){
       console.log(e);
    }
    overlayIframe();
    mraid.addEventListener('stateChange', closeAd);
}

function applicationReady(){
    videoElement.addEventListener('playing', function(){
        sendMessage("AD_DISPLAYED");
        // call impression tracking url
        impressionTracking();
        quartileTracking(53, "vast_start");
            intervals = setInterval(function(){
                    switch(quarTiles){
                        case 1: if(getQuartile(videoElement.currentTime, videoElement.duration, 25)){
                                    //Fire 25%
                                    quartileTracking(54, "vast_firstQuartile");
                                }   
                             break;
                        case 2: if(getQuartile(videoElement.currentTime, videoElement.duration, 50)){
                                    //Fire 50%
                                    quartileTracking(55, "vast_midpoint");
                                }
                             break;
                        case 3: if(getQuartile(videoElement.currentTime, videoElement.duration, 75)){
                                    //Fire 75%
                                    quartileTracking(56, "vast_thirdQuartile");
                                }
                             break;
                        case 4: if(getQuartile(videoElement.currentTime, (videoElement.duration-0.5), 100)){ // 0.5 in case video duration is off
                                    //Fire 100%
                                    quartileTracking(57, "vast_complete");
                                    video_completed = true;
                                    clearInterval(intervals);
                                    videoElement.removeEventListener("playing", arguments.callee);
                                    if (overlay_wants_endcard) {
                                        sendMessage("PAUSED_FOR_ENDCARD");
                                    } else if (mraidAvailable) {
                                        mraid.close();
                                    }
                                }
                             break;
                    }                   
                }, 500); 
        this.removeEventListener('playing',arguments.callee,false);
    }, false);
    
    videoElement.addEventListener('click', function(){
        // call click tracking            
        this.pause();
        this.removeEventListener('click',arguments.callee,false);
        clickTracking(); 
    },false);

    if(mraid.isViewable()){//first time load
        expandAndPlay();
    }else{
        videoElement.pause();            
        mraid.addEventListener('viewableChange', function(){ //wait for event
            if(mraid.isViewable()){
                mraid.removeEventListener('viewableChange', arguments.callee);// remove attached event    
//videoElement.play();                
                expandAndPlay();
            }
        });
    }
}

function closeAd(){
    if(mraid.getState() === 'default'){ // User tapped expand's close button
        videoElement.pause();
        if (insideRhythmSDK) {
            window.setTimeout(function(){
                    net.rnmd.sdk.rhythmUnpinAd();
            }, 200);
        }
    }
}
    
// get percentage played
function getQuartile(currentTime, totalTime, percent){
    if(currentTime >= ((percent / 100) * totalTime )){
        quarTiles++;
        return true;
    }else{
        return false;
    }
}
////impression tracking
function impressionTracking(){
    var impressionPixel = new Image();
    impressionPixel.src = impTrackingUrl;
}

//click tracking
function clickTracking(){
    var clickPixel = new Image();
    clickPixel.src = clickTrackingUrl;
    setTimeout(function(){ window.location = eVideo.clickUrl; },300);
}
//quartile tracking
function quartileTracking(quartileAction, quartileLabel){
    var quartilePixel = new Image();
    quartilePixel.src = "http://rhythmtrk.rnmd.net/event/thirdPartyEvent?category=RhythmTracking&action="+quartileAction+"&label="+quartileLabel+"&adId="+ eVideo.adId +runIdParam;
}

window.addEventListener("orientationchange", resizeArea, false);
window.addEventListener("resize", resizeArea, false);

function resizeArea(){       
    var tWidth = window.innerWidth;
    var tHeight = window.innerHeight;
    if($(eVideo.id) !== null){
        $(eVideo.id).style.width = tWidth+'px';
        $(eVideo.id).style.height = tHeight+'px';
    }
}   

receiveMessage = function (e) {
    if (/REGISTER_FOR_ENDCARD/.test(e.data)) {
        overlay_wants_endcard = true;
    } else if (/PLAY_VIDEO/.test(e.data)) {
        if (video_completed) {
            if (mraidAvailable) {
                mraid.close();
            } else {
                closeAd();
            }
        } else {
            $(eVideo.id).play();
        }
    } else if (/PAUSE_VIDEO/.test(e.data)) {
        $(eVideo.id).pause();
    }
};
window.addEventListener("message", receiveMessage, false);    
    
function sendMessage(msg){
    $("iframe_"+eVideo.id).contentWindow.postMessage(msg, "*");
}
    
