var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.DragQuestion'] = (function ($) {
  return {
    1: {
      1: {
        contentUpgrade: function (parameters, finished) {
          // Moved all behavioural settings into "behaviour" group.
          parameters.behaviour = {
            enableRetry: parameters.enableRetry,
            preventResize: parameters.preventResize,
            singlePoint: parameters.singlePoint,
            showSolutionsRequiresInput: parameters.showSolutionsRequiresInput
          };
          delete parameters.enableRetry;
          delete parameters.preventResize;
          delete parameters.singlePoint;
          delete parameters.showSolutionsRequiresInput;

          finished(null, parameters);
        }
      }
    }
  };
})(H5P.jQuery);