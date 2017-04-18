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
   * @class
   * @extend H5P.Question
   * @param {Object} options Run parameters
   * @param {Number} id Content identification
   */
  function C(options, contentId, contentData) {
    var self = this;
    var i, j;
    this.id = this.contentId = contentId;
    H5P.Question.call(self, 'dragquestion');
    this.options = $.extend(true, {}, {
      scoreShow: 'Check',
      correct: 'Show solution',
      tryAgain: 'Retry',
      feedback: 'You got @score of @total points',
      question: {
        settings: {
          questionTitle: 'Drag and drop',
          showTitle: true,
          size: {
            width: 620,
            height: 310
          },
          dropZoneHighlighting: 'dragging',
          autoAlignSpacing: 2
        },
        task: {
          elements: [],
          dropZones: []
        }
      },
      behaviour: {
        enableRetry: true,
        preventResize: false,
        singlePoint: true,
        showSolutionsRequiresInput: true,
        applyPenalties: true
      }
    }, options);

    this.draggables = [];
    this.dropZones = [];
    this.answered = (contentData && contentData.previousState !== undefined && contentData.previousState.answers !== undefined && contentData.previousState.answers.length);
    this.blankIsCorrect = true;

    this.backgroundOpacity = (this.options.backgroundOpacity === undefined || this.options.backgroundOpacity.trim() === '') ? undefined : this.options.backgroundOpacity;

    // List of drop zones that has no elements, i.e. not used for the task
    var dropZonesWithoutElements = [];

    // Create map over correct drop zones for elements
    var task = this.options.question.task;
    this.correctDZs = [];
    for (i = 0; i < task.dropZones.length; i++) {
      dropZonesWithoutElements.push(true); // All true by default

      var correctElements = task.dropZones[i].correctElements;
      for (j = 0; j < correctElements.length; j++) {
        var correctElement = correctElements[j];
        if (this.correctDZs[correctElement] === undefined) {
          this.correctDZs[correctElement] = [];
        }
        this.correctDZs[correctElement].push(i);
      }
    }

    this.weight = 1;

    // Add draggable elements
    for (i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];

      if (element.dropZones === undefined || !element.dropZones.length) {
        continue; // Not a draggable
      }

      if (this.backgroundOpacity !== undefined) {
        element.backgroundOpacity = this.backgroundOpacity;
      }

      // Restore answers from last session
      var answers = null;
      if (contentData && contentData.previousState !== undefined && contentData.previousState.answers !== undefined && contentData.previousState.answers[i] !== undefined) {
        answers = contentData.previousState.answers[i];
      }

      // Create new draggable instance
      var draggable = new Draggable(element, i, answers);
      if (self.options.question.settings.dropZoneHighlighting === 'dragging') {
        draggable.on('drag', function () {
          self.$container.addClass('h5p-dq-highlight-dz');
        });
        draggable.on('dropped', function (event) {
          self.$container.removeClass('h5p-dq-highlight-dz');
        });
      }
      draggable.on('interacted', function () {
        self.answered = true;
        self.triggerXAPIScored(self.getScore(), self.getMaxScore(), 'interacted');
      });
      draggable.on('leavingDropZone', function (event) {
        self.dropZones[event.data.dropZone].removeAlignable(event.data.$);
      });

      this.draggables[i] = draggable;

      for (j = 0; j < element.dropZones.length; j++) {
        dropZonesWithoutElements[element.dropZones[j]] = false;
      }
    }

    // Create a count to subtrack from score
    this.numDropZonesWithoutElements = 0;

    // Add drop zones
    for (i = 0; i < task.dropZones.length; i++) {
      var dropZone = task.dropZones[i];

      if (dropZonesWithoutElements[i] === true) {
        this.numDropZonesWithoutElements += 1;
      }

      if (this.blankIsCorrect && dropZone.correctElements.length) {
        this.blankIsCorrect = false;
      }

      if (dropZone.autoAlign) {
        dropZone.autoAlign = {
          spacing: self.options.question.settings.autoAlignSpacing,
          size: self.options.question.settings.size
        };
      }

      this.dropZones[i] = new DropZone(dropZone, i);
    }

    this.on('resize', self.resize, self);
    this.on('domChanged', function(event) {
      if (self.contentId === event.data.contentId) {
        self.trigger('resize');
      }
    });

    this.on('enterFullScreen', function () {
      if (self.$container) {
        self.$container.parents('.h5p-content').css('height', '100%');
        self.trigger('resize');
      }
    });

    this.on('exitFullScreen', function () {
      if (self.$container) {
        self.$container.parents('.h5p-content').css('height', 'auto');
        self.trigger('resize');
      }
    });
  }

  C.prototype = Object.create(H5P.Question.prototype);
  C.prototype.constructor = C;


  /**
  * Registers this question type's DOM elements before they are attached.
  * Called from H5P.Question.
  */
  C.prototype.registerDomElements = function () {
    var self = this;

    // Register introduction section
    if (self.options.question.settings.showTitle) {
      self.setIntroduction('<p>' + self.options.question.settings.questionTitle + '</p>');
    }


    // Set class if no background
    var classes = '';
    if (this.options.question.settings.background !== undefined) {
      classes += 'h5p-dragquestion-has-no-background';
    }
    if (self.options.question.settings.dropZoneHighlighting === 'always' ) {
      if (classes) {
        classes += ' ';
      }
      classes += 'h5p-dq-highlight-dz-always';
    }

    // Register task content area
    self.setContent(self.createQuestionContent(), {
      'class': classes
    });

    // First we check if full screen is supported
    if (H5P.canHasFullScreen !== false && this.options.question.settings.enableFullScreen) {

      // We create a function that is used to enter or
      // exit full screen when our button is pressed
      var $myContainer = this.$container;
      var self = this; // Keep track of H5P instance as 'self'
      var toggleFullScreen = function () {
        if (H5P.isFullscreen) {
          H5P.exitFullScreen($myContainer);
        }
        else {
          H5P.fullScreen($myContainer.parent().parent(), self); // 'self' instead of 'this'
        }
      };

    // Create full screen button
      $fullScreenButton = $('<div/>', {
        'class': 'h5p-my-fullscreen-button-enter',
        title: this.options.localize.fullscreen,
        role: 'button',
        tabindex: 0,
        on: {
          click: toggleFullScreen
        },
        prependTo: this.$container.parent()
      });

      // Respond to enter full screen event
      this.on('enterFullScreen', function () {
        $fullScreenButton.attr('class', 'h5p-my-fullscreen-button-exit');
        $fullScreenButton.attr('title', this.options.localize.exitFullscreen);
      });

      // Respond to exit full screen event
      this.on('exitFullScreen', function () {
        $fullScreenButton.attr('class', 'h5p-my-fullscreen-button-enter');
        $fullScreenButton.attr('title', this.options.localize.fullscreen);
      });
    }

    // ... and buttons
    self.registerButtons();

    setTimeout(function () {
      self.trigger('resize');
    }, 200);
  };

  /**
   * Get xAPI data.
   * Contract used by report rendering engine.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   *
   * @return {Object} xAPI data
   */
  C.prototype.getXAPIData = function () {
    var xAPIEvent = this.createXAPIEventTemplate('answered');
    this.addQuestionToXAPI(xAPIEvent);
    this.addResponseToXAPI(xAPIEvent);
    return {
      statement: xAPIEvent.data.statement
    }
  };

  /**
   * Add the question itselt to the definition part of an xAPIEvent
   */
  C.prototype.addQuestionToXAPI = function(xAPIEvent) {
    var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
    $.extend(definition, this.getXAPIDefinition());
  };

  /**
   * Get object definition for xAPI statement.
   *
   * @return {Object} xAPI object definition
   */
  C.prototype.getXAPIDefinition = function () {
    var definition = {};
    definition.description = {
      // Remove tags, must wrap in div tag because jQuery 1.9 will crash if the string isn't wrapped in a tag.
      'en-US': $('<div>' + this.options.question.settings.questionTitle + '</div>').text()
    };
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'matching';

    // Add sources, i.e. draggables
    definition.source = [];
    for (var i = 0; i < this.options.question.task.elements.length; i++) {
      var el = this.options.question.task.elements[i];
      if (el.dropZones && el.dropZones.length) {
        var desc = el.type.params.alt ? el.type.params.alt : el.type.params.text;

        definition.source.push({
          'id': '' + i,
          'description': {
            // Remove tags, must wrap in div tag because jQuery 1.9 will crash if the string isn't wrapped in a tag.
            'en-US': $('<div>' + desc + '</div>').text()
          }
        });
      }
    }

    // Add targets, i.e. drop zones, and the correct response pattern.
    definition.correctResponsesPattern = [''];
    definition.target = [];
    var firstCorrectPair = true;
    for (var i = 0; i < this.options.question.task.dropZones.length; i++) {
      definition.target.push({
        'id': '' + i,
        'description': {
          // Remove tags, must wrap in div tag because jQuery 1.9 will crash if the string isn't wrapped in a tag.
          'en-US': $('<div>' + this.options.question.task.dropZones[i].label + '</div>').text()
        }
      });
      if (this.options.question.task.dropZones[i].correctElements) {
        for (var j = 0; j < this.options.question.task.dropZones[i].correctElements.length; j++) {
          if (!firstCorrectPair) {
            definition.correctResponsesPattern[0] += '[,]';
          }
          definition.correctResponsesPattern[0] += i + '[.]' + this.options.question.task.dropZones[i].correctElements[j];
          firstCorrectPair = false;
        }
      }
    }

    return definition;
  };

  /**
   * Add the response part to an xAPI event
   *
   * @param {H5P.XAPIEvent} xAPIEvent
   *  The xAPI event we will add a response to
   */
  C.prototype.addResponseToXAPI = function(xAPIEvent) {
    var maxScore = this.getMaxScore();
    var score = this.getScore();
    var success = score == maxScore ? true : false;
    xAPIEvent.setScoredResult(score, maxScore, this, true, success);
    xAPIEvent.data.statement.result.response = this.getUserXAPIResponse();
  };

  /**
   * Get what the user has answered encoded as an xAPI response pattern
   *
   * @return {string} xAPI encoded user response pattern
   */
  C.prototype.getUserXAPIResponse = function () {
    var answers = this.getUserAnswers();
    if (!answers) {
      return response;
    }

    return answers
      .filter(function (answerMapping) {
        return answerMapping.elements.length;
      })
      .map(function (answerMapping, index) {
        return answerMapping.elements
          .filter(function (element) {
            return element.dropZone !== undefined;
          }).map(function (element) {
            return element.dropZone + '[.]' + index;
          }).join('[,]');
      }).filter(function (pattern) {
        return pattern !== undefined && pattern !== '';
      }).join('[,]');
  };

  /**
   * Returns user answers
   */
  C.prototype.getUserAnswers = function () {
    return this.draggables.map(function (draggable, index) {
      return {
        index: index,
        draggable: draggable
      };
    }).filter(function (draggableMapping) {
      return draggableMapping.draggable !== undefined &&
        draggableMapping.draggable.elements;
    }).map(function (draggableMapping) {
      return {
        index: draggableMapping.index,
        elements: draggableMapping.draggable.elements
      }
    });
  };

  /**
   * Append field to wrapper.
   */
  C.prototype.createQuestionContent = function () {
    var i;
    // If reattaching, we no longer show solution. So forget that we
    // might have done so before.

    this.$container = $('<div class="h5p-inner"></div>');
    if (this.options.question.settings.background !== undefined) {
      this.$container.css('backgroundImage', 'url("' + H5P.getPath(this.options.question.settings.background.path, this.id) + '")');
    }

    var task = this.options.question.task;

    // Add elements (static and draggable)
    for (i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];

      if (element.dropZones !== undefined && element.dropZones.length !== 0) {
        // Attach draggable elements
        this.draggables[i].appendTo(this.$container, this.id);
      }
      else {
        // Add static element
        var $element = this.addElement(element, 'static', i);
        H5P.newRunnable(element.type, this.id, $element);
        var timedOutOpacity = function($el, el) {
          setTimeout(function () {
            C.setOpacity($el, 'background', el.backgroundOpacity);
          }, 0);
        };
        timedOutOpacity($element, element);
      }
    }

    // Attach drop zones
    for (i = 0; i < this.dropZones.length; i++) {
      this.dropZones[i].appendTo(this.$container, this.draggables);
    }
    return this.$container;
  };

  C.prototype.registerButtons = function () {
    // Add show score button
    this.addSolutionButton();
    this.addRetryButton();
  };

  /**
   * Makes sure element gets correct opacity when hovered.
   *
   * @param {jQuery} $element
   * @param {Object} element
   */
  C.addHover = function ($element, backgroundOpacity) {
    $element.hover(function () {
      $element.addClass('h5p-draggable-hover');
      if (!$element.parent().hasClass('h5p-dragging')) {
        C.setElementOpacity($element, backgroundOpacity);
      }
    }, function () {
      if (!$element.parent().hasClass('h5p-dragging')) {
        setTimeout(function () {
          $element.removeClass('h5p-draggable-hover');
          C.setElementOpacity($element, backgroundOpacity);
        }, 1);
      }
    });
    C.setElementOpacity($element, backgroundOpacity);
  };

  /**
   * Makes element background transparent.
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

    this.addButton('check-answer', this.options.scoreShow, function () {
      that.answered = true;
      that.showAllSolutions();
      that.showScore();
      var xAPIEvent = that.createXAPIEventTemplate('answered');
      that.addQuestionToXAPI(xAPIEvent);
      that.addResponseToXAPI(xAPIEvent);
      that.trigger(xAPIEvent);
    });
  };

  /**
   * Add retry button to our container.
   */
  C.prototype.addRetryButton = function () {
    var that = this;

    this.addButton('try-again', this.options.tryAgain, function () {
      that.resetTask();
      that.showButton('check-answer');
      that.hideButton('try-again');
    }, false);
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
  C.prototype.resize = function (e) {
    var self = this;
    // Make sure we use all the height we can get. Needed to scale up.
    if (this.$container === undefined || !this.$container.is(':visible')) {
      // Not yet attached or visible – not possible to resize correctly
      return;
    }

    // Check if decreasing iframe size
    var decreaseSize = e && e.data && e.data.decreaseSize;
    if (!decreaseSize) {
      this.$container.css('height', '99999px');
      self.$container.parents('.h5p-standalone.h5p-dragquestion').css('width', '');
    }

    var size = this.options.question.settings.size;
    var ratio = size.width / size.height;
    var parentContainer = this.$container.parent();
    // Use parent container as basis for resize.
    var width = parentContainer.width() - parseFloat(parentContainer.css('margin-left')) - parseFloat(parentContainer.css('margin-right'));

    // Check if we need to apply semi full screen fix.
    var $semiFullScreen = self.$container.parents('.h5p-standalone.h5p-dragquestion.h5p-semi-fullscreen');
    if ($semiFullScreen.length) {
      // Reset semi fullscreen width
      $semiFullScreen.css('width', '');

      // Decrease iframe size
      if (!decreaseSize) {
        self.$container.css('width', '10px');
        $semiFullScreen.css('width', '');

        // Trigger changes
        setTimeout(function () {
          self.trigger('resize', {decreaseSize: true});
        }, 200);
      }

      // Set width equal to iframe parent width, since iframe content has not been update yet.
      var $iframe = $(window.frameElement);
      if ($iframe) {
        var $iframeParent = $iframe.parent();
        width = $iframeParent.width();
        $semiFullScreen.css('width', width + 'px');
      }
    }

    var height = width / ratio;

    // Set natural size if no parent width
    if (width <= 0) {
      width = size.width;
      height = size.height;
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
   * Disables all draggables.
   * @public
   */
  C.prototype.disableDraggables = function () {
    this.draggables.forEach(function (draggable) {
      draggable.disable();
    });
  };

  /**
   * Enables all draggables.
   * @public
   */
  C.prototype.enableDraggables = function () {

    this.draggables.forEach(function (draggable) {
      draggable.enable();
    });
  };

  /**
   * Get amount of empty drop zones.
   *
   * @param {number} totalDropZones Total drop zones in question
   * @param {Array} correctDZs Correct drop zones for draggables
   * @return {number} Amount of empty drop zones in question
   */
  C.prototype.getDropzoneWithoutAnswer = function (totalDropZones, correctDZs) {
    //Index of correctDZs is the draggable, and value is the drop zone it belongs to
    var correctDropZones = [];
    correctDZs.forEach(function (draggable) {
      if (draggable.length) {
        draggable.forEach(function (dropZone) {
          if (correctDropZones.indexOf(dropZone) < 0) {
            correctDropZones.push(dropZone);
          }
        });
      }
    });

    return totalDropZones - correctDropZones.length - this.numDropZonesWithoutElements;
  };

  /**
   * Shows the correct solutions on the boxes and disables input and buttons depending on settings.
   * @public
   * @params {Boolean} skipVisuals Skip visual animations.
   */
  C.prototype.showAllSolutions = function (skipVisuals) {
    this.points = 0;
    this.rawPoints = 0;

    // One correct point for each "no solution" dropzone
    var emptyDropzones = this.getDropzoneWithoutAnswer(this.dropZones.length, this.correctDZs);
    this.points += emptyDropzones;
    this.rawPoints += emptyDropzones;

    for (var i = 0; i < this.draggables.length; i++) {
      var draggable = this.draggables[i];
      if (draggable === undefined) {
        continue;
      }

      //Disable all draggables in check mode.
      if (!skipVisuals) {
        draggable.disable();
      }

      // Find out where we are.
      this.points += draggable.results(skipVisuals, this.correctDZs[i]);
      this.rawPoints += draggable.rawPoints;
    }

    if (this.points < 0) {
      this.points = 0;
    }
    if (!this.answered && this.blankIsCorrect) {
      this.points = this.weight;
    }
    if (this.options.behaviour.singlePoint) {
      this.points = (this.points === this.calculateMaxScore() ? 1 : 0);
    }

    if (!skipVisuals) {
      this.hideButton('check-answer');
    }

    if (this.options.behaviour.enableRetry && !skipVisuals) {
      this.showButton('try-again');
    }

    if (this.hasButton('check-answer') && (this.options.behaviour.enableRetry === false || this.points === this.getMaxScore())) {
      // Max score reached, or the user cannot try again.
      this.hideButton('try-again');
    }
  };

  /**
   * Display the correct solutions, hides button and disables input.
   * Used in contracts.
   * @public
   */
  C.prototype.showSolutions = function () {
    this.showAllSolutions();
    this.showScore();
    //Hide solution button:
    this.hideButton('check-answer');
    this.hideButton('try-again');

    //Disable dragging during "solution" mode
    this.disableDraggables();
  };

  /**
   * Resets the task.
   * Used in contracts.
   * @public
   */
  C.prototype.resetTask = function () {
    this.points = 0;
    this.rawPoints = 0;
    this.answered = false;

    //Enables Draggables
    this.enableDraggables();

    //Reset position and feedback.
    this.draggables.forEach(function (draggable) {
      draggable.resetPosition();
    });

    //Show solution button
    this.showButton('check-answer');
    this.hideButton('try-again');
    this.setFeedback();

  };

  /**
   * Calculates the real max score.
   *
   * @returns {Number} Max points
   */
  C.prototype.calculateMaxScore = function () {
    var max = 0;

    if (this.blankIsCorrect) {
      return this.getDropzoneWithoutAnswer(this.dropZones.length, this.correctDZs);
    }

    max += this.getDropzoneWithoutAnswer(this.dropZones.length, this.correctDZs);

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
    return (this.options.behaviour.singlePoint ? this.weight : this.calculateMaxScore());
  };

  /**
   * Count the number of correct answers.
   * Only works while showing solution.
   *
   * @returns {Number} Points
   */
  C.prototype.getScore = function () {
    this.showAllSolutions(true);
    var actualPoints = (this.options.behaviour.applyPenalties || this.options.behaviour.singlePoint) ? this.points : this.rawPoints;
    delete this.points;
    delete this.rawPoints;
    return actualPoints;
  };

  /**
   * Checks if all has been answered.
   *
   * @returns {Boolean}
   */
  C.prototype.getAnswerGiven = function () {
    return !this.options.behaviour.showSolutionsRequiresInput || this.answered || this.blankIsCorrect;
  };

  /**
   * Shows the score to the user when the score button is pressed.
   */
  C.prototype.showScore = function () {
    var maxScore = this.calculateMaxScore();
    if (this.options.behaviour.singlePoint) {
      maxScore = 1;
    }
    var actualPoints = (this.options.behaviour.applyPenalties || this.options.behaviour.singlePoint) ? this.points : this.rawPoints;
    var scoreText = this.options.feedback.replace('@score', actualPoints).replace('@total', maxScore);
    var helpText = (this.options.behaviour.enableScoreExplanation && this.options.behaviour.applyPenalties) ? this.options.scoreExplanation : false;
    this.setFeedback(scoreText, actualPoints, maxScore, undefined, helpText);
  };

  /**
   * Packs info about the current state of the task into a object for
   * serialization.
   *
   * @public
   * @returns {object}
   */
  C.prototype.getCurrentState = function () {
    var state = {answers: []};
    for (var i = 0; i < this.draggables.length; i++) {
      var draggable = this.draggables[i];
      if (draggable === undefined) {
        continue;
      }

      var draggableAnswers = [];
      for (var j = 0; j < draggable.elements.length; j++) {
        var element = draggable.elements[j];
        if (element === undefined || element.dropZone === undefined) {
          continue;
        }

        // Verify that draggables actually has its correct positions
        // (could have been chaged by auto-align without being updated in draggable)
        element.position = C.positionToPercentage(this.$container, element.$);

        // Store position and drop zone.
        draggableAnswers.push({
          x: Number(element.position.left.replace('%', '')),
          y: Number(element.position.top.replace('%', '')),
          dz: element.dropZone
        });
      }

      if (draggableAnswers.length) {
        // Add answers to state object for storage
        state.answers[i] = draggableAnswers;
      }
    }

    return state;
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
        rights.setLabel((element.dropZones.length ? 'Draggable ' : 'Static ') + (element.type.params.contentName !== undefined ? element.type.params.contentName : 'element'));
        info.addContent(rights);
      }
    }

    return info;
  };

  C.prototype.getTitle = function() {
    return H5P.createTitle(this.options.question.settings.questionTitle);
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
      if (!opacity) {
        $element.css({
          "background-color": "rgba(245, 245, 245, 0)",
          "background-image": "none"
        });
      }
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

    var original = $element.css(property);

    // Reset css to be sure we're using CSS and not inline values.
    var properties = getProperties(property, '');
    $element.css(properties);

    // Determine prop and assume all props are the same and use the first.
    for (var prop in properties) {
      break;
    }

    // Get value from css
    var style = $element.css(prop);
    if (style === '' || style === 'none') {
      // No value from CSS, fall back to original
      style = original;
    }

    style = C.setAlphas(style, 'rgba(', opacity); // Update rgba
    style = C.setAlphas(style, 'rgb(', opacity); // Convert rgb

    $element.css(getProperties(property, style));
  };

  /**
   * Updates alpha channel for colors in the given style.
   *
   * @param {String} style
   * @param {String} prefix
   * @param {Number} alpha
   */
  C.setAlphas = function (style, prefix, alpha) {
    // Style undefined
    if (!style) {
      return;
    }
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
   * Creates a new draggable instance.
   * Makes it easier to keep track of all instance variables and elements.
   *
   * @class
   * @param {object} element
   * @param {number} id
   * @param {array} [answers] from last session
   */
  function Draggable(element, id, answers) {
    var self = this;
    H5P.EventDispatcher.call(this);

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

    if (answers) {
      if (self.multiple) {
        // Add base element
        self.elements.push({});
      }

      // Add answers
      for (var i = 0; i < answers.length; i++) {
        self.elements.push({
          dropZone: answers[i].dz,
          position: {
            left: answers[i].x + '%',
            top: answers[i].y + '%'
          }
        });
      }
    }
  }

  Draggable.prototype = Object.create(H5P.EventDispatcher.prototype);
  Draggable.prototype.constructor = Draggable;

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
      },
      appendTo: $container
    })
      .draggable({
        revert: function (dropZone) {
          $container.removeClass('h5p-dragging');
          var $this = $(this);

          $this.removeClass('h5p-dropped').data("uiDraggable").originalPosition = {
            top: self.y + '%',
            left: self.x + '%'
          };
          C.setElementOpacity($this, self.backgroundOpacity);

          self.trigger('dropped');

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
          $container.addClass('h5p-dragging');
          C.setElementOpacity($this, self.backgroundOpacity);

          self.trigger('drag');
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
                if (i !== index && self.elements[i] !== undefined && self.elements[i].dropZone === addToZone) {
                  // Remove element
                  if (self.elements[index].dropZone !== undefined && self.elements[index].dropZone !== addToZone) {
                    // Leaving old drop zone!
                    self.trigger('leavingDropZone', element);
                  }
                  $this.remove();
                  delete self.elements[index];
                  return;
                }
              }
            }

            if (element.dropZone !== undefined && element.dropZone !== addToZone) {
              // Leaving old drop zone!
              self.trigger('leavingDropZone', element);
            }
            element.dropZone = addToZone;

            $this.addClass('h5p-dropped');
            C.setElementOpacity($this, self.backgroundOpacity);
            self.trigger('interacted');
          }
          else {
            if (self.multiple) {
              // Remove element
              if (self.elements[index].dropZone !== undefined) {
                self.trigger('leavingDropZone', self.elements[index]);
              }
              $this.remove();
              delete self.elements[index];
            }
            else {
              // Reset position and drop zone.
              if (element.dropZone !== undefined) {
                self.trigger('leavingDropZone', element);
                delete element.dropZone;
              }
              delete element.position;
            }
          }
        }
      }).css('position', '');
    self.element = element;

    if (element.position) {
      // Restore last position
      element.$.css(element.position).addClass('h5p-dropped');
    }

    C.addHover(element.$, self.backgroundOpacity);
    H5P.newRunnable(self.type, contentId, element.$);

    // Update opacity when element is attached.
    setTimeout(function () {
      C.setElementOpacity(element.$, self.backgroundOpacity);
    }, 0);
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
   * Resets the position of the draggable to its' original position.
   * @public
   */
  Draggable.prototype.resetPosition = function () {
    var self = this;

    this.elements.forEach(function (draggable) {
      //If the draggable is in a dropzone reset its' position and feedback.
      if (draggable.dropZone !== undefined) {
        var element = draggable.$;

        //Revert the button to initial position and then remove it.
        element.animate({
          left: self.x + '%',
          top: self.y + '%'
        }, function () {
          //Remove the draggable if it is an infinity draggable.
          if (self.multiple) {
            if (element.dropZone !== undefined) {
              self.trigger('leavingDropZone', element);
            }
            element.remove();
            //Delete the element from elements list to avoid a cluster of draggables on top of infinity draggable.
            if (self.elements.indexOf(draggable) >= 0) {
              delete self.elements[self.elements.indexOf(draggable)];
            }
          }
        });

        // Reset element style
        element.removeClass('h5p-wrong')
          .removeClass('h5p-correct')
          .removeClass('h5p-dropped')
          .css({
            border: '',
            background: ''
          });
        C.setElementOpacity(element, self.backgroundOpacity);
      }
    });

    // Draggable removed from dropzone.
    if (self.element.dropZone !== undefined) {
      self.trigger('leavingDropZone', self.element);
      delete self.element.dropZone;
    }

    // Reset style on initial element
    self.element.$.removeClass('h5p-wrong')
      .removeClass('h5p-correct')
      .removeClass('h5p-dropped')
      .css({
        border: '',
        background: ''
      });
    C.setElementOpacity(self.element.$, self.backgroundOpacity);
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

  /**
   * Disables the draggable.
   * @public
   */
  Draggable.prototype.disable = function () {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined) {
        self.elements[i].$.draggable('disable');
      }
    }
  };

  /**
   * Enables the draggable.
   * @public
   */
  Draggable.prototype.enable = function () {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined) {
        self.elements[i].$.draggable('enable');
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
    self.rawPoints = 0;

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
          self.rawPoints++;
          points++;
          break;
        }
      }

      if (!correct) {
        // Nope, we're in another zone
        if (skipVisuals !== true) {
          element.$.addClass('h5p-wrong');
          C.setElementOpacity(element.$, self.backgroundOpacity);
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
    self.autoAlignEnabled = dropZone.autoAlign;
    self.alignables = [];
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
    self.$dropZone = $('<div/>', {
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
              if (draggables[i] === undefined) {
                continue;
              }
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

            if (element === undefined) {
              return;
            }

            // Check to see if the draggable can be dropped in this zone
            return element.hasDropZone(self.id);
          },
          drop: function (event, ui) {
            var $this = $(this);
            C.setOpacity($this.removeClass('h5p-over'), 'background', self.backgroundOpacity);
            ui.draggable.data('addToZone', self.id);

            if (self.autoAlignEnabled) {
              if (self.getIndexOf(ui.draggable) === -1) {
                // Add to alignables
                self.alignables.push(ui.draggable);
              }

              // Trigger alignment
              self.autoAlign();
            }
          },
          over: function (event, ui) {
            C.setOpacity($(this).addClass('h5p-over'), 'background', self.backgroundOpacity);
          },
          out: function (event, ui) {
            C.setOpacity($(this).removeClass('h5p-over'), 'background', self.backgroundOpacity);
          }
        })
        .end();

    // Add tip after setOpacity(), so this does not get background opacity:
    if (self.tip !== undefined && self.tip.trim().length) {
      self.$dropZone.append(H5P.JoubelUI.createTip(self.tip));
    }

    if (self.autoAlignEnabled) {
      draggables.forEach(function (draggable) {
        var dragEl = draggable.element.$;

        // Add to alignables
        if (draggable.isInDropZone(self.id) && self.getIndexOf(dragEl) === -1) {
          self.alignables.push(dragEl);
        }
      });
      self.autoAlign();
    }

    // Set element opacity when element has been appended
    setTimeout(function () {
      C.setOpacity(self.$dropZone.children('.h5p-label'), 'background', self.backgroundOpacity);
      C.setOpacity(self.$dropZone.children('.h5p-inner'), 'background', self.backgroundOpacity);
    }, 0);
  };

  /**
   * Find index of given alignable
   *
   * @param {jQuery} $alignable
   * @return {number}
   */
  DropZone.prototype.getIndexOf = function ($alignable) {
    var self = this;

    for (var i = 0; i < self.alignables.length; i++) {
      if (self.alignables[i][0] === $alignable[0]) {
        return i;
      }
    }

    return -1
  };

  /**
   * Remove alignable
   *
   * @param {jQuery} $alignable
   */
  DropZone.prototype.removeAlignable = function ($alignable) {
    var self = this;

    // Find alignable index
    var index = self.getIndexOf($alignable);
    if (index !== -1) {

      // Remove alignable
      self.alignables.splice(index, 1);

      if (self.autoAlignTimer === undefined) {
        // Schedule re-aligment of alignables left
        self.autoAlignTimer = setTimeout(function () {
          delete self.autoAlignTimer;
          self.autoAlign();
        }, 1);
      }
    }
  }

  /**
   * Auto-align alignable elements inside drop zone.
   */
  DropZone.prototype.autoAlign = function () {
    var self = this;

    // Determine container size in order to calculate percetages
    var containerSize = self.$dropZone.parent()[0].getBoundingClientRect();

    // Calcuate borders and spacing values in percetage
    var spacing = {
      x: (self.autoAlignEnabled.spacing / self.autoAlignEnabled.size.width) * 100,
      y: (self.autoAlignEnabled.spacing / self.autoAlignEnabled.size.height) * 100
    };

    // Determine coordinates for first 'spot'
    var pos = {
      x: self.x + spacing.x,
      y: self.y + spacing.y
    };

    // Determine space inside drop zone
    var dropZoneSize = self.$dropZone[0].getBoundingClientRect();
    var space = {
      x: dropZoneSize.width - (spacing.x * 2),
      y: dropZoneSize.height - (spacing.y * 2)
    };

    // Set current space left inside drop zone
    var spaceLeft = {
      x: space.x,
      y: space.y
    };

    // Set height for the active row of elements
    var currentRowHeight = 0;

    // Current alignable element and it's size
    var $alignable, alignableSize;

    /**
     * Helper doing the actual positioning of the element + recalculating
     * next position and space left.
     *
     * @private
     */
    var alignElement = function () {
      // Position element at current spot
      $alignable.css({
        left: pos.x + '%',
        top: pos.y + '%'
      });

      // Update horizontal space left + next position
      var spaceDiffX = (alignableSize.width + self.autoAlignEnabled.spacing);
      spaceLeft.x -= spaceDiffX;
      pos.x += (spaceDiffX / containerSize.width) * 100;

      // Keep track of the highest element in this row
      var spaceDiffY = (alignableSize.height + self.autoAlignEnabled.spacing);
      if (spaceDiffY > currentRowHeight) {
        currentRowHeight = spaceDiffY;
      }
    };

    // Try to order and align the alignables inside the drop zone
    // (in the order they were added)
    for (var i = 0; i < self.alignables.length; i++) {

      // Determine alignable size
      $alignable = self.alignables[i];
      alignableSize = $alignable[0].getBoundingClientRect();

      // Try to fit on the current row
      if (spaceLeft.x >= alignableSize.width) {
        alignElement();
      }
      else {
        // Did not fit, try next row

        // Reset X values
        spaceLeft.x = space.x;
        pos.x = self.x + spacing.x;

        // Bump Y values
        if (currentRowHeight) {
          // Update Y space and position according to previous row height
          spaceLeft.y -= currentRowHeight;
          pos.y += (currentRowHeight / containerSize.height) * 100;

          // Reset
          currentRowHeight = 0;
        }
        if (spaceLeft.y <= 0) {
          return; // No more vertical space left, stop all aliging
        }
        alignElement();
      }
    }
  };

  return C;
})(H5P.jQuery);
