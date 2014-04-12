var H5P = H5P || {};

if (H5P.getPath === undefined) {
  /**
   * Find the path to the content files based on the id of the content
   *
   * Also identifies and returns absolute paths
   *
   * @param {String} path Absolute path to a file, or relative path to a file in the content folder
   * @param {Number} contentId Identifier of the content requesting the path
   * @returns {String} The path to use.
   */
  H5P.getPath = function (path, contentId) {
    if (path.substr(0, 7) === 'http://' || path.substr(0, 8) === 'https://') {
      return path;
    }

    return H5PIntegration.getContentPath(contentId) + path;
  };
}

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

    this.userAnswers = [];
    this.elementZones = [];
    this.$elements = [];
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
  };

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var that = this;

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
    that.blankIsCorrect = true;

    // Add drop zones
    for (var i = 0; i < task.dropZones.length; i++) {
      var dropZone = task.dropZones[i];
      
      if (that.blankIsCorrect && dropZone.correctElements.length) {
        that.blankIsCorrect = false;
      }

      var html = '<div class="h5p-inner"></div>';
      var extraClass = '';
      if (dropZone.showLabel) {
        html = '<div class="h5p-label">' + dropZone.label + '</div>' + html;
        extraClass = ' h5p-has-label';
      }

      $element = this.addElement(dropZone, 'dropzone' + extraClass, i).html(html).children('.h5p-inner').droppable({
        activeClass: 'h5p-active',
        tolerance: 'intersect',
        accept: function (draggable) {
          // Check that the draggable belongs to this task.
          var $draggable = that.$container.find(draggable);
          if ($draggable.length) {
            // Check that the draggable has this drop zone.
            var id = $(this).parent().data('id');
            var draggableDropZones = task.elements[$draggable.data('id')].dropZones;
            for (var i = 0; i < draggableDropZones.length; i++) {
              if (parseInt(draggableDropZones[i]) === id) {
                return true;
              }
            }
          }
          
          return false;
        },
        drop: function (event, ui) {
          var $this = $(this);
          C.setOpacity($this.removeClass('h5p-over'), 'background', task.dropZones[$this.parent().data('id')].backgroundOpacity);
          ui.draggable.data('addToZone', $this.parent().data('id'));
        },
        over: function (event, ui) {
          var $this = $(this);
          C.setOpacity($this.addClass('h5p-over'), 'background', task.dropZones[$this.parent().data('id')].backgroundOpacity);
        },
        out: function (event, ui) {
          var $this = $(this);
          C.setOpacity($this.removeClass('h5p-over'), 'background', task.dropZones[$this.parent().data('id')].backgroundOpacity);
        }
      }).end();

      C.setOpacity($element.children(), 'background', dropZone.backgroundOpacity);
      
      // Add tip after setOpacity(), so this does not get background opacity:
      if(dropZone.tip !== undefined && dropZone.tip.trim().length > 0) {
        $element.append(H5P.JoubelUI.createTip(dropZone.tip));
      }
    }

    // Add elements (static and draggable)
    for (var i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];

      if (element.dropZones !== undefined && element.dropZones.length !== 0) {
        // Add draggable element
        $element = this.$elements[i] = this.addElement(element, 'draggable', i).draggable({
          revert: function (event, ui) {
            var $this = $(this);
            var element = task.elements[$this.data('id')];
            $this.removeClass('h5p-dropped').data("uiDraggable").originalPosition = {
              top: element.y + '%',
              left: element.x + '%'
            };
            C.setElementOpacity($this, element.backgroundOpacity);
            return !event;
          },
          start: function(event, ui) {
            // Send element to the top!
            $(this).detach().appendTo(that.$container);
          },
          stop: function(event, ui) {
            var $this = $(this);
            var position = that.positionToPercentage($this);
            $this.css(position);

            // Remove from zone
            var id = $this.data('id');
            var zone = that.elementZones[id];
            if (zone !== undefined && that.userAnswers[zone] !== undefined) {
              delete that.elementZones[id];
              var zoneAnswers = that.userAnswers[zone];
              for (var i = 0; i < zoneAnswers.length; i++) {
                if (zoneAnswers[i].id === id) {
                  zoneAnswers.splice(i, 1);
                }
              }
            }

            var addToZone = $this.data('addToZone');
            if (addToZone !== undefined) {
              $this.removeData('addToZone');
              that.elementZones[id] = addToZone;

              // Add to zone answers
              if (that.userAnswers[addToZone] === undefined) {
                that.userAnswers[addToZone] = [];
              }
              that.userAnswers[addToZone].push({
                id: id,
                position: position
              });

              $(that).trigger('h5pQuestionAnswered');
                
              $this.addClass('h5p-dropped');
              C.setElementOpacity($this, task.elements[id].backgroundOpacity);
            }
          }
        });
        
        C.addHover($element, element);
      }
      else {
        // Add static element
        $element = this.addElement(element, 'static', i);
        C.setOpacity($element, 'background', element.backgroundOpacity);
      }

      var elementInstance = new (H5P.classFromName(element.type.library.split(' ')[0]))(element.type.params, this.id);
      elementInstance.attach($element);
    }

    // Restore user answers
    for (var i = 0; i < that.userAnswers.length; i++) {
      var dropZoneAnswers = that.userAnswers[i];
      if (dropZoneAnswers !== undefined) {
        for (var j = 0; j < dropZoneAnswers.length; j++) {
          var dza = dropZoneAnswers[j];
          this.$elements[dza.id].css(dza.position);
          this.elementZones[dza.id] = i;
        }
      }
    }

    if (this.options.preventResize === false) {
      H5P.$window.bind('resize', function () {
        that.resize();
      });
    }
    this.resize();
  };
  
  /**
   * Makes sure element gets correct opacity when hovered.
   *
   * @param {jQuery} $element
   * @param {Object} element
   */
  C.addHover = function ($element, element) {
    $element.hover(function () {
      C.setElementOpacity($element, element.backgroundOpacity);
    }, function () {
      C.setElementOpacity($element, element.backgroundOpacity);
    });
    C.setElementOpacity($element, element.backgroundOpacity);
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
      if (that._$solutionButton.hasClass('h5p-try-again')) {
        that._$solutionButton.text(that.options.scoreShow).removeClass('h5p-try-again');
        that.hideSolutions();
      }
      else {
        if (that.getAnswerGiven()) {
          that.showSolutions();
          if (that.options.postUserStatistics === true) {
            H5P.setFinished(that.id, that.getScore(), that.getMaxScore());
          }
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
   * @param {jQuery} $element
   * @returns {Object} CSS position
   */
  C.prototype.positionToPercentage = function ($element) {
    return {
      top: (parseInt($element.css('top')) * 100 / this.$container.innerHeight()) + '%',
      left: (parseInt($element.css('left')) * 100 / this.$container.innerWidth()) + '%'
    };
  };

  /**
   * Display the correct solution for the input boxes.
   */
  C.prototype.showSolutions = function (skipVisuals) {
    if (this.displayingSolution) {
      return;
    }

    if (this._$solutionButton !== undefined) {
      if (this.options.enableTryAgain) {
        this._$solutionButton.text(this.options.tryAgain).addClass('h5p-try-again');
      }
      else {
        this._$solutionButton.remove();
      }
    }

    var task = this.options.question.task;
    this.points = 0;

    for (var i = 0; i < this.$elements.length; i++) {
      var $element = this.$elements[i];
      if ($element === undefined) {
        continue;
      }
      var element = task.elements[i];

      // Disable dragging
      if (skipVisuals !== true) $element.draggable('disable');

      // Find out where we are.
      var dropZone = this.elementZones[i];

      if (this.correctDZs[i] === undefined) {
        // We should not be anywhere.
        if (dropZone !== undefined) {
          // ... but we are!
          if (skipVisuals !== true) { 
            $element.addClass('h5p-wrong');
            C.setElementOpacity($element, element.backgroundOpacity);
          }
          this.points--;
        }
        continue;
      }

      // Are we somewhere we should be?
      var correct = false;
      for (var j = 0; j < this.correctDZs[i].length; j++) {
        if (dropZone === this.correctDZs[i][j]) {
          correct = true;
          if (skipVisuals !== true) {
            $element.addClass('h5p-correct');
            C.setElementOpacity($element, element.backgroundOpacity);
          }
          this.points++;
          break;
        }
      }
      if (!correct) {
        if (skipVisuals !== true) {
          $element.addClass('h5p-wrong');
          C.setElementOpacity($element, element.backgroundOpacity);
        }
      }
    }

    if (skipVisuals !== true) this.displayingSolution = true;
    
    if (this.points < 0) {
      this.points = 0;
    }
    if (!this.userAnswers.length && this.blankIsCorrect) {
      this.points = this.weight;
    }
    if (this.options.singlePoint) {
      this.points = (this.points === this.calculateMaxScore() ? 1 : 0);
    }
  };

  /**
   * Hide solutions. (/try again)
   */
  C.prototype.hideSolutions = function () {
    for (var i = 0; i < this.$elements.length; i++) {
      if (this.$elements[i] !== undefined) {
        this.$elements[i].removeClass('h5p-wrong h5p-correct').draggable('enable');
        C.setElementOpacity(this.$elements[i], this.options.question.task.elements[i].backgroundOpacity);
      }
    }
    delete this.points;
    this.displayingSolution = false;
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
    for (var i = 0; i < this.$elements.length; i++) {
      if (this.$elements[i] !== undefined && this.correctDZs[i] !== undefined) {
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
    return !this.options.showSolutionsRequiresInput || this.userAnswers.length || this.blankIsCorrect;
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

  return C;
})(H5P.jQuery);
