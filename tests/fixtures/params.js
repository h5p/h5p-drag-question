'use strict';

/**
 * Fixture accessors for DragQuestion unit specs.
 *
 * There is no upstream sample `.h5p` package for DragQuestion in this workspace (same
 * situation as MultiChoice — see `docs/06-gotchas-and-field-notes.md`), so `content/*.json`
 * are hand-authored, complete param shapes matching the current `semantics.json`.
 * `versions/*.json` are frozen pre-migration snapshots — one per exercised `upgrades.js`
 * step — and must never be edited once a test binds to them; add a new file for a new
 * version instead.
 */

const twoZones = require('./content/two-zones.json');
const singlePoint = require('./content/single-point.json');
const version1_1 = require('./versions/1_1.json');
const version1_4 = require('./versions/1_4.json');
const version1_11 = require('./versions/1_11.json');
const version1_13 = require('./versions/1_13.json');
const version1_14 = require('./versions/1_14.json');

/** Deep clone so specs can mutate a fixture without leaking into other tests. */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Minimal, declarative content for a single behaviour under test (presave shape:
 * top-level `question`/`behaviour`, no `contentId`/`contentData` wrapper).
 * @param {object} [overrides]
 */
function makeContent(overrides) {
  return Object.assign({
    question: {
      task: {
        elements: [
          { type: { library: 'H5P.AdvancedText 1.1', params: {} }, x: 0, y: 0, width: 10, height: 5, dropZones: ['0'] },
          { type: { library: 'H5P.AdvancedText 1.1', params: {} }, x: 20, y: 0, width: 10, height: 5, dropZones: ['1'] }
        ],
        dropZones: [
          { label: 'Zone 1', x: 0, y: 20, width: 10, height: 5, correctElements: ['0'], tipsAndFeedback: { tip: '' } },
          { label: 'Zone 2', x: 20, y: 20, width: 10, height: 5, correctElements: [], tipsAndFeedback: { tip: '' } }
        ]
      }
    },
    behaviour: {}
  }, overrides || {});
}

module.exports = {
  clone,
  makeContent,

  // Real, complete content fixtures.
  content: {
    twoZones: function () { return clone(twoZones); },
    singlePoint: function () { return clone(singlePoint); }
  },

  // Frozen per-version inputs for the upgrade scripts. Never mutate the source files;
  // clone() protects specs from cross-test leakage.
  versions: {
    v1_1: function () { return clone(version1_1); },
    v1_4: function () { return clone(version1_4); },
    v1_11: function () { return clone(version1_11); },
    v1_13: function () { return clone(version1_13); },
    v1_14: function () { return clone(version1_14); }
  },

  /**
   * Canonical fixtures referenced by durable invariant/contract expectations in
   * behavior_spec.md. Named so every test tier can bind to identical data.
   */
  canonical: {
    oneOfTwoCorrect: function () {
      return makeContent();
    },
    noneCorrect: function () {
      return makeContent({
        question: {
          task: {
            elements: [
              { type: { library: 'H5P.AdvancedText 1.1', params: {} }, x: 0, y: 0, width: 10, height: 5, dropZones: ['0'] }
            ],
            dropZones: [
              { label: 'Zone 1', x: 0, y: 20, width: 10, height: 5, correctElements: [], tipsAndFeedback: { tip: '' } }
            ]
          }
        }
      });
    },
    multipleElement: function () {
      return makeContent({
        question: {
          task: {
            elements: [
              { type: { library: 'H5P.AdvancedText 1.1', params: {} }, x: 0, y: 0, width: 10, height: 5, dropZones: ['0', '1'], multiple: true }
            ],
            dropZones: [
              { label: 'Zone 1', x: 0, y: 20, width: 10, height: 5, correctElements: ['0'], tipsAndFeedback: { tip: '' } },
              { label: 'Zone 2', x: 20, y: 20, width: 10, height: 5, correctElements: ['0'], tipsAndFeedback: { tip: '' } }
            ]
          }
        }
      });
    },
    singlePoint: function () {
      return makeContent({ behaviour: { singlePoint: true } });
    }
  }
};




