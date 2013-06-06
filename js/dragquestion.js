var H5P = H5P || {};

H5P.DragQuestion = function (options, contentId) {

  var target;
  var $ = H5P.jQuery;
  var score = 0;

  if ( !(this instanceof H5P.DragQuestion) ){
    return new H5P.DragQuestion(options, contentId);
  }

  var cp = H5P.getContentPath(contentId);

  var allAnswered = function() {
    var droppables = 0;
    var answers = 0;
    target.find('.droppable').each(function (idx, el) {
      droppables++;
      if($(el).data('content')) {
        answers++;
      }
    });
    return (droppables === answers);
  };

  var getMaxScore = function() {
    return target.find('.droppable').length;
  };

  var getScore = function() {
    if (!$.contains(document.documentElement, target[0])) {
      return score;
    }
    score = 0;
    target.find('.droppable').each(function (idx, el) {
      var $droppable = $(el);
      if($droppable.data('content')) {
        var index = $droppable.data('content');
        var target = options.draggables[index - 1].target;
        if(target === $droppable.data('id')) {
          score++;
        }
      }
    });
    return score;
  };

  var showSolutions = function() {
    var score = 0;
    var count = 0;
    target.find('.droppable').each(function (idx, el) {
      count++;
      var $droppable = $(el);
      if ($droppable.data('content')) {
        var draggableId = $(el).data('content');
        var target = options.draggables[draggableId - 1].target;
        if (target === $droppable.data('id')) {
          $droppable.addClass('droppable-correct-answer').removeClass('droppable-wrong-answer');
          score++;
        }
        else {
          $droppable.addClass('droppable-wrong-answer').removeClass('droppable-correct-answer');
        }
      }
    });
    //target.find('.score').html(options.scoreText.replace('@score', score).replace('@total', count));
  };

  var attach = function(board) {
    score = 0;
    var $ = H5P.jQuery;
    var droppables = options.droppables;
    var draggables = options.draggables;
    var $dragndrop = $('<div class="dragndrop"></div>');

    target = typeof(board) === "string" ? $("#" + board) : $(board);

    if (options.title) {
      target.html('<div class="dragndrop-title">' + options.title + '</div>');
    }
    target.append($dragndrop);

    function addElement(id, className, el, z) {
      var $el = $('<div class="'+className+'">' + (el.text !== undefined ? el.text : '') + '</div>');
      if (el.content) {
        var elementInstance = new (H5P.classFromName(el.content.library.split(' ')[0]))(el.content.params, cp);
        elementInstance.attach($el);
      }
      $dragndrop.append($el);
      if (id !== undefined) {
        $el.data('id', id);
      }
      if (z !== undefined) {
        $el.css({'z-index': z});
      }
      if (el.scope !== undefined) {
        $el.data('scope', el.scope);
      }
      if (el.width !== undefined) {
        $el.css({width: el.width + '%'});
      }
      if (el.height !== undefined) {
        $el.css({height: el.height + '%'});
      }
      if(el.x !== undefined) {
        $el.css({left: el.x + '%'});
        $el.data('x', el.x);
      }
      if (el.y !== undefined) {
        $el.css({top: el.y + '%'});
        $el.data('y', el.y);
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

    // Add content
    for (var i = 0; i < options.staticContent.length; i++) {
      addElement((i + 1), 'static content-' + (i + 1), options.staticContent[i], 0);
    }

    // Add droppables
    for (var i = 0; i < droppables.length; i++) {
      addElement((i + 1), 'droppable droppable-' + (i + 1) + ' ' + droppables[i].className, droppables[i], 1);
    }

    // Add draggables
    for (var i = 0; i < draggables.length; i++) {
      addElement((i + 1), 'draggable draggable-' + (i + 1) + ' ' +draggables[i].className, draggables[i], 2);
    }

    // Restore user answers
    if (options.userAnswers !== undefined) {
      for (var droppableId in options.userAnswers) {
        var draggableId = options.userAnswers[droppableId];
        var $draggable = target.find('.draggable-' + draggableId);
        var $droppable = target.find('.droppable-' + droppableId);

        // Set attributes
        $droppable.data('content', draggableId);
        $draggable.data('content', droppableId).css('z-index', '1');

        // Move drag to center of drop
        // Since we're using percent we need to account for css problems with margins and paddings...
        var cssErrorRate = $draggable.parent().parent().width() / $draggable.parent().width();
        $draggable.css({
          top: Math.round(($droppable.outerHeight() - $draggable.outerHeight()) / 2) + parseInt($droppable.css('top'), 10),
          left: Math.round(($droppable.outerWidth() - $draggable.outerWidth()) / 2) + parseInt($droppable.css('left'), 10) * cssErrorRate
        });
      }
    }

    // Make droppables
    target.find('.droppable').each(function (idx, el) {
      $(el).droppable({
        scope: $(el).data('scope'),
        activeClass: 'droppable-active',
        fit: 'intersect',
        out: function(event, ui) {
          // TODO: somthing
        },
        drop: function(event, ui) {
          $(this).removeClass('droppable-wrong-answer');

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
        scope: $(el).data('scope'),
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
