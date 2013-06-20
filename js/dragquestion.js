var H5P = H5P || {};

H5P.DragQuestion = function (options, contentId) {

  var target;
  var $ = H5P.jQuery;
  var score = 0;

  if ( !(this instanceof H5P.DragQuestion) ){
    return new H5P.DragQuestion(options, contentId);
  }

  options = $.extend({}, {
    scoreShow: 'Score show',
    correct: 'Solution'
  }, options);

  var cp = H5P.getContentPath(contentId);

  var allAnswered = function() {
    var dropzones = 0;
    var answers = 0;
    target.find('.dropzone').each(function (idx, el) {
      dropzones++;
      if($(el).data('content')) {
        answers++;
      }
    });
    return (dropzones === answers);
  };

  var getMaxScore = function() {
    return target.find('.dropzone').length;
  };

  var getScore = function() {
    if (!$.contains(document.documentElement, target[0])) {
      return score;
    }
    score = 0;
    target.find('.dropzone').each(function (idx, el) {
      var $dropzone = $(el),
        dragIndex = $dropzone.data('content'),
        corrects = $dropzone.data('correctElements');
      if (dragIndex && (corrects.contains('' + (dragIndex - 1)))) {
        score++;
      }
    });
    return score;
  };

  var showSolutions = this.showSolutions = function() {
    var score = 0;
    var count = 0;
    target.find('.dropzone').each(function (idx, el) {
      count++;
      var $dropzone = $(el),
        corrects = $dropzone.data('correctElements');
      var dz = options.question.task.dropZones[idx];
      // If labels are hidden, show them now.
      if (dz.showLabel === undefined || dz.showLabel === false) {
        // Render label
        $dropzone.append('<div class="dragquestion-label">'+$dropzone.data('label')+'</div>');
      }

      // Show correct/wrong style for dropzone.
      var draggableId = $(el).data('content'),
        $currentDraggable = $('.draggable-' + draggableId);
      if ($dropzone.data('content') && corrects.contains('' + (draggableId - 1))) {
        $dropzone.addClass('dropzone-correct-answer').removeClass('dropzone-wrong-answer');
        $currentDraggable.addClass('draggable-correct').removeClass('draggable-wrong');
        score++;
      }
      else {
        $dropzone.addClass('dropzone-wrong-answer').removeClass('dropzone-correct-answer');
        $currentDraggable.addClass('draggable-wrong').removeClass('draggable-correct');
        // Show correct answer below. Only use first listed correct answer.
        if (corrects.length) {
          var text,
          correct = options.question.task.elements[corrects[0]];
          if (correct.type.library.lastIndexOf('H5P.Text', 0) === 0) {
            text = correct.type.params.text;
          } else if (correct.type.library.lastIndexOf('H5P.Image', 0) === 0) {
            text = correct.type.params.alt;
          }
          $dropzone.append('<div class="dropzone-answer">' + options.correct + ': '+text+'</div>');
        }
      }
    });
    //target.find('.score').html(options.scoreText.replace('@score', score).replace('@total', count));
  };

  var attach = function(board) {
    score = 0;
    var $ = H5P.jQuery;
    var dropzones = options.question.task.dropZones;
    var elements = options.question.task.elements;

    target = typeof(board) === "string" ? $("#" + board) : $(board);
    target.addClass('h5p-dragquestion');

    var width = target.width();
    var height = width * (options.question.settings.size.height / options.question.settings.size.width);
    var fontSize = parseInt(target.css('fontSize')) * (width / options.question.settings.size.width);
    var $dragndrop = $('<div class="dragndrop" style="height:' +  height + 'px;font-size:' + fontSize + 'px"></div>');

    if (options.question.settings.title) {
      target.html('<div class="dragndrop-title">' + options.question.settings.title + '</div>');
    }
    target.append($dragndrop);

    function addElement(id, className, el, z) {
      var $el = $('<div class="'+className+'">' + (el.text !== undefined ? el.text : '') + '</div>');
      if (el.type !== undefined) {
        var elementInstance = new (H5P.classFromName(el.type.library.split(' ')[0]))(el.type.params, cp);
        elementInstance.attach($el);
      }
      $dragndrop.append($el);
      if (id !== undefined) {
        $el.data('id', id);
      }
      if (z !== undefined) {
        $el.css({'z-index': z});
      }
      // Store draggable drop zones. Will be used later to check for valid
      // draggables in drop zones..
      if (el.dropZones !== undefined) {
        $el.data('dropzones', el.dropZones);
      }
      // Store drop zone correct answers
      if (el.correctElements !== undefined) {
        $el.data('correctElements', el.correctElements);
      }
      if (el.width !== undefined) {
        $el.css({width: el.width + 'em'});
      }
      if (el.height !== undefined) {
        $el.css({height: el.height + 'em'});
      }
      if(el.x !== undefined) {
        $el.css({left: el.x + '%'});
        $el.data('x', el.x);
      }
      if (el.y !== undefined) {
        $el.css({top: el.y + '%'});
        $el.data('y', el.y);
      }
      // Implicitly, all elements can have a label. Semantically, it's only
      // supported in drop zones.
      if (el.label !== undefined) {
        $el.data('label', el.label);
        if (el.showLabel) {
          $el.append('<div class="dragquestion-label">'+el.label+'</div>');
        }
      }
      return $el;
    }

    var buttons = Array();

    if($('.qs-footer').length) {
    }
    else {
      // Add show score button when not boardgame
      var buttons = Array( { text: options.scoreShow, click: showSolutions, className: 'button show-score' });
    }


    // Add buttons
    for (var i = 0; i < buttons.length; i++) {
      var $button = addElement('lol', buttons[i].className, buttons[i], 1);
      $button.click(buttons[i].click);
    }

    // Add drop zones
    for (var i = 0; i < dropzones.length; i++) {
      addElement((i + 1), 'dropzone dropzone-' + (i + 1), dropzones[i], 1);
    }

    // Add elements (static and draggable)
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      // Add element as draggable if it has any defined drop zones, or static
      // if not.
      if (el.dropZones !== undefined && el.dropZones.length !== 0) {
        addElement((i + 1), 'draggable draggable-' + (i + 1), el, 2);
      }
      else {
        addElement((i + 1), 'static content-' + (i + 1), el, 0);
      }
    }

    // Restore user answers
    if (options.userAnswers !== undefined) {
      for (var dropzoneId in options.userAnswers) {
        var draggableId = options.userAnswers[dropzoneId];
        var $draggable = target.find('.draggable-' + draggableId);
        var $dropzone = target.find('.dropzone-' + dropzoneId);

        // Set attributes
        $dropzone.data('content', draggableId);
        $draggable.data('content', dropzoneId).css('z-index', '1');

        // Move drag to center of drop
        // Since we're using percent we need to account for css problems with margins and paddings...
        var cssErrorRate = $draggable.parent().parent().width() / $draggable.parent().width();
        $draggable.css({
          top: Math.round(($dropzone.outerHeight() - $draggable.outerHeight()) / 2) + parseInt($dropzone.css('top'), 10),
          left: Math.round(($dropzone.outerWidth() - $draggable.outerWidth()) / 2) + parseInt($dropzone.css('left'), 10) * cssErrorRate
        });
      }
    }

    // Make dropzones
    target.find('.dropzone').each(function (idx, el) {
      $(el).droppable({
        activeClass: 'dropzone-active',
        fit: 'intersect',
        accept: function (draggable) {
          var dropZones = $(draggable).data('dropzones');
          var id = $(el).data('id') - 1;

          for (var i = 0; i < dropZones.length; i++) {
            if (parseInt(dropZones[i]) === id) {
              return true;
            }
          }

          return false;
        },
        out: function(event, ui) {
          // TODO: somthing
        },
        drop: function(event, ui) {
          $(this).removeClass('dropzone-wrong-answer');

          // If this drag was in a drop area and this drag is not the same
          if($(this).data('content') && ui.draggable.data('id') !== $(this).data('content')) {
            // Remove underlaying drag (move to initial position)
            var id = $(this).data('content');
            var $currentDraggable = target.find('.draggable-' + id);
            $currentDraggable.data('content', null)
            .animate({
              left: $currentDraggable.data('x') + '%',
              top:  $currentDraggable.data('y') + '%'
            });
          }

//          // Was object in another drop?
//          if(ui.draggable.data('content')) {
//            // Remove object from previous drop
//            $('.'+ui.draggable.data('content')) = null;
//          }

          // Set attributes
          $(this).data('content', ui.draggable.data('id'));
          ui.draggable.data('content', $(this).data('id'));
          ui.draggable.css('z-index', '1');

          // Move drag to center of drop
          ui.draggable.animate({
            top: Math.round(($(this).outerHeight() - ui.draggable.outerHeight()) / 2) + parseInt($(this).css('top')),
            left: Math.round(($(this).outerWidth() - ui.draggable.outerWidth()) / 2) + parseInt($(this).css('left'))
          });

          // Store this answer
          if (options.userAnswers === undefined) {
            options.userAnswers = {};
          }
          options.userAnswers[$(this).data('id')] = ui.draggable.data('id');

          if(allAnswered()){
            $(returnObject).trigger('h5pQuestionAnswered');
          }
          // Store the new score
          getScore();
        }
      });
    });

    // Make draggables
    target.find('.draggable').each(function (idx, el) {
      $(el).draggable({
        revert: 'invalid',
        start: function(event, ui) {
          ui.helper.css('z-index', '2');
        },
        stop: function(event, ui) {
          // Todo something
        }
      });
    });

    return this;
  };

  var returnObject = {
    attach: attach,
    machineName: 'H5P.DragQuestion',
    getScore: function() {
      return getScore();
    },
    getAnswerGiven: function() {
      return allAnswered();
    },
    getMaxScore: function() {
      return getMaxScore();
    },
    showSolutions: showSolutions
  };

  return returnObject;
};
