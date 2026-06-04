import DragUtils from './drag-utils';

const $ = H5P.jQuery;

export default class DropZone {
  /**
   * Creates a new drop zone instance.
   * Makes it easy to keep track of all instance variables.
   *
   * @param {Object} dropZone
   * @param {Number} id
   * @param {string[]} l10n
   * @returns {_L8.DropZone}
   */
  constructor(dropZone, id, l10n) {
    const self = this;
    H5P.EventDispatcher.call(self);

    const behaviour = dropZone.behaviour ?? {};

    self.id = id;
    self.showLabel = dropZone.showLabel;
    self.label = dropZone.label;
    self.x = dropZone.x;
    self.y = dropZone.y;
    self.width = dropZone.width;
    self.height = dropZone.height;
    self.backgroundOpacity = dropZone.backgroundOpacity;
    self.tip = dropZone.tipsAndFeedback.tip || '';
    self.single = dropZone.single;
    self.autoAlignable = dropZone.autoAlign;
    self.useBackgroundHover = behaviour.dropZoneHighlighting === 'always'
      || behaviour.dropZoneHighlighting === 'dragging';
    self.alignables = [];
    self.l10n = l10n;
  }

  /**
   * Insert drop zone in the given container.
   *
   * @param {jQuery} $container
   * @param {Array} draggables
   * @returns {undefined}
   */
  appendTo($container, draggables) {
    const self = this;
    const droppableElement = H5P.Components.Dropzone({
      variant: 'area',
      containerClasses: self.showLabel ? 'h5p-has-label' : '',
      classes: 'h5p-inner',
      tolerance: 'intersect',
      role: 'button',
      backgroundOpacity: this.backgroundOpacity,
      ariaDisabled: true,
      ariaLabel: self.showLabel
        ? undefined
        : `${self.l10n.prefix.replace('{num}', self.id + 1)} ${DragUtils.strip(self.label)}`,
      areaLabel: self.showLabel ? self.label : undefined,
      handleAcceptEvent: (element) => {
        /**
           * Functional note:
           * This will fire every time a draggable is starting to get dragged, globally
           * for all initialized drop zones  <-> draggables. That means in a compound H5P this
           * function will fire for all Drag Questions within that compound content type,
           * no matter if it is at a different timestamp, already completed or otherwise
           * intuitively would be disabled. This can lead to some unexpected behaviour if you
           * don't take this into consideration.
           */

        // Find draggable element belongs to
        const result = DragUtils.elementToDraggable(draggables, element);

        // Found no Draggable that the element belongs to. Don't accept it.
        if (!result) {
          return false;
        }

        // Figure out if the drop zone will accept the draggable
        return this.accepts(result.draggable, draggables);
      },
      handleDropEvent: (draggable) => {
        const $this = this.$dropZone;
        DragUtils.setOpacity($this.children('.h5p-inner').removeClass('h5p-over'), 'background', this.backgroundOpacity);
        draggable.dataset.addToZone = this.id;

        const $draggable = H5P.jQuery(draggable);

        if (this.getIndexOf($draggable) === -1) {
          // Add to alignables
          this.alignables.push($draggable);
        }

        if (this.autoAlignable.enabled) {
          // Trigger alignment
          this.autoAlign();
        }
      },
      handleDropOverEvent: () => {
        if (this.useBackgroundHover) {
          DragUtils.setOpacity(this.$dropZone.children('.h5p-inner').addClass('h5p-over'), 'background', this.backgroundOpacity);
        }
      },
      handleDropOutEvent: () => {
        if (this.useBackgroundHover) {
          DragUtils.setOpacity(this.$dropZone.children('.h5p-inner').removeClass('h5p-over'), 'background', this.backgroundOpacity);
        }
      },
    });

    self.$dropZone = $(droppableElement)
      .css({
        left: `${self.x}%`,
        top: `${self.y}%`,
        width: `${self.width}em`,
        height: `${self.height}em`,
      })
      .appendTo($container)
      .focus(() => {
        if ($tip instanceof H5P.jQuery) {
          $tip.attr('tabindex', '0');
        }
      })
      .blur(() => {
        if ($tip instanceof H5P.jQuery) {
          $tip.attr('tabindex', '-1');
        }
      });

    // Add tip after setOpacity(), so this does not get background opacity:
    var $tip = H5P.JoubelUI.createTip(self.tip, {
      tipLabel: self.l10n.tipLabel,
      tabcontrol: true,
    });
    if ($tip instanceof H5P.jQuery) {
      // Create wrapper for tip
      $('<span/>', {
        class: 'h5p-dq-tipwrap',
        'aria-label': self.l10n.tipAvailable,
        append: $tip,
        appendTo: self.$dropZone,
      });
    }

    draggables.forEach((draggable) => {
      const dragEl = draggable.element.$;

      // Add to alignables
      if (draggable.isInDropZone(self.id) && self.getIndexOf(dragEl) === -1) {
        self.alignables.push(dragEl);
      }
    });
    if (self.autoAlignable.enabled) {
      self.autoAlign();
    }

    // Set element opacity when element has been appended
    setTimeout(() => {
      self.updateBackgroundOpacity();
    }, 0);
  }

