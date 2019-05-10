/*
	mixer_proxy is here to call mixer.isLoaded as early as possible.
	
	This is useful:
		* to have our content shown early, e.g. if we want to show loading screens while we're loading
		* for easier debugging, so we can see what's going on during loading
		* so that requestAnimationFrame is honored while we load the rest of the app.
			(in newer mixer xbox deployments, requestAnimationFrame won't work before isLoaded is called.)
			
	Since we can't call isLoaded until we've registered listeners for all the mixer events we want to get,
	we have to register them all right here up front.
	
	And since our game isn't really ready to listen to these events, we have to queue up any we get,
	and then pass them along to the game later when it's ready.
	
	Usage:
		include this module in your project
		make sure all the events you care about are hooked up below
		call mixerProxy.on instead of mixer.on
		call mixerProxy.isLoaded instead of mixer.isLoaded

*/

window.addEventListener('load', function initMixerProxy() {

	//	mixer proxy log function, looks for rat log and uses that.
	function mplog(msg)
	{
		if (rat && rat.console && rat.console.log)
			rat.console.log("" + msg);
	}
	
	mplog("mixerproxy v0.7 startup...");

	window.mixerProxy = {
		queued : [],	//	sequential (!) list of queued up messages as we received them
		handlers : {},
		ready : false,
	};
	
	//	handle to any type of mixer event
	var handleEverything = function(message, eventName)
	{
		//mplog("++ " + eventName);
		//mplog(message);
		
		//	got a handler for this event?  pass on to handler instead of storing.
		if (mixerProxy.handlers[eventName] && mixerProxy.ready)
		{
			//mplog("..>> to handler");
			mixerProxy.handlers[eventName](message);
			
		} else {
			//	no handler, store this for later
			//	but only if we're still starting up.
			if (!window.mixerProxy.ready)
			{
				mixerProxy.queued.push({eventName : eventName, message : message});
				mplog("++ " + eventName + " : have stored " + mixerProxy.queued.length);
			}
			
			//	otherwise, we're getting an event that's not handled by the game,
			//	so just let it go instead of storing it.
		}
	};
	
	//	register a real game event handler
	window.mixerProxy.on = function(eventName, callback)
	{
		//mplog("> registering callback for " + eventName);
		window.mixerProxy.handlers[eventName] = callback;
	};
	
	//	the game is ready to handle messages for all its registered events
	window.mixerProxy.isLoaded = function()
	{
		mplog("> isLoaded... have " + mixerProxy.queued.length + " events.");
		mixerProxy.ready = true;	//	future calls gets passed through directly.
		
		//	unload all the events I've queued.
		for (var i = 0; i < mixerProxy.queued.length; i++)
		{
			var oneEvent = mixerProxy.queued[i];
			var handler = mixerProxy.handlers[oneEvent.eventName];
			if (handler)
			{
				mplog("  unqueueing " + oneEvent.eventName);
				handler(oneEvent.message);
				
				//	delete this one and back up for next
				mixerProxy.queued.splice(i, 1);
				i--;
			}
		}
	};
	
	//	util to hook up one event
	var hookUpOne = function(eventName)
	{
		mixer.socket.on(eventName, function(message) {handleEverything(message, eventName);});
	};
	
	//	standard set of events we care about.  Maybe just list them all?
	hookUpOne('onParticipantUpdate');
	hookUpOne('onParticipantJoin');
	hookUpOne('onSceneUpdate');
	hookUpOne('onSceneCreate');
	hookUpOne('event');
	hookUpOne('onControlUpdate');
	
	//	and tell mixer we're loaded, so it shows our content
	mixer.isLoaded();
	
	//mplog("mixerproxy startup done.");
});
