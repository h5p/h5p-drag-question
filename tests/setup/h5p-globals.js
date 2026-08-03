'use strict';

/**
 * DragQuestion Tier-2 test setup.
 *
 * The generic ~80% of this harness lives in the shared `h5p-js-testing-shared` package
 * and is consumed from its root export (jsdom registration, real-jQuery wiring,
 * `resetGlobals()` namespace scaffold, `loadScript()`, and the generic
 * `EventDispatcher`/`Presave` mocks). See `libraries/h5p-js-testing-shared/AGENTS.md`.
 *
 * What stays here is ONLY DragQuestion's own collaborator stubs layered on top of the
 * shared core. DragQuestion has the widest global surface of any content type ported so
 * far — enumerated from what `h5p-drag-question.js` actually reads (see field notes in
 * `libraries/h5p-js-testing-shared/docs/06-gotchas-and-field-notes.md`):
 *
 *  - `H5P.jQuery` / `H5P.EventDispatcher` — read at SCRIPT-LOAD time (not just
 *    construction): the bundle assigns `var K = H5P.jQuery` (etc.) and sets up its
 *    internal `Draggable` class's prototype chain against `H5P.EventDispatcher`
 *    while the IIFE evaluates. Both are provided by the shared harness's
 *    `resetGlobals()` already — nothing extra needed here.
 *  - `H5P.Question` — also read at SCRIPT-LOAD time: `re.prototype =
 *    Object.create(H5P.Question.prototype)` runs as soon as the file is evaluated, so
 *    `H5P.Question` must exist BEFORE `loadScript('h5p-drag-question.js')`, not just
 *    before `new H5P.DragQuestion(...)`. Stubbed here the same way MultiChoice does
 *    (instance methods + the two STATIC members
 *    `H5P.Question.determineOverallFeedback` / `H5P.Question.ScorePoints` that
 *    DragQuestion also reads directly off the constructor).
 *  - `H5P.JoubelUI.createTip` — only reached from `DropZone.appendTo` (i.e. only when
 *    `registerDomElements()`/`createQuestionContent()` actually renders); NOT needed for
 *    construction-time-only specs (getMaxScore/getScore/getCurrentState/etc.).
 *  - `H5P.Components.Dropzone` / `H5P.Components.Draggable` — the runtime UI-component
 *    factories DragQuestion uses to build its drop-zone/draggable DOM. Same
 *    render-time-only story as `H5P.JoubelUI` above. NOTE: this is the runtime UI
 *    component library, unrelated to `h5p-js-testing-shared` despite the name.
 *  - `jQuery.ui` — surprisingly NOT read directly by `h5p-drag-question.js`. The only
 *    hint of jQuery UI (`.data('uiDraggable')` in a drag-stop handler) is internal to
 *    whatever `H5P.Components.Draggable` does at runtime — since that's a runtime
 *    dependency we stub wholesale, real jQuery UI is never exercised by these unit
 *    specs. No local stub needed; full drag-and-drop interaction is e2e-only.
 *  - `FontAwesome` — a CSS-only dependency (icon classes); nothing to stub in JS.
 *
 * `H5P.DragQuestion` itself is NOT pre-stubbed — `h5p-drag-question.js` defines it when
 * loaded; each spec calls `loadScript('h5p-drag-question.js')` and reads the result off
 * `global.H5P.DragQuestion`.
 */

const path = require('path');
const { createHarness } = require('h5p-js-testing-shared');

// libraries/H5P.DragQuestion-1.15 — the root `loadScript` resolves relative paths against.
const LIB_ROOT = path.resolve(__dirname, '..', '..');

// Bind the shared harness to this library. This registers jsdom, wires real jQuery, and
// provides `resetGlobals` (mock EventDispatcher/Presave) + `loadScript`.
const harness = createHarness(LIB_ROOT);
const { jQuery, resetGlobals, loadScript } = harness;

/**
 * Minimal `H5P.Question` base class stand-in.
 *
 * Faithful enough for unit specs that construct `H5P.DragQuestion` and call methods that
 * don't require a real render (`getMaxScore`, `getScore`, `getAnswerGiven`,
 * `getCurrentState`, `getXAPIData`, `resetTask` before any `registerDomElements` call).
 * DOM-heavy assertions (actual drop-zone/draggable markup, drag interactions) are left to
 * e2e — see `tests/behavior_spec.md`.
 */
