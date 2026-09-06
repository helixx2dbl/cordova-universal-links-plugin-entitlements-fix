/**
Hook is executed at the end of the 'prepare' stage. Usually, when you call 'cordova build'.

It will inject required preferences in the platform-specific projects, based on <universal-links>
data you have specified in the projects config.xml file.
*/

var configParser = require('./lib/configXmlParser.js');
var androidManifestWriter = require('./lib/android/manifestWriter.js');
var androidWebHook = require('./lib/android/webSiteHook.js');
var iosProjectEntitlements = require('./lib/ios/projectEntitlements.js');
var iosAppSiteAssociationFile = require('./lib/ios/appleAppSiteAssociationFile.js');
var iosProjectPreferences = require('./lib/ios/xcodePreferences.js');
var ANDROID = 'android';
var IOS = 'ios';

module.exports = function(ctx) {
  run(ctx);
};

/**
 * Execute hook.
 *
 * @param {Object} cordovaContext - cordova context object
 */
function run(cordovaContext) {
  var pluginPreferences = configParser.readPreferences(cordovaContext);
  var platformsList = cordovaContext.opts.platforms;

  // if no preferences are found - exit
  if (pluginPreferences == null) {
    return;
  }

  // if no host is defined - exit
  if (pluginPreferences.hosts == null || pluginPreferences.hosts.length == 0) {
    console.warn('No host is specified in the config.xml. Universal Links plugin is not going to work.');
    return;
  }

  platformsList.forEach(function(platform) {
    switch (platform) {
      case ANDROID:
        {
          activateUniversalLinksInAndroid(cordovaContext, pluginPreferences);
          break;
        }
      case IOS:
        {
          activateUniversalLinksInIos(cordovaContext, pluginPreferences);
          break;
        }
    }
  });
}

/**
 * Activate Deep Links for Android application.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from the config.xml file. Basically, content from <universal-links> tag.
 */
function activateUniversalLinksInAndroid(cordovaContext, pluginPreferences) {
  // inject preferenes into AndroidManifest.xml
  androidManifestWriter.writePreferences(cordovaContext, pluginPreferences);

  // generate html file with the <link> tags that you should inject on the website.
  androidWebHook.generate(cordovaContext, pluginPreferences);
}

/**
 * Activate Universal Links for iOS application.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from the config.xml file. Basically, content from <universal-links> tag.
 */
function activateUniversalLinksInIos(cordovaContext, pluginPreferences) {
  // cordova-ios 7+ names the project folder and .xcodeproj "App" no matter what the app is
  // called, and ships its own Entitlements-Debug/Release.plist which the target already signs
  // with.  This plugin predates that: it writes <AppName>/Resources/<AppName>.entitlements and
  // repoints CODE_SIGN_ENTITLEMENTS at it - a folder that does not exist in the new layout, so
  // the build fails with "Build input file cannot be found", and any entitlement another plugin
  // contributed (Pushwoosh's aps-environment, say) is dropped from signing along the way.
  //
  // On that layout, leave entitlements alone.  Declare the associated domains in config.xml
  // instead, which cordova merges into its own plists:
  //
  //   <config-file parent="com.apple.developer.associated-domains"
  //                target="*/Entitlements-Release.plist">
  //     <array><string>applinks:your.host.com</string></array>
  //   </config-file>
  //
  // The AASA helper file below is just a file written for you to upload, so it still runs.
  if (usesModernIosLayout(cordovaContext)) {
    console.log('cordova-ios 7+ detected: skipping entitlements generation. Declare associated ' +
                'domains via <config-file target="*/Entitlements-*.plist"> in config.xml.');
  } else {
    // modify xcode project preferences
    iosProjectPreferences.enableAssociativeDomainsCapability(cordovaContext);

    // generate entitlements file
    iosProjectEntitlements.generateAssociatedDomainsEntitlements(cordovaContext, pluginPreferences);
  }

  // generate apple-site-association-file
  iosAppSiteAssociationFile.generate(cordovaContext, pluginPreferences);
}

/**
 * Is this the cordova-ios 7+ project layout, where the folder is always called "App"?
 *
 * @param {Object} cordovaContext - cordova context object
 * @return {Boolean} true if the fixed-name layout is in use
 */
function usesModernIosLayout(cordovaContext) {
  var path = require('path');
  var fs = require('fs');

  return fs.existsSync(path.join(cordovaContext.opts.projectRoot, 'platforms', 'ios', 'App.xcodeproj'));
}
