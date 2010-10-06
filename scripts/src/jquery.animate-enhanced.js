/************************************************
	jquery.animate-enhanced plugin v0.45
	Author: www.benbarnett.net || @benpbarnett
*************************************************

Extends $.animate() to automatically use CSS3 transformations where applicable.
Requires jQuery 1.4.2+

Supports -moz-transition, -webkit-transition, -o-transition, transition
	
Targetted properties (for now):
	- left
	- top
	- opacity
	
Usage (exactly the same as it would be normally):
	
	$(element).animate({left: 200},  500, function() {
		// callback
	});
	
Changelog:
	0.45 (06/10/2010):
		- 'Zero' position bug fix (was originally translating by 0 zero pixels, i.e. no movement)

	0.4 (05/10/2010):
		- Iterate over multiple elements and store transforms in $.data perelement
		- Include support for relative values (+= / -=)
		- Better unit sanitization
		- Performance tweaks
		- Fix for optional callback function (was required)
		- Applies data[translateX] and data[translateY] to elements for easy access
		- Added 'easeInOutQuint' easing function for CSS transitions (requires jQuery UI for JS anims)
		- Less need for leaveTransforms = true due to better position detections

	
*********/

(function($) {
	// ----------
	// Plugin variables
	// ----------
	var cssTransitionsSupported = false,
		originalAnimateMethod = $.fn.animate,
		cssTransitionProperties = ["top", "left", "opacity"],
		cssPrefixes = ["", "-webkit-", "-moz-", "-o-"],
		pluginOptions = ["avoidTransforms", "useTranslate3d", "leaveTransforms"],
		callbackQueue = 0,
		rfxnum = /^([+-]=)?([\d+-.]+)(.*)$/;
		
		
	
	// ----------
	// Check if this browser supports CSS3 transitions
	// ----------
	var thisBody = document.body || document.documentElement,
   		thisStyle = thisBody.style,
		transitionEndEvent = (thisStyle.WebkitTransition !== undefined) ? "webkitTransitionEnd" : (thisStyle.OTransition !== undefined) ? "oTransitionEnd" : "transitionend";
	
	cssTransitionsSupported = thisStyle.WebkitTransition !== undefined || thisStyle.MozTransition !== undefined || thisStyle.OTransition !== undefined || thisStyle.transition !== undefined;
	
	
	// ----------
	// Interpret value ("px", "+=" and "-=" sanitisation)
	// ----------
	$.fn.interpretValue = function(e, val, prop) {
		var parts = rfxnum.exec(val),
			start = e.css(prop) === "auto" ? 0 : e.css(prop),
			cleanCSSStart = typeof start == "string" ? start.replace(/px/g, "") : start,
			cleanTarget = typeof val == "string" ? val.replace(/px/g, "") : val,
			cleanStart = 0;
			
		if (prop == "left" && e.data('translateX')) cleanStart = cleanCSSStart + e.data('translateX');
		if (prop == "top" && e.data('translateY')) cleanStart = cleanCSSStart + e.data('translateY');
		
		if (parts) {
			var end = parseFloat(parts[2]);

			// If a +=/-= token was provided, we're doing a relative animation
			if (parts[1]) {
				end = ((parts[1] === "-=" ? -1 : 1) * end) + parseInt(cleanStart, 10);
			}

			return end;

		} else {
			return clean;
		}
	};
	
	
	// ----------
	// Make a translate or translate3d string
	// ----------
	$.fn.getTranslation = function(x, y, use3D) {
		return (use3D === true) ? "translate3d("+x+"px,"+y+"px,0)" : "translate("+x+"px,"+y+"px)";
	};
	
	
	// ----------
	// Build up the CSS object
	// ----------
	$.fn.applyCSSTransition = function(e, property, duration, easing, value, isTransform, use3D) {
		if (!e.data('cssEnhanced')) {
			var setup = { secondary: {}, meta: { left: 0, top: 0 } };
			e.data('cssEnhanced', setup);
		}
		
		if (property == "left" || property == "top") {
			var meta = e.data('cssEnhanced').meta;
			meta[property] = value;
			meta[property+'_o'] = e.css(property) == "auto" ? 0 + value : parseInt(e.css(property).replace(/px/g, ''), 10) + value || 0;
			e.data('cssEnhanced').meta = meta;
			
			// fix 0 issue (transition by 0 = nothing)
			if (isTransform && value === 0) {
				value = 0 - meta[property+'_o'];
				meta[property] = value;
				meta[property+'_o'] = 0;
			}
		}
		
		return e.data('cssEnhanced', $.fn.applyCSSWithPrefix(e.data('cssEnhanced'), property, duration, easing, value, isTransform, use3D));
	};
	
	
	// ----------
	// Helper function to build up CSS properties using the various prefixes
	// ----------
	$.fn.applyCSSWithPrefix = function(cssProperties, property, duration, easing, value, isTransform, use3D) {
		cssProperties = typeof cssProperties === 'undefined' ? {} : cssProperties;
		cssProperties.secondary = typeof cssProperties.secondary === 'undefined' ? {} : cssProperties.secondary;
		
		for (var i = cssPrefixes.length - 1; i >= 0; i--){			
			if (typeof cssProperties[cssPrefixes[i] + 'transition-property'] === 'undefined') cssProperties[cssPrefixes[i] + 'transition-property'] = '';
			cssProperties[cssPrefixes[i]+'transition-property'] += ', ' + ((isTransform === true) ? cssPrefixes[i] + 'transform' : property);
			cssProperties[cssPrefixes[i]+'transition-duration'] = duration + 'ms';
			cssProperties[cssPrefixes[i]+'transition-timing-function'] = easing;
			cssProperties.secondary[((isTransform === true) ? cssPrefixes[i]+'transform' : property)] = (isTransform === true) ? $.fn.getTranslation(cssProperties.meta.left, cssProperties.meta.top, use3D) : value;
		};
		
		return cssProperties;
	};
	
	
	// ----------
	// The new $.animate() function
	// ----------
	$.fn.animate = function(prop, speed, easing, callback) {
		if (!cssTransitionsSupported || $.isEmptyObject(prop)) return originalAnimateMethod.apply(this, arguments);
		
		callbackQueue = 0;
		
		var opt = speed && typeof speed === "object" ? speed : {
			complete: callback || !callback && easing || $.isFunction( speed ) && speed,
			duration: speed,
			easing: callback && easing || easing && !$.isFunction(easing) && easing
		}, 	
		propertyCallback = function() {	
			callbackQueue--;
			if (callbackQueue <= 0) { 			
				// we're done, trigger the user callback
				if (typeof opt.complete === 'function') return opt.complete.call();
			}
		},
		cssCallback = function() {
			var reset = {};
			for (var i = cssPrefixes.length - 1; i >= 0; i--){
				reset[cssPrefixes[i]+'transition-property'] = 'none';
				reset[cssPrefixes[i]+'transition-duration'] = '';
				reset[cssPrefixes[i]+'transition-timing-function'] = '';
			};
		
			// convert translations to left & top for layout
			if (!prop.leaveTransforms === true) {
				var that = $(this),
					props = that.data('cssEnhanced') || {},
					restore = {
						'-webkit-transform': '',
						'-moz-transform': '',
						'-o-transform': '',
						'transform': ''
					};

				if (typeof props.meta !== 'undefined') {
					restore['left'] = props.meta.left_o + 'px';
					restore['top'] = props.meta.top_o + 'px';
				}
			
				that.css(reset).css(restore).data('translateX', 0).data('translateY', 0).data('cssEnhanced', null);
			}
			
			// run the main callback function
			propertyCallback();
		},
		easings = {
			bounce: 'cubic-bezier(0.0, 0.35, .5, 1.3)', 
			linear: 'linear',
			swing: 'ease-in-out',
			easeInOutQuint: 'cubic-bezier(0.5, 0, 0, 0.8)'
		},
		domProperties = null, cssEasing = "";
		
		// make easing css friendly
		cssEasing = opt.easing || "swing";
		cssEasing = easings[cssEasing] ? easings[cssEasing] : cssEasing;

		// seperate out the properties for the relevant animation functions
		for (p in prop) {
			if ($.inArray(p, pluginOptions) === -1) {
				this.each(function() {
					var that = $(this),
						cleanVal = $.fn.interpretValue(that, prop[p], p);
						
					if ($.inArray(p, cssTransitionProperties) > -1 && that.css(p).replace(/px/g, "") !== cleanVal) {
						$.fn.applyCSSTransition(
							that,
							p, 
							opt.duration, 
							cssEasing, 
							((p == "left" || p == "top") && prop.avoidTransforms === true) ? cleanVal + "px" : cleanVal, 
							(((p == "left" || p == "top") && prop.avoidTransforms !== true) ? true : false), 
							(prop.useTranslate3d === true) ? true : false);
					}
					else {
						domProperties = (!domProperties) ? {} : domProperties;
						domProperties[p] = prop[p];
					}
				});
			}
		}
		
		// clean up
		this.each(function() {
			var that = $(this),
				cssProperties = that.data('cssEnhanced') || {};
				
			for (var i = cssPrefixes.length - 1; i >= 0; i--){
				if (typeof cssProperties[cssPrefixes[i]+'transition-property'] !== 'undefined') cssProperties[cssPrefixes[i]+'transition-property'] = cssProperties[cssPrefixes[i]+'transition-property'].substr(2);
			}
			
			that.data('cssEnhanced', cssProperties);
		});
		

		// fire up DOM based animations
		if (domProperties) {
			callbackQueue++;
			originalAnimateMethod.apply(this, [domProperties, opt.duration, opt.easing, propertyCallback]);
		}
		
		
		// apply the CSS transitions
		this.each(function() {
			var that = $(this).unbind(transitionEndEvent);
			if (!$.isEmptyObject(that.data('cssEnhanced').secondary)) {
				callbackQueue++;
				that.css(that.data('cssEnhanced'));
				setTimeout(function(){ 
					that.bind(transitionEndEvent, cssCallback).css(that.data('cssEnhanced').secondary);
				});
			}
		});
	
		
		// over and out
		return this;
	};	
})(jQuery);