function installQuestionStub() {
  const EventDispatcher = global.H5P.EventDispatcher;

  // Each Question instance gets its OWN EventDispatcher instance (composed in the
  // constructor, not shared via the prototype) so DragQuestion's own `this.on('resize',
  // ...)` / `this.on('domChanged', ...)` wiring doesn't leak listeners across instances
  // constructed within the same test.
  global.H5P.Question = function Question(type, options) {
    EventDispatcher.call(this);
    this.type = type;
    this.options = options;
  };

  const proto = global.H5P.Question.prototype;
  proto.setIntroduction = function () { return this; };
  proto.setContent = function () { return this; };
  proto.addButton = function () { return this; };
  proto.showButton = function () { return this; };
  proto.hideButton = function () { return this; };
  proto.hasButton = function () { return false; };
  proto.setFeedback = function () { return this; };
  proto.setExplanation = function () { return this; };
  proto.removeFeedback = function () { return this; };
  proto.read = function () { return this; };
  proto.isRoot = function () { return true; };
  proto.triggerXAPI = function () { return this; };
  proto.createXAPIEventTemplate = function () {
    return {
      data: { statement: { result: {} } },
      getVerifiedStatementValue: function (path) {
        let obj = this.data.statement;
        path.forEach(function (key) {
          obj[key] = obj[key] || {};
          obj = obj[key];
        });
        return obj;
      },
      setScoredResult: function (score, max, instance, compound, success) {
        this.data.statement.result = { score: { raw: score, max: max, scaled: max ? score / max : 0 }, success: success };
      }
    };
  };
  // Static members read directly off `H5P.Question` (not the instance).
  global.H5P.Question.determineOverallFeedback = function (overallFeedback, ratio) {
    const percentage = Math.round(ratio * 100);
    const match = (overallFeedback || []).find(function (range) {
      return percentage >= range.from && percentage <= range.to;
    });
    return (match && match.feedback) || '';
  };
  global.H5P.Question.ScorePoints = function ScorePoints() {
    this.getElement = function (isCorrect) {
      return global.H5P.jQuery('<span>', { 'class': isCorrect ? 'h5p-question-plus-one-container' : 'h5p-question-minus-one-container' });
    };
  };

  return global.H5P.Question;
}

/**
 * Minimal `H5P.JoubelUI` stand-in — only reached by `DropZone.appendTo` (render time),
 * so construction-time-only specs never touch it. Present so `loadScript` never throws
 * if a future spec DOES render.
 */
function installJoubelUIStub() {
  global.H5P.JoubelUI = {
    createTip: function () { return undefined; },
    createButton: function (options) { return global.H5P.jQuery('<button>', options); }
  };
  return global.H5P.JoubelUI;
}

/**
 * Minimal `H5P.Components` stand-in — the runtime UI-component library DragQuestion's
 * DropZone/Draggable classes call into from `appendTo`/`attachElement` (render time
 * only). Returns plain DOM elements so `jQuery(...)` can wrap them without throwing;
 * NOT a faithful drag-and-drop implementation — that's e2e territory.
 */
function installComponentsStub() {
  global.H5P.Components = {
    Dropzone: function () {
      return document.createElement('div');
    },
    Draggable: function (options) {
      const el = (options && options.dom) || document.createElement('div');
      el.setContentOpacity = function () { return el; };
      el.setOpacity = function () { return el; };
      el.setAttribute = el.setAttribute || function () {};
      return el;
    }
  };
  return global.H5P.Components;
}

/**
 * Install every DragQuestion-specific stub the runtime file
 * (`h5p-drag-question.js`) reads at load/construction time. Call before
 * `loadScript('h5p-drag-question.js')`.
 */
function installDragQuestionStubs() {
  installQuestionStub();
  installJoubelUIStub();
  installComponentsStub();
}

// Establish base globals immediately so simply requiring the setup is enough.
resetGlobals();

module.exports = {
  jQuery,
  LIB_ROOT,
  resetGlobals,
  loadScript,
  installQuestionStub,
  installJoubelUIStub,
  installComponentsStub,
  installDragQuestionStubs
};



