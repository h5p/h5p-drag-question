
export default class DragUtils {

  /**
   * Makes element background transparent.
   *
   * @param {jQuery} $element
   * @param {Number} opacity
   */
  static setElementOpacity($element, opacity) {
    DragUtils.setOpacity($element, 'borderColor', opacity);
    DragUtils.setOpacity($element, 'boxShadow', opacity);
    DragUtils.setOpacity($element, 'background', opacity);
  }

  /**
   * Makes element background, border and shadow transparent.
   *
   * @param {jQuery} $element
   * @param {String} property
   * @param {Number} opacity
   */
  static setOpacity($element, property, opacity) {
    if (property === 'background') {
      // Set both color and gradient.
      DragUtils.setOpacity($element, 'backgroundColor', opacity);
      DragUtils.setOpacity($element, 'backgroundImage', opacity);
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

    style = DragUtils.setAlphas(style, 'rgba(', opacity); // Update rgba
    style = DragUtils.setAlphas(style, 'rgb(', opacity); // Convert rgb

    $element.css(getProperties(property, style));
  }

  /**
   * Updates alpha channel for colors in the given style.
   *
   * @param {String} style
   * @param {String} prefix
   * @param {Number} alpha
   */
  static setAlphas(style, prefix, alpha) {
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
  }

  /**
   * Find draggable instance from element
   *
   * @private
   * @param {Draggable[]} draggables
   * @param {Element} element
   */
  static elementToDraggable(draggables, element) {
    for (var i = 0; i < draggables.length; i++) {
      if (!draggables[i]) {
        continue;
      }
      var result = draggables[i].findElement(element);
      if (result) {
        result.draggable = draggables[i];
        return result;
      }
    }
  }

  /**
   * Find draggable instance from element
   *
   * @private
   * @param {DropZone[]} dropZones
   * @param {Element} element
   */
  static elementToDropZone(dropZones, element) {
    for (var i = 0; i < dropZones.length; i++) {
      if (dropZones[i].$dropZone.is(element)) {
        return dropZones[i];
      }
    }
  }

  /**
   * Get css position in percentage.
   *
   * @param {jQuery} $container
   * @param {jQuery} $element
   * @returns {Object} CSS position
   */
  static positionToPercentage($container, $element) {
    return {
      top: (parseInt($element.css('top')) * 100 / $container.innerHeight()) + '%',
      left: (parseInt($element.css('left')) * 100 / $container.innerWidth()) + '%'
    };
  }

  /**
   * Makes sure element gets correct opacity when hovered.
   *
   * @param {jQuery} $element
   * @param {Object} element
   */
  static addHover($element, backgroundOpacity) {
    $element.hover(function () {
      $element.addClass('h5p-draggable-hover');
      if (!$element.parent().hasClass('h5p-dragging')) {
        DragUtils.setElementOpacity($element, backgroundOpacity);
      }
    }, function () {
      if (!$element.parent().hasClass('h5p-dragging')) {
        setTimeout(function () {
          $element.removeClass('h5p-draggable-hover');
          DragUtils.setElementOpacity($element, backgroundOpacity);
        }, 1);
      }
    });
    DragUtils.setElementOpacity($element, backgroundOpacity);
  }

  /**
   * Stripping away html tags
   *
   * @param {string} html
   * @return {string}
   */
  static strip(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
}
