import Controls from 'h5p-lib-controls/src/scripts/controls';
import AriaDrag from 'h5p-lib-controls/src/scripts/aria/drag';
import AriaDrop from 'h5p-lib-controls/src/scripts/aria/drop';
import UIKeyboard from 'h5p-lib-controls/src/scripts/ui/keyboard';
import Mouse from 'h5p-lib-controls/src/scripts/ui/mouse';

import DragUtils from './drag-utils';
import DropZone from './dropzone';
import Draggable from './draggable';

const $ = H5P.jQuery;
let numInstances = 0;

/**
 * Constructor
 *
 * @class
 * @extends H5P.Question
 * @param {Object} options Run parameters
 * @param {number} id Content identification
 * @param {Object} contentData
 */
function C(options, contentId, contentData) {
  var self = this;
  var i, j;
  numInstances++;
  this.id = this.contentId = contentId;
  this.contentData = contentData;

  H5P.Question.call(self, 'dragquestion');
  this.options = $.extend(true, {}, {
    scoreShow: 'Check',
    tryAgain: 'Retry',
    grabbablePrefix: 'Grabbable {num} of {total}.',
    grabbableSuffix: 'Placed in dropzone {num}.',
    dropzonePrefix: 'Dropzone {num} of {total}.',
    noDropzone: 'No dropzone',
    tipLabel: 'Show tip.',
    tipAvailable: 'Tip available',
    correctAnswer: 'Correct answer',
    wrongAnswer: 'Wrong answer',
    feedbackHeader: 'Feedback',
    scoreBarLabel: 'You got :num out of :total points',
    scoreExplanationButtonLabel: 'Show score explanation',
    question: {
      settings: {
        questionTitle: (this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Drag and drop',
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
    overallFeedback: [],
    behaviour: {
      enableRetry: true,
      enableCheckButton: true,
      preventResize: false,
      singlePoint: false,
      applyPenalties: true,
      enableScoreExplanation: true,
      dropZoneHighlighting: 'dragging',
      autoAlignSpacing: 2,
      showScorePoints: true,
      showTitle: false
    },
    a11yCheck: 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.',
    a11yRetry: 'Retry the task. Reset all responses and start the task over again.',
    submit: 'Submit',
  }, options);

  // If single point is enabled, it makes no sense displaying
  // the score explanation. Note: In the editor, the score explanation is hidden
  // by the showWhen widget if singlePoint is enabled
  if (this.options.behaviour.singlePoint) {
    this.options.behaviour.enableScoreExplanation = false;
  }

  this.draggables = [];
  this.dropZones = [];
  this.answered = (contentData && contentData.previousState !== undefined && contentData.previousState.answers !== undefined && contentData.previousState.answers.length);
  this.blankIsCorrect = true;

  this.backgroundOpacity = (this.options.behaviour.backgroundOpacity === undefined || this.options.behaviour.backgroundOpacity.trim() === '') ? undefined : this.options.behaviour.backgroundOpacity;

  self.$noDropZone = $('<div class="h5p-dq-no-dz" role="button" style="display:none;"><span class="h5p-hidden-read">' + self.options.noDropzone + '</span></div>');

  // Initialize controls for good a11y
  var controls = getControls(self.draggables, self.dropZones, self.$noDropZone[0]);

  /**
   * Update the drop effect for all drop zones accepting this draggable.
   *
   * @private
   * @param {string} effect
   */
  var setDropEffect = function (effect) {
    for (var i = 0; i < controls.drop.elements.length; i++) {
      controls.drop.elements[i].setAttribute('aria-dropeffect', effect);
    }
  };

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

  const isDraggable = element => {
    return !(element.dropZones === undefined || !element.dropZones.length);
  };

  // Add draggable elements
  var grabbablel10n = {
    prefix: self.options.grabbablePrefix.replace('{total}', task.elements.filter(isDraggable).length),
    suffix: self.options.grabbableSuffix,
    correctAnswer: self.options.correctAnswer,
    wrongAnswer: self.options.wrongAnswer
  };
  let draggableNum = 1; // Human readable label (a11y)
  for (i = 0; i < task.elements.length; i++) {
    var element = task.elements[i];

    if (!isDraggable(element)) {
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
    var draggable = new Draggable(element, i, answers, grabbablel10n, task.dropZones, draggableNum++);
    var highlightDropZones = (self.options.behaviour.dropZoneHighlighting === 'dragging');
    draggable.on('elementadd', function (event) {
      controls.drag.addElement(event.data);
    });
    draggable.on('elementremove', function (event) {
      controls.drag.removeElement(event.data);
      if (event.data.getAttribute('aria-grabbed') === 'true') {
        controls.drag.firesEvent('select', event.data);
        event.data.removeAttribute('aria-grabbed');
      }
    });
    draggable.on('focus', function (event) {
      controls.drag.setTabbable(event.data);
      event.data.focus();
    });
    draggable.on('dragstart', function (event) {
      if (highlightDropZones) {
        self.$container.addClass('h5p-dq-highlight-dz');
      }
      setDropEffect(event.data);
    });
    draggable.on('dragend', function () {
      if (highlightDropZones) {
        self.$container.removeClass('h5p-dq-highlight-dz');
      }
      setDropEffect('none');
    });
    draggable.on('interacted', function () {
      self.answered = true;
      self.triggerXAPI('interacted');
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

  var dropzonel10n = {
    prefix: self.options.dropzonePrefix.replace('{total}', task.dropZones.length),
    tipLabel: self.options.tipLabel,
    tipAvailable: self.options.tipAvailable
  };

  // Add drop zones
  for (i = 0; i < task.dropZones.length; i++) {
    var dropZone = task.dropZones[i];

    if (dropZonesWithoutElements[i] === true) {
      this.numDropZonesWithoutElements += 1;
    }

    if (this.blankIsCorrect && dropZone.correctElements.length) {
      this.blankIsCorrect = false;
    }

    dropZone.autoAlign = {
      enabled: dropZone.autoAlign,
      spacing: self.options.behaviour.autoAlignSpacing,
      size: self.options.question.settings.size
    };

    this.dropZones[i] = new DropZone(dropZone, i, dropzonel10n);

    // Update element internal position when aligned
    this.dropZones[i].on('elementaligned', function (event) {
      let $aligned = event.data;

      for (let i = 0; i < self.draggables.length; i++) {
        let draggable = self.draggables[i];
        if (!draggable || !draggable.elements || !draggable.elements.length) {
          continue;
        }

        for (let j = 0; j < draggable.elements.length; j++) {
          let element = draggable.elements[j];
          if (!element || element.$[0] !== $aligned[0]) {
            continue;
          }

          // Update position
          element.position = DragUtils.positionToPercentage(self.$container, element.$);
          return;
        }
      }
    });
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
  if (self.options.behaviour.showTitle) {
    self.$introduction = $('<p class="h5p-dragquestion-introduction" id="dq-intro-' + numInstances + '">' + self.options.question.settings.questionTitle + '</p>');
    self.setIntroduction(self.$introduction);
  }


  // Set class if no background
  var classes = '';
  if (this.options.question.settings.background !== undefined) {
    classes += 'h5p-dragquestion-has-no-background';
  }
  if (self.options.behaviour.dropZoneHighlighting === 'always' ) {
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
  if (H5P.canHasFullScreen !== false && this.options.behaviour.enableFullScreen) {

    // We create a function that is used to enter or
    // exit full screen when our button is pressed
    var toggleFullScreen = function () {
      if (H5P.isFullscreen) {
        H5P.exitFullScreen(self.$container);
      }
      else {
        H5P.fullScreen(self.$container.parent().parent(), self);
      }
    };

    // Create full screen button
    var $fullScreenButton = $('<div/>', {
      'class': 'h5p-my-fullscreen-button-enter',
      title: this.options.localize.fullscreen,
      role: 'button',
      tabindex: 0,
      on: {
        click: toggleFullScreen,
        keypress: function (event) {
          if (event.which === 13 || event.which === 32) {
            toggleFullScreen();
            event.preventDefault();
          }
        }
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
  };
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
  for (i = 0; i < this.options.question.task.dropZones.length; i++) {
    definition.target.push({
      'id': '' + i,
      'description': {
        // Remove tags, must wrap in div tag because jQuery 1.9 will crash if the string isn't wrapped in a tag.
        'en-US': $('<div>' + this.options.question.task.dropZones[i].label + '</div>').text()
      }
    });
    if (this.options.question.task.dropZones[i].correctElements) {
      for (var j = 0; j < this.options.question.task.dropZones[i].correctElements.length; j++) {
        /**
         * NOTE: The editor allows you to turn a draggable that was correct
         * in a dropzone into a non-draggable, but leaves the non-draggable
         * associated with the dropzone if it was previously marked as correct
         * within that dropzone.
         * Because of this we have to check if the draggable that is marked
         * as correct within this dropzone can actually be dropped on this
         * dropzone in the draggable's data.
         */
        const task = this.options.question.task;
        const draggable = task.elements[task.dropZones[i].correctElements[j]];
        if (!draggable || draggable.dropZones.indexOf(i.toString()) < 0) {
          continue;
        }

        if (!firstCorrectPair) {
          definition.correctResponsesPattern[0] += '[,]';
        }
        definition.correctResponsesPattern[0] += i + '[.]' + task.dropZones[i].correctElements[j];
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
    return '';
  }

  return answers
    .filter(function (answerMapping) {
      return answerMapping.elements.length;
    })
    .map(function (answerMapping) {
      return answerMapping.elements
        .filter(function (element) {
          return element.dropZone !== undefined;
        }).map(function (element) {
          return element.dropZone + '[.]' + answerMapping.index;
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
    };
  });
};

/**
 * Append field to wrapper.
 */
C.prototype.createQuestionContent = function () {
  var i;
  // If reattaching, we no longer show solution. So forget that we
  // might have done so before.

  this.$container = $('<div class="h5p-inner" role="application" aria-labelledby="dq-intro-' + numInstances + '"></div>');
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
      const instance = H5P.newRunnable(element.type, this.id, $element);

      // Resize audio button manually, because wrapper uses relative dimensions
      const libraryName = element.type.library.split(' ')[0];
      if (libraryName === 'H5P.Audio') {
        this.on('resize', function () {
          instance.resize();
        });
      }

      var timedOutOpacity = function ($el, el) {
        setTimeout(function () {
          DragUtils.setOpacity($el, 'background', el.backgroundOpacity);
        }, 0);
      };
      timedOutOpacity($element, element);
    }
  }

  // Attach invisible 'reset' drop zone for keyboard users
  this.$noDropZone.appendTo(this.$container);

  // Attach drop zones
  for (i = 0; i < this.dropZones.length; i++) {
    this.dropZones[i].appendTo(this.$container, this.draggables);
  }
  return this.$container;
};

C.prototype.registerButtons = function () {
  if (this.options.behaviour.enableCheckButton) {
    // Add show score button
    this.addSolutionButton();
  }

  this.addRetryButton();
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
    that.addExplanation();
    var xAPIEvent = that.createXAPIEventTemplate('answered');
    that.addQuestionToXAPI(xAPIEvent);
    that.addResponseToXAPI(xAPIEvent);
    that.trigger(xAPIEvent);

    // Focus top of task for better focus and read-speaker flow
    var $nextFocus = that.$introduction ? that.$introduction : that.$container.children().first();
    $nextFocus.focus();
  }, true, {
    'aria-label': this.options.a11yCheck,
  }, {
    contentData: this.contentData,
    textIfSubmitting: this.options.submit,
  });
};

/**
 * Add explanation/feedback (the part on the bottom part)
 */
C.prototype.addExplanation = function () {
  const task = this.options.question.task;

  let explanations = [];

  // Go through all dropzones, and find answers:
  task.dropZones.forEach((dropZone, dropZoneId) => {
    const feedback = {
      correct: dropZone.tipsAndFeedback.feedbackOnCorrect,
      incorrect: dropZone.tipsAndFeedback.feedbackOnIncorrect
    };
    // Don't run this code if feedback is not configured;
    if (feedback.correct === undefined && feedback.incorrect === undefined) {
      return;
    }

    // Index for correct draggables
    const correctElements = dropZone.correctElements;

    // Find all dragables placed on this dropzone:
    let placedDraggables = {};
    this.draggables.forEach(draggable => {
      draggable.elements.forEach(dz => {
        if (dz.dropZone == dropZoneId) {
          // Save reference to draggable, and mark it as correct/incorrect
          placedDraggables[draggable.id] = {
            instance: draggable,
            correct: correctElements.indexOf("" + draggable.id) !== -1
          };
        }
      });
    });

    // Go through each placed draggable
    Object.keys(placedDraggables).forEach(draggableId => {
      const draggable = placedDraggables[draggableId];
      const draggableLabel = DragUtils.strip(draggable.instance.type.params.alt || draggable.instance.type.params.text) || '?';
      const dropZoneLabel = DragUtils.strip(dropZone.label);

      if (draggable.correct && feedback.correct) {
        explanations.push({
          correct: dropZoneLabel + ' + ' + draggableLabel,
          text: feedback.correct
        });

        draggable.instance.setFeedback(feedback.correct, dropZoneId);
      }
      else if (!draggable.correct && feedback.incorrect) {
        explanations.push({
          correct: dropZoneLabel + ' + ',
          wrong: draggableLabel,
          text: feedback.incorrect
        });

        draggable.instance.setFeedback(feedback.incorrect, dropZoneId);
      }
    });
  });

  if (explanations.length !== 0) {
    this.setExplanation(explanations, this.options.feedbackHeader);
  }
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
  }, false, {
    'aria-label': this.options.a11yRetry,
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
C.prototype.resize = function (e) {
  var self = this;
  // Make sure we use all the height we can get. Needed to scale up.
  if (this.$container === undefined || !this.$container.is(':visible')) {
    // Not yet attached or visible – not possible to resize correctly
    return;
  }

  // Update background opacity for dropzones (in case they were not previously
  // appended)
  self.dropZones.forEach(function (dropzone) {
    dropzone.updateBackgroundOpacity();
  });

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
 * Shows the correct solutions on the boxes and disables input and buttons depending on settings.
 * @public
 * @params {Boolean} skipVisuals Skip visual animations.
 */
C.prototype.showAllSolutions = function (skipVisuals) {
  this.points = 0;
  this.rawPoints = 0;

  // One correct point for each "no solution" dropzone if there are no solutions
  if (this.blankIsCorrect) {
    this.points = 1;
    this.rawPoints = 1;
  }

  var scorePoints;
  if (!skipVisuals && this.options.behaviour.showScorePoints && !this.options.behaviour.singlePoint && this.options.behaviour.applyPenalties) {
    scorePoints = new H5P.Question.ScorePoints();
  }

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
    this.points += draggable.results(skipVisuals, this.correctDZs[i], scorePoints);
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

  // If DOM loaded - reset it
  if (this.$container) {
    this.dropZones.forEach(function (dropzone) {
      dropzone.reset();
    });
  
    // Enables Draggables
    this.enableDraggables();
  
    //Reset position and feedback.
    this.draggables.forEach(function (draggable) {
      draggable.resetPosition();
    });
  } else {
    // Reset actual position values
    for (let i = 0; i < this.draggables.length; i++) {
      if (this.draggables[i] !== undefined) {
        for (let j = 0; j < this.draggables[i].elements.length; j++) {
          if (this.draggables[i].elements[j] !== undefined) {
            this.draggables[i].elements[j].dropZone = undefined;
            this.draggables[i].elements[j].position = undefined;
          }
        }
      }
    }
  }

  //Show solution button
  this.showButton('check-answer');
  this.hideButton('try-again');
  this.removeFeedback();
  this.setExplanation();
};

/**
 * Calculates the real max score.
 *
 * @returns {Number} Max points
 */
C.prototype.calculateMaxScore = function () {
  var max = 0;

  if (this.blankIsCorrect) {
    return 1;
  }

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
  return this.answered || this.blankIsCorrect;
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
  var scoreText = H5P.Question.determineOverallFeedback(this.options.overallFeedback, actualPoints / maxScore).replace('@score', actualPoints).replace('@total', maxScore);
  var helpText = (this.options.behaviour.enableScoreExplanation && this.options.behaviour.applyPenalties) ? this.options.scoreExplanation : false;
  this.setFeedback(scoreText, actualPoints, maxScore, this.options.scoreBarLabel, helpText, undefined, this.options.scoreExplanationButtonLabel);
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

C.prototype.getTitle = function() {
  return H5P.createTitle((this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Drag and drop');
};

/**
 * Initialize controls to improve a11Y.
 *
 * @private
 * @param {Draggable[]} draggables
 * @param {DropZone[]} dropZones
 * @param {Element} noDropzone
 * @return {Object<string, Controls>}
 */
var getControls = function (draggables, dropZones, noDropzone) {
  // Initialize controls components
  var controls = {
    drag: new Controls([new UIKeyboard(), new Mouse(), new AriaDrag()]),
    drop: new Controls([new UIKeyboard(), new Mouse(), new AriaDrop()])
  };
  controls.drag.useNegativeTabIndex();
  controls.drop.useNegativeTabIndex();

  // Keep track of current selected draggable (selected via keyboard)
  var selected;

  /**
   * De-selects the currently selected draggable element.
   *
   * @private
   */
  var deselect = function () {
    selected.draggable.trigger('dragend');
    selected.element.$.removeClass('h5p-draggable-hover');
    DragUtils.setElementOpacity(selected.element.$, selected.draggable.backgroundOpacity);

    if (controls.drop.elements.indexOf(noDropzone) !== -1) {
      controls.drop.removeElement(noDropzone);
      noDropzone.style.display = 'none';
    }
    for (var i = 0; i < dropZones.length; i++) {
      var dropZone = dropZones[i];

      // Remove highlighting
      dropZone.dehighlight();

      if (controls.drop.elements.indexOf(dropZone.$dropZone[0]) !== -1) {
        controls.drop.removeElement(dropZone.$dropZone[0]);
      }
    }

    if (selected.element.$.is(':visible')) {
      // Put focus back on element after deselecting
      selected.element.$.focus();
    }
    else {
      // Put focus on next draggable element
      var $next = selected.draggable.elements[selected.draggable.elements.length - 1].$;
      controls.drag.setTabbable($next[0]);
      $next.focus();
    }
    selected = undefined;
  };

  // Handle draggable selected through keyboard
  controls.drag.on('select', function (event) {
    var result = DragUtils.elementToDraggable(draggables, event.element);
    if (selected) {
      // De-select
      deselect();
      return;
    }
    selected = result;

    // Select
    selected.element.$.addClass('h5p-draggable-hover');
    DragUtils.setElementOpacity(selected.element.$, selected.draggable.backgroundOpacity);
    selected.draggable.trigger('dragstart', selected.draggable.mustCopyElement(selected.element) ? 'copy' : 'move');

    // Add special drop zone to reset
    controls.drop.addElement(noDropzone);

    // Position at element position
    noDropzone.style.display = 'block';
    noDropzone.style.left = selected.draggable.x + '%';
    noDropzone.style.top = selected.draggable.y + '%';
    noDropzone.style.width = selected.draggable.width + 'em';
    noDropzone.style.height = selected.draggable.height + 'em';

    // Figure out which drop zones will accept this draggable
    var $first;
    for (var i = 0; i < dropZones.length; i++) {
      var dropZone = dropZones[i];

      if (dropZone.accepts(selected.draggable, draggables)) {
        dropZone.highlight();
        controls.drop.addElement(dropZone.$dropZone[0]);
        if (!$first || selected.element.dropZone === dropZone.id) {
          $first = dropZone.$dropZone;
        }

      }
    }
    if ($first) {
      // Focus the first drop zone after selecting a draggable
      controls.drop.setTabbable($first[0]);
      $first.focus();
    }
  });

  // Handle dropzone selected through keyboard
  controls.drop.on('select', function (event) {
    if (!selected) {
      return;
    }
    if (event.element === noDropzone) {
      // Reset position

      if (selected.element.dropZone !== undefined) {
        selected.element.reset();
      }
      if (selected !== undefined) { // Equals draggable.multiple === false
        selected.element.$.css({
          left: selected.draggable.x + '%',
          top: selected.draggable.y + '%',
          width: selected.draggable.width + 'em',
          height: selected.draggable.height + 'em'
        });
        selected.draggable.updatePlacement(selected.element);
        selected.element.$[0].setAttribute('aria-grabbed', 'false');
        deselect();
      }
      return;
    }

    var dropZone = DragUtils.elementToDropZone(dropZones, event.element);

    var mustCopyElement = selected.draggable.mustCopyElement(selected.element);
    if (mustCopyElement) {
      // Leave a new element for next drag
      selected.element.clone();
    }

    // Add draggable to drop zone
    selected.draggable.addToDropZone(selected.index, selected.element, dropZone.id);

    // Set position in case DZ is full (auto align doesn't work)
    selected.element.$.css({
      left: dropZone.x + '%',
      top: dropZone.y + '%',
    });

    if (dropZone.getIndexOf(selected.element.$) === -1) {
      // Add to alignables
      dropZone.alignables.push(selected.element.$);
    }

    // Trigger alignment
    dropZone.autoAlign();

    // Reset selected
    selected.element.$[0].setAttribute('aria-grabbed', 'false');
    deselect();
  });

  return controls;
};

H5P.DragQuestion = C;
