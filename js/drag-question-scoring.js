/**
 * Pure scoring helpers for H5P.DragQuestion.
 *
 * Extracted so this logic is unit-testable without the H5P runtime (no jQuery/DOM,
 * no H5P.Components/H5P.JoubelUI). The main content type (`h5p-drag-question.js`) keeps
 * its own inline implementation (trapped inside the minified `Draggable.results` /
 * `showAllSolutions` / `calculateMaxScore` closures) for now — this module is purely
 * additive (assigns onto the existing `H5P.DragQuestion` namespace) and introduces no new
 * required load order, so H5P's concat/dependency model is unaffected. It durably
 * documents (and lets us pin, via tests) the scoring rules that would otherwise only be
 * reachable through full drag-and-drop DOM interaction.
 *
 * Mirrors the pattern already used by H5P.TrueFalse's `h5p-true-false-scoring.js` and
 * H5P.MultiChoice's `js/multichoice-scoring.js`.
 */
var H5P = H5P || {};
H5P.DragQuestion = H5P.DragQuestion || {};

H5P.DragQuestion.scoring = (function () {
  'use strict';

  /**
   * Build the `correctDZs` map the runtime computes in its constructor:
   * `correctDZs[elementIndex]` is the (possibly empty) list of drop zone indices that
   * count as correct placements for that element.
   *
   * @param {Array<{correctElements: string[]}>} dropZones semantics `question.task.dropZones`
   * @return {Array<number[]|undefined>} indexed by element/draggable index
   */
  function buildCorrectDropZoneMap(dropZones) {
    var correctDZs = [];
    (dropZones || []).forEach(function (dropZone, dzIndex) {
      (dropZone.correctElements || []).forEach(function (elementId) {
        var id = parseInt(elementId, 10);
        if (!Array.isArray(correctDZs[id])) {
          correctDZs[id] = [];
        }
        correctDZs[id].push(dzIndex);
      });
    });
    return correctDZs;
  }

  /**
   * Whether an unanswered/blank submission is itself the correct answer — true when
   * NONE of the drop zones has any correct element configured (mirrors the runtime's
   * `blankIsCorrect`, which starts `true` and flips to `false` on the first drop zone
   * with `correctElements.length`).
   *
   * @param {Array<{correctElements: string[]}>} dropZones
   * @return {boolean}
   */
  function isBlankCorrect(dropZones) {
    return !(dropZones || []).some(function (dropZone) {
      return dropZone.correctElements && dropZone.correctElements.length;
    });
  }

  /**
   * The maximum achievable score (mirrors the runtime's `calculateMaxScore`): 1 when a
   * blank submission is correct, else — for every element that has at least one correct
   * drop zone — 1 point (or, for a `multiple` element, one point per correct drop zone).
   *
   * @param {Array<{multiple?: boolean}>} elements semantics `question.task.elements`
   * @param {Array<number[]|undefined>} correctDZs from `buildCorrectDropZoneMap`
   * @param {boolean} blankIsCorrect from `isBlankCorrect`
   * @return {number}
   */
  function calculateMaxScore(elements, correctDZs, blankIsCorrect) {
    if (blankIsCorrect) {
      return 1;
    }
    var maxScore = 0;
    (elements || []).forEach(function (element, index) {
      var correct = correctDZs[index];
      if (correct !== undefined && correct.length) {
        maxScore += element.multiple ? correct.length : 1;
      }
    });
    return maxScore;
  }

  /**
   * Score a set of current placements (mirrors `Draggable.results` + the
   * `showAllSolutions` aggregation loop), WITHOUT any DOM marking.
   *
   * @param {Array<{multiple?: boolean}>} elements semantics `question.task.elements`
   * @param {Array<number[]|undefined>} correctDZs from `buildCorrectDropZoneMap`
   * @param {Array<number[]|undefined>} placements indexed like `elements`; each entry is
   *        the list of drop zone indices the element is CURRENTLY placed in (empty/absent
   *        when not placed). A `multiple` element may have several placements.
   * @param {object} [opts]
   * @param {boolean} [opts.answered=false] whether the user interacted at all
   * @param {boolean} [opts.blankIsCorrect] defaults to `isBlankCorrect` behaviour being
   *        pre-computed by the caller and passed in; required.
   * @param {boolean} [opts.singlePoint=false] collapse to all-or-nothing
   * @param {boolean} [opts.applyPenalties=true] `getScore` uses penalised `points` when
   *        true (or when `singlePoint`), else the un-penalised `rawPoints`.
   * @return {{points: number, rawPoints: number}}
   */
  function scorePlacements(elements, correctDZs, placements, opts) {
    opts = opts || {};
    var blankIsCorrect = !!opts.blankIsCorrect;
    var answered = !!opts.answered;
    var singlePoint = !!opts.singlePoint;

    var points = blankIsCorrect ? 1 : 0;
    var rawPoints = blankIsCorrect ? 1 : 0;

    (elements || []).forEach(function (element, index) {
      var correct = correctDZs[index];
      var placed = (placements && placements[index]) || [];

      placed.forEach(function (dz) {
        if (correct !== undefined && correct.indexOf(dz) !== -1) {
          points++;
          rawPoints++;
        }
        else {
          points--;
        }
      });
    });

    if (points < 0) {
      points = 0;
    }

    if (!answered && blankIsCorrect) {
      points = 1; // weight is always 1 for DragQuestion
    }

    if (singlePoint) {
      points = (points === calculateMaxScore(elements, correctDZs, blankIsCorrect)) ? 1 : 0;
    }

    return { points: points, rawPoints: rawPoints };
  }

  /**
   * The value the runtime's `getScore()` returns: penalised `points` when
   * `applyPenalties` or `singlePoint`, else the un-penalised `rawPoints`.
   *
   * @param {{points: number, rawPoints: number}} scored from `scorePlacements`
   * @param {boolean} applyPenalties
   * @param {boolean} singlePoint
   * @return {number}
   */
  function getScore(scored, applyPenalties, singlePoint) {
    return (applyPenalties || singlePoint) ? scored.points : scored.rawPoints;
  }

  return {
    buildCorrectDropZoneMap: buildCorrectDropZoneMap,
    isBlankCorrect: isBlankCorrect,
    calculateMaxScore: calculateMaxScore,
    scorePlacements: scorePlacements,
    getScore: getScore
  };
})();

