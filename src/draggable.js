import DragUtils from './drag-utils';

const $ = H5P.jQuery;

/** @constant {number} OPACITY_FULL Opacity value for fully visible elements. */
const OPACITY_FULL = 100;

/** @constant {number} OPACITY_DRAGGING Opacity value for elements being dragged. */
const OPACITY_DRAGGING = 50;

// Helper to stop propagating events
const stopPropagation = event => event.stopPropagation();

export default class Draggable extends H5P.EventDispatcher {
  /**
   * Creates a new draggable instance.
   * Makes it easier to keep track of all instance variables and elements.
   *
   * @class
   * @param {Object} element
   * @param {number} id
   * @param {Array} [answers] from last session
   * @param {Object.<string, string>} l10n
   * @param {Array} [dropZones] Dropzones for a draggable
   * @param {number} draggableNum Number of this draggable (for a11y)
   * @param {Object} [options]
   */
  constructor(element, id, answers, l10n, dropZones, draggableNum, options = {}) {
    super();
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
    self.l10n = l10n;
    self.allDropzones = dropZones;
    self.draggableNum = draggableNum;
    self.dragHandleWanted = options.dragHandleWanted ?? false;

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

  /**
   * Insert draggable elements into the given container.
   *
   * @param {jQuery} $container
   * @param {Number} contentId
   * @returns {undefined}
   */
  appendTo($container, contentId) {
    var self = this;

    if (!self.elements.length) {
      self.attachElement(null, $container, contentId);
    }
    else {
      for (var i = 0; i < self.elements.length; i++) {
        self.attachElement(i, $container, contentId);
      }
    }
  }

  /**
   * Attach the given element to the given container.
   *
   * @param {Number} index
   * @param {jQuery} $container
   * @param {Number} contentId
   * @returns {undefined}
   */
  attachElement(index, $container, contentId) {
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

    $.extend(element, {
      clone: function () {
        self.attachElement(null, $container, contentId);
      },
      reset: function () {
        if (element.dropZone !== undefined) {
          // Let everyone know we're leaving the drop zone
          self.trigger('leavingDropZone', element);
          delete element.dropZone;
        }

        if (self.multiple) {
          // Remove element
          element.$.remove();
          delete self.elements[index];
          self.trigger('elementremove', element.$[0]);
        }
        delete element.position;
      }
    });

    const instanceHolderDOM = document.createElement('div');
    H5P.newRunnable(self.type, contentId, H5P.jQuery(instanceHolderDOM));

    const draggableElement = H5P.Components.Draggable({
      dom: instanceHolderDOM,
      hasHandle: self.dragHandleWanted,
      handleRevert: (dropZone) => {
        $container.removeClass('h5p-dragging');
        const $this = $(draggableElement);

        $this.data("uiDraggable").originalPosition = {
          top: self.y + '%',
          left: self.x + '%'
        };

        this.updatePlacement(element);
        $this[0].setAttribute('aria-grabbed', 'false');

        this.trigger('dragend');

        return !dropZone;
      },
      handleDragStartEvent: (event) => {
        const $this = $(draggableElement);

        const mustCopyElement = this.mustCopyElement(element);
        if (mustCopyElement) {
          // Leave a new element for next drag
          element.clone();
        }

        // Send element to the top!
        $this.removeClass('h5p-wrong').detach().appendTo($container);
        $container.addClass('h5p-dragging');
        draggableElement.setContentOpacity(this.backgroundOpacity);
        draggableElement.setAttribute('aria-grabbed', 'true');

        this.trigger('focus', draggableElement);
        this.trigger('dragstart', {
          element: draggableElement,
          effect: mustCopyElement ? 'copy' : 'move'
        });
      },
      handleDragEvent: () => {
        draggableElement.setOpacity(OPACITY_DRAGGING);
      },
      handleDragStopEvent: () => {
        draggableElement.setOpacity(OPACITY_FULL);

        const $this = $(draggableElement);

        // Convert position to % to support scaling.
        element.position = DragUtils.positionToPercentage($container, $this);

        $this.css(element.position);

        const addToZone = $this.data('addToZone');
        if (addToZone !== undefined) {
          $this.removeData('addToZone');
          this.addToDropZone(index, element, addToZone);
        }
        else {
          element.reset();
        }
      }
    });

    draggableElement.addEventListener('click', () => {
      self.trigger('focus', draggableElement);
    });
    draggableElement.addEventListener('touchstart', stopPropagation);
    draggableElement.addEventListener('touchmove', stopPropagation);
    draggableElement.addEventListener('touchend', stopPropagation);

    $container[0].append(draggableElement);
    draggableElement.style.left = self.x + '%';
    draggableElement.style.top = self.y + '%';
    draggableElement.style.width = self.width + 'em';
    draggableElement.style.height = self.height + 'em';
    draggableElement.style.position = '';

    draggableElement.setContentOpacity(self.backgroundOpacity);

    element.$ = $(draggableElement);

    self.element = element;

    if (element.position) {
      // Restore last position
      element.$.css(element.position);
      self.updatePlacement(element);
    }

    // Add prefix for good a11y
    $('<span class="h5p-hidden-read">' + (self.l10n.prefix.replace('{num}', self.draggableNum)) + '</span>').prependTo(element.$);

    // Add suffix for good a11y
    $('<span class="h5p-hidden-read"></span>').appendTo(element.$);

    self.trigger('elementadd', element.$[0]);
  }

  /**
   * Set feedback for a draggable.
   * @param {string} feedback
   * @param {number} dropZoneId
   */
  setFeedback(feedback, dropZoneId) {
    this.elements.forEach(element => {
      if (element.dropZone === dropZoneId) {
        if (element.$feedback === undefined) {
          element.$feedback = $('<span>', {
            'class': 'h5p-hidden-read',
            appendTo: element.$
          });
        }
        element.$feedback.html(feedback);
      }
    });
  }

  /**
   * Determine if element should be copied when tragging, i.e. infinity instances.
   *
   * @param {Object} element
   * @returns {boolean}
   */
  mustCopyElement(element) {
    return (this.multiple && element.dropZone === undefined);
  }

  /**
   * Check if this element can be dragged to the given drop zone.
   *
   * @param {Number} id
   * @returns {Boolean}
   */
  hasDropZone(id) {
    var self = this;

    for (var i = 0; i < self.dropZones.length; i++) {
      if (parseInt(self.dropZones[i]) === id) {
        return true;
      }
    }

    return false;
  }

  /**
   * Places the draggable element in the given drop zone.
   *
   * @param {number} index Internal element index
   * @param {Object} element
   * @param {number} addToZone Dropzone index
   */
  addToDropZone(index, element, addToZone) {
    var self = this;

    if (self.multiple) {
      // Check that we're the only element here
      for (var i = 0; i < self.elements.length; i++) {
        if (i !== index && self.elements[i] !== undefined && self.elements[i].dropZone === addToZone) {
          // Copy of element already in drop zone

          // Remove current element
          if (self.elements[index].dropZone !== undefined && self.elements[index].dropZone !== addToZone) {
            // Leaving old drop zone!
            self.trigger('leavingDropZone', element);
          }
          element.$.remove();
          delete self.elements[index];
          self.trigger('elementremove', this.element.$[0]);
          return;
        }
      }
    }

    if (element.dropZone !== undefined && element.dropZone !== addToZone) {
      // Leaving old drop zone!
      self.trigger('leavingDropZone', element);
    }
    element.dropZone = addToZone;
    self.updatePlacement(element);

    self.trigger('interacted');
  }

  /**
   * Update the visuals to match the position of the element
   */
  updatePlacement(element) {
    if (element.$suffix) {
      // Always remove old a11y text. (drop zone may have changed)
      element.$suffix.remove();
    }

    if (element.dropZone !== undefined) {
      element.$.addClass('h5p-dropped');

      // Add suffix for good a11y

      // Use dropzone label or dropzone number
      let dropZoneLabel = this.allDropzones[element.dropZone].label;
      if (dropZoneLabel) {
        const labelElement = document.createElement('div');
        labelElement.innerHTML = dropZoneLabel;
        dropZoneLabel = labelElement.innerText;
      }
      else {
        dropZoneLabel = element.dropZone + 1;
      }
      element.$suffix = $('<span class="h5p-hidden-read">' + (this.l10n.suffix.replace('{num}', dropZoneLabel)) + '</span>').appendTo(element.$);
    }
    else {
      element.$
        .removeClass('h5p-dropped')
        .removeClass('h5p-wrong')
        .removeClass('h5p-correct')
        .css({
          border: '',
          background: ''
        });
    }

    element.$[0].setContentOpacity(this.backgroundOpacity);
  }

  /**
   * Resets the position of the draggable to its' original position.
   */
  resetPosition() {
    var self = this;

    this.elements.forEach(function (draggable) {

      if (draggable.$feedback) {
        draggable.$feedback.remove();
        delete draggable.$feedback;
      }

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
            self.trigger('elementremove', element[0]);
          }
        });

        // Reset element style
        self.updatePlacement(draggable);
      }
    });

    if (self.element) {
      // Draggable removed from dropzone.
      if (self.element.dropZone !== undefined) {
        self.trigger('leavingDropZone', self.element);
        delete self.element.dropZone;
      }

      // Reset style on initial element
      // Reset element style
      self.updatePlacement(self.element);
    }
  }

  /**
   * Look for the given DOM element inside this draggable.
   *
   * @param {Element} element
   * @returns {Object}
   */
  findElement(element) {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined && self.elements[i].$.is(element)) {
        return {
          element: self.elements[i],
          index: i
        };
      }
    }
  }

  /**
   * Detemine if any of our elements is in the given drop zone.
   *
   * @param {Number} id
   * @returns {Boolean}
   */
  isInDropZone(id) {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      if (self.elements[i] !== undefined && self.elements[i].dropZone === id) {
        return true;
      }
    }

    return false;
  }

  /**
   * Disables the draggable.
   * @public
   */
  disable() {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      var element = self.elements[i];

      if (element) {
        element.$.draggable('disable');
        self.trigger('elementremove', element.$[0]);
      }
    }
  }

  /**
   * Enables the draggable.
   * @public
   */
  enable() {
    var self = this;

    for (var i = 0; i < self.elements.length; i++) {
      var element = self.elements[i];

      if (element) {
        element.$.draggable('enable');
        self.trigger('elementadd', element.$[0]);
      }
    }
  }

  /**
   * Calculate score for this draggable.
   *
   * @param {boolean} skipVisuals
   * @param {Array} solutions
   * @param {H5P.Question.ScorePoints} scorePoints
   * @returns {number}
   */
  results(skipVisuals, solutions, scorePoints) {
    var self = this;
    var i, j, element, correct, points = 0;
    self.rawPoints = 0;

    if (solutions === undefined) {
      // We should not be anywhere.
      for (i = 0; i < self.elements.length; i++) {
        element = self.elements[i];
        if (element !== undefined && element.dropZone !== undefined) {
          // ... but we are!
          if (skipVisuals !== true) {
            self.markElement(element, 'wrong', scorePoints);
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
            self.markElement(element, 'correct', scorePoints);
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
          self.markElement(element, 'wrong', scorePoints);
        }
        points--;
      }
    }

    return points;
  }

  /**
   * Marks given element as either correct or wrong
   *
   * @param {Object} element
   * @param {string} status 'correct' or 'wrong'
   * @param {H5P.Question.ScorePoints} scorePoints
   */
  markElement(element, status, scorePoints) {
    var $elementResult = $('<span/>', {
      'class': 'h5p-hidden-read',
      html: this.l10n[status + 'Answer'] + '. '
    });
    if (scorePoints) {
      $elementResult = $elementResult.add(scorePoints.getElement(status === 'correct'));
    }
    element.$suffix = element.$suffix.add($elementResult);
    element.$.addClass('h5p-' + status).append($elementResult);
    element.$[0].setContentOpacity(this.backgroundOpacity);
  }

  /**
   * Get currnt size of draggable element.
   * @returns {ClientRect | DOMRect} Current size of draggable element.
   */
  getSize() {
    return this.element.$.get(0).getBoundingClientRect();
  }
}
