var H5P = H5P || {};

/**
 * DragQuestion module.
 *
 * @param {jQuery} $
 */
H5P.DragQuestion = (function ($) {

  /**
   * Initialize module.
   *
   * @param {Object} options Run parameters
   * @param {Number} id Content identification
   */
  function C(options, id) {
    var self = this;
    
    this.$ = $(this);
    this.id = id;
    this.options = $.extend(true, {}, {
      scoreShow: 'Show score',
      correct: 'Solution',
      tryAgain: 'Try again',
      question: {
        settings: {
          size: {
            width: 620,
            height: 310
          }
        },
        task: {
          elements: [],
          dropZones: []
        }
      },
      enableTryAgain: true,
      preventResize: false,
      displaySolutionsButton: true,
      postUserStatistics: (H5P.postUserStatistics === true),
      singlePoint: true,
      showSolutionsRequiresInput: true
    }, options);

    this.draggables = [];
    this.dropZones = [];
    this.answered = false;
    this.blankIsCorrect = true;
    this.displayingSolution = false;
    
    // Create map over correct drop zones for elements
    var task = this.options.question.task;
    this.correctDZs = [];
    for (var i = 0; i < task.dropZones.length; i++) {
      var correctElements = task.dropZones[i].correctElements;
      for (var j = 0; j < correctElements.length; j++) {
        var correctElement = correctElements[j];
        if (this.correctDZs[correctElement] === undefined) {
          this.correctDZs[correctElement] = [];
        }
        this.correctDZs[correctElement].push(i);
      }
    }
    
    this.weight = 1;
    
    // TODO: Initialize elements and drop zones here!
    
    // Add draggable elements
    var task = this.options.question.task;
    for (var i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];
      
      if (element.dropZones === undefined || !element.dropZones.length) {
        continue; // Not a draggable
      }

      // Create new draggable instance
      this.draggables[i] = new Draggable(element, i);
      this.draggables[i].$.on('answered', function () {
        self.answered = true;
        self.$.trigger('h5pQuestionAnswered');
      });
    }
    
    // Add drop zones
    for (var i = 0; i < task.dropZones.length; i++) {
      var dropZone = task.dropZones[i];
      
      if (this.blankIsCorrect && dropZone.correctElements.length) {
        this.blankIsCorrect = false;
      }

      this.dropZones[i] = new DropZone(dropZone, i);
    }
  };

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    // If reattaching, we no longer show solution. So forget that we
    // might have done so before.
    this.displayingSolution = false;

    this.$container = $container.addClass('h5p-dragquestion').html('<div class="h5p-inner"></div>').children();
    if (this.options.question.settings.background !== undefined) {
      this.$container.css('backgroundImage', 'url("' + H5P.getPath(this.options.question.settings.background.path, this.id) + '")');
    }

    // Add show score button
    if (this.options.displaySolutionsButton === true) {
      this.addSolutionButton();
    }

    var $element, task = this.options.question.task;

    // Add elements (static and draggable)
    for (var i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];

      if (element.dropZones !== undefined && element.dropZones.length !== 0) {
        // Attach draggable elements
        this.draggables[i].appendTo(this.$container, this.id);
      }
      else {
        // Add static element
        $element = this.addElement(element, 'static', i);
        C.setOpacity($element, 'background', element.backgroundOpacity);
        H5P.newRunnable(element.type, this.id, $element);
      }
    }
    
    // Attach drop zones
    for (var i = 0; i < this.dropZones.length; i++) {
      this.dropZones[i].appendTo(this.$container, this.draggables);
    }

    if (this.options.preventResize !== false) {
      this.$.trigger('resize');
    }
  };
  
  /**
   * Makes sure element gets correct opacity when hovered.
   *
   * @param {jQuery} $element
   * @param {Object} element
   */
  C.addHover = function ($element, backgroundOpacity) {
    $element.hover(function () {
      C.setElementOpacity($element, backgroundOpacity);
    }, function () {
      C.setElementOpacity($element, backgroundOpacity);
    });
    C.setElementOpacity($element, backgroundOpacity);
  };
  
  /**
   * Makes element background, border and shadow transparent.
   *
   * @param {jQuery} $element
   * @param {Number} opacity
   */
  C.setElementOpacity = function ($element, opacity) {
    C.setOpacity($element, 'borderColor', opacity);
    C.setOpacity($element, 'boxShadow', opacity);
    C.setOpacity($element, 'background', opacity);
  };

  /**
   * Add solution button to our container.
   */
  C.prototype.addSolutionButton = function () {
    var that = this;

    if (this._$solutionButton !== undefined) {
      return;
    }

    this._$solutionButton = $('<button type="button" class="h5p-button">' + this.options.scoreShow + '</button>').appendTo(this.$container).click(function () {
      if (that.getAnswerGiven()) {
        that.showSolutions();
        if (that.options.postUserStatistics === true) {
          H5P.setFinished(that.id, that.getScore(), that.getMaxScore());
        }
      }
    });
  };
  
  /**
   * Add element/drop zone to task.
   *
   * @param {Object} element
   * @param {String} type Class
   * @param {Number} id
   * @returns {jQuery}
   */
  C.prototype.addElement = function (element, type, id) {
    return $('<div class="h5p-' + type + '" style="left:' + element.x + '%;top:' + element.y + '%;width:' + element.width + 'em;height:' + element.height + 'em"></div>').appendTo(this.$container).data('id', id);
  };

  /**
   * Set correct height of container
   */
  C.prototype.resize = function () {
    // Make sure we use all the height we can get. Needed to scale up.
    this.$container.css('height', '99999px');

    var size = this.options.question.settings.size;
    var ratio = size.width / size.height;
    var width = this.$container.parent().width();
    var height = this.$container.parent().height();

    if (width / height >= ratio) {
      // Wider
      width = height * ratio;
    }
    else {
      // Narrower
      height = width / ratio;
    }

    this.$container.css({
      width: width + 'px',
      height: height + 'px',
      fontSize: (16 * (width / size.width)) + 'px'
    });
  };

  /**
   * Get css position in percentage.
   *
   * @param {jQuery} $container
   * @param {jQuery} $element
   * @returns {Object} CSS position
   */
  C.positionToPercentage = function ($container, $element) {
    return {
      top: (parseInt($element.css('top')) * 100 / $container.innerHeight()) + '%',
      left: (parseInt($element.css('left')) * 100 / $container.innerWidth()) + '%'
    };
  };

  /**
   * Display the correct solution for the input boxes.
   */
  C.prototype.showSolutions = function (skipVisuals) {
    this.points = 0;

    for (var i = 0; i < this.draggables.length; i++) {
      var draggable = this.draggables[i];
      if (draggable === undefined) {
        continue;
      }

      if (this.options.enableTryAgain === false) {
        draggable.disable();
      }

      // Find out where we are.
      this.points += draggable.results(skipVisuals, this.correctDZs[i]);
    }

    if (skipVisuals !== true) this.displayingSolution = true;
    
    if (this.points < 0) {
      this.points = 0;
    }
    if (!this.answered && this.blankIsCorrect) {
      this.points = this.weight;
    }
    if (this.options.singlePoint) {
      this.points = (this.points === this.calculateMaxScore() ? 1 : 0);
    }
    
    if (this._$solutionButton !== undefined && (this.options.enableTryAgain === false || this.points === this.getMaxScore())) {
      // Max score reached, or the user cannot try again.
      this._$solutionButton.remove();
    }
  };

  /**
   * Calculates the real max score.
   * 
   * @returns {Number} Max points
   */
  C.prototype.calculateMaxScore = function () {
    if (this.blankIsCorrect) {
      return this.weight;
    }
  
    var max = 0;
    var elements = this.options.question.task.elements;
    for (var i = 0; i < elements.length; i++) {
      var correctDropZones = this.correctDZs[i];
      
      if (correctDropZones === undefined || !correctDropZones.length) {
        continue;
      }
      
      if (elements[i].multiple) {
        max += correctDropZones.length;
      }
      else {
        max++;
      }
    }

    return max;
  };

  /**
   * Get maximum score.
   *
   * @returns {Number} Max points
   */
  C.prototype.getMaxScore = function () {
    return (this.options.singlePoint ? this.weight : this.calculateMaxScore());
  };

  /**
   * Count the number of correct answers.
   * Only works while showing solution.
   *
   * @returns {Number} Points
   */
  C.prototype.getScore = function () {
    // TODO: Refactor. This function shouldn't rely on showSolutions
    this.showSolutions(true);
    var points = this.points;
    delete this.points;
    return points;
  };

  /**
   * Checks if all has been answered.
   *
   * @returns {Boolean}
   */
  C.prototype.getAnswerGiven = function () {
    return !this.options.showSolutionsRequiresInput || this.answered || this.blankIsCorrect;
  };
  
  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyright}
   */
  C.prototype.getCopyrights = function () {
    var self = this;
    var info = new H5P.ContentCopyrights();
    
    var background = self.options.question.settings.background;
    if (background !== undefined && background.copyright !== undefined) {
      var image = new H5P.MediaCopyright(background.copyright);
      image.setThumbnail(new H5P.Thumbnail(H5P.getPath(background.path, self.id), background.width, background.height));
      info.addMedia(image);
    }
    
    for (var i = 0; i < self.options.question.task.elements.length; i++) {
      var element = self.options.question.task.elements[i];
      var instance = H5P.newRunnable(element.type, self.id);
      
      if (instance.getCopyrights !== undefined) {
        var rights = instance.getCopyrights();
        rights.setLabel(element.dropZones.length ? 'Draggable ' : 'Static ') + (element.type.params.contentName !== undefined ? element.type.params.contentName : 'element');
        info.addContent(rights);
      }
    }
    
    return info;
  };
  
  /**
   * Updates alpha channel for colors in the given style.
   *   
   * @param {String} style
   * @param {String} prefix
   * @param {Number} alpha
   */
  C.setAlphas = function (style, prefix, alpha) {
    var colorStart = style.indexOf(prefix);
    
    while (colorStart !== -1) {
      var colorEnd = style.indexOf(')', colorStart);
      var channels = style.substring(colorStart + prefix.length, colorEnd).split(',');
      
      // Set alpha channel
      channels[3] = (channels[3] !== undefined ? parseFloat(channels[3]) * alpha : alpha);
      
      style = style.substring(0, colorStart) + 'rgba(' + channels.join(',') + style.substring(colorEnd, style.length);
            
      // Look for more colors
      colorStart = style.indexOf(prefix, colorEnd);
    }
    
    return style;
  };
  
  /**
   * Makes element background, border and shadow transparent.
   *
   * @param {jQuery} $element
   * @param {String} property
   * @param {Number} opacity
   */
  C.setOpacity = function ($element, property, opacity) {
    if (property === 'background') {
      // Set both color and gradient.
      C.setOpacity($element, 'backgroundColor', opacity);
      C.setOpacity($element, 'backgroundImage', opacity);
      return;
    }
    
    opacity = (opacity === undefined ? 1 : opacity / 100);
    
    // Private. Get css properties objects.
    function getProperties(property, value) {
      switch (property) {
        case 'borderColor':
          return {
            borderTopColor: value,
            borderRightColor: value,
            borderBottomColor: value,
            borderLeftColor: value
          };
        
        default:
          var properties = {};
          properties[property] = value;
          return properties;
      }
    }
    
    // Reset css to be sure we're using CSS and not inline values.
    var properties = getProperties(property, '');
    $element.css(properties);
    
    for (var prop in properties) {
      break;
    }
    var style = $element.css(prop); // Assume all props are the same and use the first.
    style = C.setAlphas(style, 'rgba(', opacity); // Update rgba
    style = C.setAlphas(style, 'rgb(', opacity); // Convert rgb
    
    $element.css(getProperties(property, style));
  };

  /**
   * Creates a new draggable instance.
   * Makes it easier to keep track of all instance variables and elements.
   * 
   * @param {type} element
   * @param {type} id
   * @returns {_L8.Draggable}
   */
  function Draggable(element, id) {
    var self = this;
    
    self.$ = $(self);
    self.id = id;
    self.elements = [];
    self.x = element.x;
    self.y = element.y;
    self.width = element.width;
    self.height = element.height;
    self.backgroundOpacity = element.backgroundOpacity;
    self.dropZones = element.dropZones;
    self.type = element.type;
    self.multiple = element.multiple;
  }
  
  /**
   * Insert draggable elements into the given container.
   * 
   * @param {jQuery} $container
   * @param {Number} contentId
   * @returns {undefined}
   */
  Draggable.prototype.appendTo = function ($container, contentId) {
    var self = this;
    
    if (!self.elements.length) {
      self.attachElement(null, $container, contentId);
    }
    else {
      for (var i = 0; i < self.elements.length; i++) {
        self.attachElement(i, $container, contentId);
      }
    }
  };
  
  /**
   * Attach the given element to the given container.
   * 
   * @param {Number} index
   * @param {jQuery} $container
   * @param {Number} contentId
   * @returns {undefined}
   */
  Draggable.prototype.attachElement = function (index, $container, contentId) {
    var self = this;
    
    var element;
    if (index === null) {
      // Create new element
      element = {};
      self.elements.push(element);
      index = self.elements.length - 1;
    }
    else {
      // Get old element
      element = self.elements[index];
    }

    // Attach element
    element.$ = $('<div/>', {
      class: 'h5p-draggable',
      css: {
        left: self.x + '%',
        top: self.y + '%',
        width: self.width + 'em',
        height: self.height + 'em'
      }
    })
      .appendTo($container)
      .draggable({
        revert: function (dropZone) {
          var $this = $(this);
          
          $this.removeClass('h5p-dropped').data("uiDraggable").originalPosition = {
            top: self.y + '%',
            left: self.x + '%'
          };
          C.setElementOpacity($this, self.backgroundOpacity);
          return !dropZone;
        },
        start: function(event, ui) {
          var $this = $(this);
          
          if (self.multiple && element.dropZone === undefined) {
            // Leave a new element for next drag
            self.attachElement(null, $container, contentId); 
          }
          
          // Send element to the top!
          $this.removeClass('h5p-wrong').detach().appendTo($container);
          C.setElementOpacity($this, self.backgroundOpacity);
        },
        stop: function(event, ui) {
          var $this = $(this);
          
          // Convert position to % to support scaling.
          element.position = C.positionToPercentage($container, $this);
          $this.css(element.position);

          var addToZone = $this.data('addToZone');
          if (addToZone !== undefined) {
            $this.removeData('addToZone');
            
            if (self.multiple) {
              // Check that we're the only element here
              for (var i = 0; i < self.elements.length; i++) {
                if (self.elements[i] !== undefined && self.elements[i].dropZone === addToZone) {
                  // Remove element
                  $this.remove();
                  delete self.elements[index];
                  return;
                }
              }
            }
            
            element.dropZone = addToZone;
            
            $this.addClass('h5p-dropped');
            C.setElementOpacity($this, self.backgroundOpacity);
            
            self.$.trigger('answered');
          }
          else {
            if (self.multiple) {
              // Remove element
              $this.remove();
              delete self.elements[index];
            }
            else {
              // Reset position and drop zone.
              delete element.dropZone;
              delete element.position;
            }
          }
        }
      });
      
      C.addHover(element.$, self.backgroundOpacity);
      H5P.newRunnable(self.type, contentId, element.$);
  };
  
  /**
   * Check if this element can be dragged to the given drop zone.
   * 
   * @param {Number} id
   * @returns {Boolean}
   */
  Draggable.prototype.hasDropZone = function (id) {
    var self = this;

    for (var i = 0; i < self.dropZones.length; i++) {
      if (parseInt(self.dropZones[i]) === id) {
        return true;
      }
    }
    
    return false;
  };
  
  /**
   * Check if the given draggable dom element is a part of this draggable.
   * 
   * @param {Object} draggable
   * @returns {Boolean}
   */
  Draggable.prototype.is = function (draggable) {
    var self = this;
    
    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined && self.elements[i].$.is(draggable)) {
        return true;
      }
    }
    
    return false;
  };
  
  /**
   * Detemine if any of our elements is in the given drop zone.
   * 
   * @param {Number} id
   * @returns {Boolean}
   */
  Draggable.prototype.isInDropZone = function (id) {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined && self.elements[i].dropZone === id) {
        return true;
      }
    }
    
    return false;
  };
  
  Draggable.prototype.disable = function () {
    var self = this;
    
    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined) {
        self.elements[i].$.draggable('disable');
      }
    }
  };
  
  /**
   * Calculate score for this draggable.
   * 
   * @param {Boolean} skipVisuals
   * @param {Array} solutions
   * @returns {Number}
   */
  Draggable.prototype.results = function (skipVisuals, solutions) {
    var self = this;
    var i, j, element, dropZone, correct, points = 0;
    
    if (solutions === undefined) {
      // We should not be anywhere.
      for (i = 0; i < self.elements.length; i++) {
        element = self.elements[i];
        if (element !== undefined && element.dropZone !== undefined) {
          // ... but we are!
          if (skipVisuals !== true) { 
            element.$.addClass('h5p-wrong');
            C.setElementOpacity(element.$, self.backgroundOpacity);
          }
          points--;
        }
      }
      return points;
    }
    
    // Are we somewhere we should be?
    for (i = 0; i < self.elements.length; i++) {
      element = self.elements[i];
      
      if (element === undefined || element.dropZone === undefined) {
        continue; // We have not been placed anywhere, we're neither wrong nor correct.
      }
      
      correct = false;
      for (j = 0; j < solutions.length; j++) {
        if (element.dropZone === solutions[j]) {
          // Yepp!
          if (skipVisuals !== true) {
            element.$.addClass('h5p-correct').draggable('disable');
            C.setElementOpacity(element.$, self.backgroundOpacity);
          }
          correct = true;
          points++;
          break;
        }
      }
      
      if (!correct) {
        // Nope, we're in another zone
        if (skipVisuals !== true) {
          element.$.addClass('h5p-wrong');
          C.setElementOpacity(element.$, element.backgroundOpacity);
        }
        points--;
      }
    }
    
    return points;
  };
  
  /**
   * Creates a new drop zone instance.
   * Makes it easy to keep track of all instance variables.
   * 
   * @param {Object} dropZone
   * @param {Number} id
   * @returns {_L8.DropZone}
   */
  function DropZone(dropZone, id) {
    var self = this;
    
    self.id = id;
    self.showLabel = dropZone.showLabel;
    self.label = dropZone.label;
    self.x = dropZone.x;
    self.y = dropZone.y;
    self.width = dropZone.width;
    self.height = dropZone.height;
    self.backgroundOpacity = dropZone.backgroundOpacity;
    self.tip = dropZone.tip;
    self.single = dropZone.single;
  }
  
  /**
   * Insert drop zone in the given container.
   * 
   * @param {jQuery} $container
   * @param {Array} draggables
   * @returns {undefined}
   */
  DropZone.prototype.appendTo = function ($container, draggables) {
    var self = this;
    
    // Prepare inner html
    var html = '<div class="h5p-inner"></div>';
    var extraClass = '';
    if (self.showLabel) {
      html = '<div class="h5p-label">' + self.label + '</div>' + html;
      extraClass = ' h5p-has-label';
    }
    
    // Create drop zone element
    var $dropZone = $('<div/>', {
      class: 'h5p-dropzone' + extraClass,
      css: {
        left: self.x + '%',
        top: self.y + '%',
        width: self.width + 'em',
        height: self.height + 'em'
      },
      html: html
    })
      .appendTo($container)
      .children('.h5p-inner')
        .droppable({
          activeClass: 'h5p-active',
          tolerance: 'intersect',
          accept: function (draggable) {
            var element;
            
            for (var i = 0; i < draggables.length; i++) {
              if (self.single && draggables[i].isInDropZone(self.id)) {
                // This drop zone is already occupied!
                return false;
              }
              if (draggables[i].is(draggable)) {
                // Found the draggable's instance
                element = draggables[i];
                if (!self.single) {
                  break;
                }
              }
            }
            
            // Check to see if the draggable can be dropped in this zone
            return element.hasDropZone(self.id);
          },
          drop: function (event, ui) {
            var $this = $(this);
            C.setOpacity($this.removeClass('h5p-over'), 'background', self.backgroundOpacity);
            ui.draggable.data('addToZone', self.id);
          },
          over: function (event, ui) {
            C.setOpacity($(this).addClass('h5p-over'), 'background', self.backgroundOpacity);
          },
          out: function (event, ui) {
            C.setOpacity($(this).removeClass('h5p-over'), 'background', self.backgroundOpacity);
          }
        })
        .end();

    C.setOpacity($dropZone.children(), 'background', self.backgroundOpacity);

    // Add tip after setOpacity(), so this does not get background opacity:
    if (self.tip !== undefined && self.tip.trim().length) {
      $dropZone.append(H5P.JoubelUI.createTip(self.tip));
    }
  };

  return C;
})(H5P.jQuery);