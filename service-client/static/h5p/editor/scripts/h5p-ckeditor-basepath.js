// Set CKEDITOR_BASEPATH before ckeditor.js loads so it knows where to find
// its skins, language files, and plugins. Without this, CKEditor auto-detects
// its path from the <script> src attribute, but h5peditor-html.js later
// overrides it with an incorrect path (ns.basePath + '/ckeditor/').
// Setting CKEDITOR_BASEPATH takes precedence over both auto-detection and
// the h5peditor-html.js override.
window.CKEDITOR_BASEPATH = '/h5p/editor/ckeditor/';
