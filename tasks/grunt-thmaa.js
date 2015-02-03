"use strict";
var gCommands = [
    'new',
    'override',
    'update',
    'check',
    'set-version',
    'compile'
  ],
  thmaa = require('thmaa');

module.exports = function(grunt) {

  grunt.registerMultiTask('thmaa', function() {
    var done = this.async();
    var opts = this.data && this.data.opts || {};
    var target = (this.data && this.data.command) || this.target || this.args[0];
    if (gCommands.indexOf(target) === -1) {
      grunt.fail.warn('Unrecognized thmaa command `' + target + '`.');
      return false;
    }
    if (typeof opts === "function") {
      opts(run);
    } else {
      run(null, opts);
    }
    function run(err, opts) {
      if (err) {
        grunt.fail.warn(err);
        return false;
      }
      try {
        thmaa(target, opts, done);
      } catch(e) {
        grunt.fail.warn(e.message);
      }
    }
  });

};