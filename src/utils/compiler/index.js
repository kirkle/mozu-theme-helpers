﻿var path = require('path'),
    os = require('os'),
    events = require('events'),
    async = require('async'),
    ncp = require('ncp').ncp,
    rimraf = require('rimraf'),
    constants = require('./constants'),
    themes = require('./themes'),
    compile = require('./compile');

ncp.limit = 16;

function createTempInheritedTheme(theme, program, finalCb) {
    var tmpThemeName =  "zubat_tmp" + new Date().getTime(),
        tmpDirPath = path.resolve(path.join(os.tmpdir(), tmpThemeName)),
        ancestry = [],
        ignores = program.ignore || ['\\.git','node_modules'];


    if (!Array.isArray(ignores)) ignores = [ignores];

    if (program.manualancestry) {
        if (!Array.isArray(program.manualancestry)) program.manualancestry = [program.manualancestry];
        async.map(program.manualancestry, function (themePath, continuation) {
            themes.getThemeFromPath(path.resolve(themePath), program, continuation);
        }, function (err, results) {
            if (err) {
                program.log(1, constants.LOG_SEV_ERROR, "Error occurred while building manual ancestry tree.");
                throw err;
            }
            ancestry = results.reverse();
            ancestry.push(theme);
            createFromAncestry();
        });
    } else {
        traverseThemeTree(null, theme);
    }

    function traverseThemeTree(err, theme) {
        if (err) {
            program.log(1, constants.LOG_SEV_ERROR, "Error traversing theme tree.");
            throw err;
        }
        program.log(2, constants.LOG_SEV_INFO, "Added " + theme.name + " to ancestry stack.");
        ancestry.unshift(theme);
        if (!theme.extends) {
            program.log(2, constants.LOG_SEV_SUCCESS, "Successfully created theme ancestry stack of length " + ancestry.length + ".");
            return createFromAncestry();
        }
        themes.getThemeFromId(theme.extends, program, traverseThemeTree);
    }

    function createFromAncestry() {
        var i = 0,
            il = ignores.length,
            ignoreREs = ignores.map(function(s) {
                return new RegExp(s);
            });
        async.eachSeries(ancestry, function (ancestor, continuation) {
            var sourceDir = ancestor.getBaseDir();
            program.log(2, constants.LOG_SEV_INFO, "Beginning recursive copy of " + sourceDir + " to " + tmpDirPath + ".");
            ncp(sourceDir, tmpDirPath, {
                filter: function(name) {
                    name = name.replace(sourceDir, '');
                    for (i=0; i < il; i++) {
                        if (ignoreREs[i].test(name)) {
                            program.log(2, constants.LOG_SEV_INFO, "Ignoring " + name);
                            return false;
                        }
                    }
                    return true;
                }
            }, continuation);
        }, function(err) {
            if (err) {
                program.log(1, constants.LOG_SEV_ERROR, "Error occurred while copying files.");
                throw err;
            }
            themes.getThemeFromPath(tmpDirPath, program, finalCb);
        });
    }
}


function createLogger(prog) {
    prog.logEventBus = prog.logEventBus || new events.EventEmitter();
    prog.log = prog.log || function (level, sev, str) {
        if (prog.logLevel >= level) {
            prog.logEventBus.emit('log', str, sev, level);
        }
    };
}

module.exports = function(themePath, program, cb) {
    program = program || {
        logLevel: 1
    };
    createLogger(program);

    var dirToClean;

    function finish(err) {
        var composedCb = cb;
        if (err) {
            program.log(1, constants.LOG_SEV_ERROR, err.toString());
            composedCb = function(newErr) {
                return cb(newErr ? new Error("Multiple errors occurred: \n" + newErr.toString() + "\n" + err.toString() ) : err);
            }
        }
        return cleanup(composedCb);
    }

    function cleanup(callback) {
        if (!dirToClean) {
            process.nextTick(callback);
        } else {
            program.log(2, constants.LOG_SEV_INFO, "Deleting temp theme " + dirToClean);
            rimraf(dirToClean, callback);
        }
    }

    process.nextTick(function () {
        program.log(1, constants.LOG_SEV_INFO, "Beginning compilation of " + themePath);
        themes.getThemeFromPath(path.resolve(themePath), program, function (err, thisTheme) {
            if (err) {
                program.log(1, constants.LOG_SEV_ERROR, "Error getting theme " + themePath);
                throw err;
            }
            program.dest = program.dest || thisTheme.getCompiledScriptsDir();
            if (thisTheme.extends || program.manualancestry) {
                if (thisTheme.extends) {
                    program.log(2, constants.LOG_SEV_INFO, "Theme " + thisTheme.name + " extends " + thisTheme.extends + ". Creating inherited theme.");
                }
                if (program.manualancestry) {
                    program.log(2, constants.LOG_SEV_INFO, "Manual ancestry specified. Creating inherited theme from " + program.manualancestry);
                }
                createTempInheritedTheme(thisTheme, program, function (err, inheritedTheme) {
                    if (err) {
                        program.log(1, constants.LOG_SEV_ERROR, "Error creating temp inherited theme.");
                        throw err;
                    }
                    dirToClean = inheritedTheme.getBaseDir();
                    compile(inheritedTheme, program, finish);
                });
            } else {
                compile(thisTheme, program, finish);
            }
        });
    });
    program.logEventBus.cleanup = cleanup;
    return program.logEventBus;
};