  /**
   * Update the background opacity
   */
  updateBackgroundOpacity() {
    DragUtils.setOpacity(this.$dropZone.children('.h5p-dropzone_label'), 'background', this.backgroundOpacity);
    DragUtils.setOpacity(this.$dropZone.children('.h5p-inner'), 'background', this.backgroundOpacity);
  }

  /**
   * Help determine if the drop zone can accept this draggable
   */
  accepts(draggable, draggables) {
    const self = this;
    if (!draggable.hasDropZone(self.id)) {
      // Doesn't belong in this drop zone
      return false;
    }

    if (self.single) {
      // Make sure no other draggable is placed here
      for (let i = 0; i < draggables.length; i++) {
        if (draggables[i] && draggables[i].isInDropZone(self.id)) {
          // This drop zone is occupied
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Find index of given alignable
   *
   * @param {jQuery} $alignable
   * @return {number}
   */
  getIndexOf($alignable) {
    const self = this;

    for (let i = 0; i < self.alignables.length; i++) {
      if (self.alignables[i][0] === $alignable[0]) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Remove alignable
   *
   * @param {jQuery} $alignable
   */
  removeAlignable($alignable) {
    const self = this;

    // Find alignable index
    const index = self.getIndexOf($alignable);
    if (index !== -1) {
      // Remove alignable
      self.alignables.splice(index, 1);

      if (self.autoAlignTimer === undefined && self.autoAlignable.enabled) {
        // Schedule re-aligment of alignables left
        self.autoAlignTimer = setTimeout(() => {
          delete self.autoAlignTimer;
          self.autoAlign();
        }, 1);
      }
    }
  }

  /**
   * Auto-align alignable elements inside drop zone.
   */
  autoAlign() {
    const self = this;

    // Determine container size in order to calculate percetages
    const containerSize = self.$dropZone.parent()[0].getBoundingClientRect();

    // Calcuate borders and spacing values in percetage
    const spacing = {
      x: (self.autoAlignable.spacing / self.autoAlignable.size.width) * 100,
      y: (self.autoAlignable.spacing / self.autoAlignable.size.height) * 100,
    };

    // Determine coordinates for first 'spot'
    const pos = {
      x: self.x + spacing.x,
      y: self.y + spacing.y,
    };

    // Determine space inside drop zone
    const dropZoneSize = self.$dropZone[0].getBoundingClientRect();
    const space = {
      x: dropZoneSize.width - spacing.x * 2,
      y: dropZoneSize.height - spacing.y * 2,
    };

    // Set current space left inside drop zone
    const spaceLeft = {
      x: space.x,
      y: space.y,
    };

    // Set height for the active row of elements
    let currentRowHeight = 0;

    // Current alignable element and it's size
    let $alignable; let
      alignableSize;

    /**
     * Helper doing the actual positioning of the element + recalculating
     * next position and space left.
     *
     * @private
     */
    const alignElement = function () {
      // Position element at current spot
      $alignable.css({
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      });
      self.trigger('elementaligned', $alignable);

      // Update horizontal space left + next position
      const spaceDiffX = alignableSize.width + self.autoAlignable.spacing;
      spaceLeft.x -= spaceDiffX;
      pos.x += (spaceDiffX / containerSize.width) * 100;

      // Keep track of the highest element in this row
      const spaceDiffY = alignableSize.height + self.autoAlignable.spacing;
      if (spaceDiffY > currentRowHeight) {
        currentRowHeight = spaceDiffY;
      }
    };

    // Try to order and align the alignables inside the drop zone
    // (in the order they were added)
    for (let i = 0; i < self.alignables.length; i++) {
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
  }

  /**
   * Highlight the current drop zone
   */
  highlight() {
    this.$dropZone
      .attr('aria-disabled', 'false')
      .children('.h5p-inner')
      .addClass('h5p-dropzone--active');
  }

  /**
   * De-highlight the current drop zone
   */
  dehighlight() {
    this.$dropZone
      .attr('aria-disabled', 'true')
      .children('.h5p-inner')
      .removeClass('h5p-dropzone--active');
    this.$dropZone.attr('tabindex', '-1');
  }

  /**
   * Invoked when reset task is run. Cleanup any internal states.
   */
  reset() {
    // Remove alignables
    this.alignables = [];
    DragUtils.setOpacity(this.$dropZone.children('.h5p-inner').removeClass('h5p-over'), 'background', this.backgroundOpacity);
  }
}
