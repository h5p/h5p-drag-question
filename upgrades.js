var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.DragQuestion'] = (function ($) {
  return {
    1: {
      1: {
        contentUpgrade: function (parameters, finished) {
          // Moved all behavioural settings into "behaviour" group.
          parameters.behaviour = {
            enableRetry: parameters.enableTryAgain === undefined ? true : parameters.enableTryAgain,
            preventResize: parameters.preventResize === undefined ? true : parameters.preventResize,
            singlePoint: parameters.singlePoint === undefined ? true : parameters.singlePoint,
            showSolutionsRequiresInput: parameters.showSolutionsRequiresInput === undefined ? true : parameters.showSolutionsRequiresInput
          };
          delete parameters.enableTryAgain;
          delete parameters.preventResize;
          delete parameters.singlePoint;
          delete parameters.showSolutionsRequiresInput;

          finished(null, parameters);
        }
      },
      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support DQ 1.4.
       *
       * Converts H5P.Text elements into H5P.AdvancedText. This is to support
       * more styling options for text.
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      4: function (parameters, finished) {
        if (parameters.question !== undefined && parameters.question.task !== undefined && parameters.question.task.elements !== undefined) {
          var elements = parameters.question.task.elements;

          // Go through elements
          for (var i = 0; i < elements.length; i++) {
            var element = elements[i];

            // Check if element type is text
            if (element && element.type && element.type.library &&
                element.type.library.split(' ')[0] === 'H5P.Text') {
              element.type.library = 'H5P.AdvancedText 1.0';
            }
          }
        }
        finished(null, parameters);
      },
      /**
       * For dropzones:
       * Moving tip from a single element group to a group consisting of tip + feedback
       */
      11: function (parameters, finished) {
        if (parameters.question !== undefined &&
            parameters.question.task !== undefined &&
            parameters.question.task.dropZones !== undefined ) {

          var dropZones = parameters.question.task.dropZones;
          for (var i = 0; i < dropZones.length; i++) {
            var dropZone = dropZones[i];
            var tip = (dropZone !== undefined && dropZone.tip !== undefined && typeof dropZone.tip === 'string') ? dropZone.tip : '';

            // Create the new group-structure
            delete dropZone.tip;
            dropZone.tipsAndFeedback = {
              tip: tip,
              feedbackOnCorrect: '',
              feedbackOnIncorrect: ''
            }

          }
        }

        finished(null, parameters);
      }
    }
  };
})(H5P.jQuery);
