/*
Hook executed before the 'prepare' stage. Only for iOS project.
It will check if project name has changed. If so - it will change the name of the .entitlements file to remove that file duplicates.
If file name has no changed - hook will do nothing.
*/

var path = require('path');
var fs = require('fs');
var ConfigXmlHelper = require('./lib/configXmlHelper.js');

module.exports = function(ctx) {
  run(ctx);
};

/**
 * Run the hook logic.
 *
 * @param {Object} ctx - cordova context object
 */
function run(ctx) {
  var projectRoot = ctx.opts.projectRoot;
  var iosProjectFilePath = path.join(projectRoot, 'platforms', 'ios');
  var configXmlHelper = new ConfigXmlHelper(ctx);
  var newProjectName = configXmlHelper.getProjectName();

  var oldProjectName = getOldProjectName(iosProjectFilePath);

  // if name has not changed - do nothing
  if (oldProjectName.length && oldProjectName === newProjectName) {
    return;
  }

  // Nothing to rename if the old file was never created.  On cordova-ios 7+ the project folder
  // and .xcodeproj are ALWAYS called "App" regardless of the app name, so getOldProjectName()
  // returns "App" on a project that was never renamed - this hook then reports a rename that did
  // not happen and throws ENOENT on a file that has never existed.
  var oldEntitlementsFilePath = path.join(iosProjectFilePath, oldProjectName, 'Resources', oldProjectName + '.entitlements');
  var newEntitlementsFilePath = path.join(iosProjectFilePath, oldProjectName, 'Resources', newProjectName + '.entitlements');

  if (!fs.existsSync(oldEntitlementsFilePath)) {
    return;
  }

  console.log('Project name has changed. Renaming .entitlements file.');

  try {
    fs.renameSync(oldEntitlementsFilePath, newEntitlementsFilePath);
  } catch (err) {
    console.warn('Failed to rename .entitlements file.');
    console.warn(err);
  }
}

// region Private API

/**
 * Get old name of the project.
 * Name is detected by the name of the .xcodeproj file.
 *
 * @param {String} projectDir absolute path to ios project directory
 * @return {String} old project name
 */
function getOldProjectName(projectDir) {
  var files = [];
  try {
    files = fs.readdirSync(projectDir);
  } catch (err) {
    return '';
  }

  var projectFile = '';
  files.forEach(function(fileName) {
    if (path.extname(fileName) === '.xcodeproj') {
      projectFile = path.basename(fileName, '.xcodeproj');
    }
  });

  return projectFile;
}

// endregion
