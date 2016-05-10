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
      4: {
        contentUpgrade: function (parameters, finished) {
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
        }
      },
      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support DQ 1.6.
       *
       * Makes width and height be the same as in 1.5
       *
       * @params {Object} parameters
       * @params {function} finished
       */
      6: {
        contentUpgrade: function (parameters, finished) {
          if (parameters.question !== undefined && parameters.question.task !== undefined && parameters.question.task.elements !== undefined) {
            var elements = parameters.question.task.elements;

            // Go through elements
            for (var i = 0; i < elements.length; i++) {
              var element = elements[i];

              // The magic number 0.8 is the vertical/horizontal padding + border
              // in ems (0.1 + 0.3 + 0.3 + 0.1)
              if (element) {
                if (element.width) {
                  element.width += 0.8;
                }
                if (element.height) {
                  element.height += 0.8;
                }
              }
            }
          }
          finished(null, parameters);
        }
      }
    }
  };
})(H5P.jQuery);
