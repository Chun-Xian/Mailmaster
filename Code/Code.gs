//variable
var L_PREFIX = 'sharedLabel_';
var MAX_OLD_THREAD_NUM = 50;
var UPDATE_MINUTES = 5;

//==coding==
function propSplit(src, prop, token) {
  //splits value on @token, and if empty, returns empty array
  var val = src.getProperty(prop);
  return (val ? val.split(token) : []);
}

// To avoid collisions/overwrites, every member having their own queue of updates
function setConfig(config) {
  
  Logger.log('setConfig ' + new Date()); //simple checks during development and debugging
  Logger.log(config);
  
  var globalProperties = PropertiesService.getScriptProperties(); //Gets a property store that all users can access, but only within this script.
  var userProperties = PropertiesService.getUserProperties(); //Gets a property store that only the current user can access, and only within this script.
  var email = Session.getActiveUser().getEmail(); // Log the email address of the person running the script.

  var finalConfig = {}; //object
  var memberships = []; //array
  for (var name in config) {
    if (!name) {
      continue; //blank name, probably an empty 'new row'
    }
    var lbl = config[name];
    name = name.replace(/[^\w ]/g,'');
    finalConfig[name] = {name:name,
                         label:lbl.label.replace(/[^\/\w ]/g,''),
                         unlabel:lbl.unlabel.replace(/[^\/\w ]/g,'')};
    if (finalConfig[name].label == finalConfig[name].unlabel) {
      throw Error("label and unlabel must be different");
    }
    var labelMembershipKey = L_PREFIX + name;
    var labelMemberships = propSplit(globalProperties, labelMembershipKey, ',');
    var curMemberInd = labelMemberships.indexOf(email);
    Logger.log(name + ' __ ' + curMemberInd);
    if (lbl.member) {
      memberships.push(name);
      if (curMemberInd == -1) {
        labelMemberships.push(email);
        globalProperties.setProperty(labelMembershipKey, labelMemberships.join(',')); //2
      }
    } else if (curMemberInd >= 0) {
      labelMemberships.splice(curMemberInd, 1);
      globalProperties.setProperty(labelMembershipKey, labelMemberships.join(',')); //2
    }
  }

  globalProperties.setProperty(L_PREFIX+'names', JSON.stringify(finalConfig)); //1
  userProperties.setProperty(L_PREFIX+'membership', memberships.join(';')); //3

  Logger.log(finalConfig);
  Logger.log(memberships);
  return memberships;
}

function getTriggers(userProperties) { //Triggering
  userProperties = userProperties || PropertiesService.getUserProperties();
  var triggers = []; //array
  var triggerIds = JSON.parse(userProperties.getProperty(L_PREFIX + 'triggers') || '[]');
  ScriptApp.getProjectTriggers().map(function(trigger) {
    //Restrict aLL the triggers for the script (for all users)
    if (triggerIds.indexOf(trigger.getUniqueId()) != -1) {
      triggers.push(trigger);
    }
  });
  return triggers;
}

function isInstalled(triggers) { //Installed
  triggers = triggers || getTriggers();
  return triggers.length != 0;
}

function install(config) { //Installing
  var userProperties = PropertiesService.getUserProperties();
  uninstall();

  var triggers = [];
  Logger.log('installing triggers ,' + new Date());
  triggers.push(ScriptApp.newTrigger('updateUserSharedLabels').timeBased().everyMinutes(UPDATE_MINUTES).create());

  if (triggers.length) {
    var triggerIds = triggers.map(function(t) {return t.getUniqueId()});
    userProperties.setProperty(L_PREFIX + 'triggers', JSON.stringify(triggerIds));
  }
  Logger.log('installing triggers FINISHED ,' + new Date());

  var memberships = setConfig(config);
  createOrGetLabels(config, memberships);
  return {
    triggers: triggers.length
  };
}

function uninstall() { //Uninstalling
  var userProperties = PropertiesService.getUserProperties();
  var triggers = getTriggers();
  triggers.map(function(userTrigger) {
      ScriptApp.deleteTrigger(userTrigger);
      //necessary for rate-limiting
      Utilities.sleep(1000);
  });
  userProperties.setProperty(L_PREFIX + 'triggers', '[]');
  return {
    triggers: 0
  };
}

function doGet() { //HTML service
  var t = HtmlService.createTemplateFromFile('interface'); //Return an HtmlOutput object
  t.installed = isInstalled();
  t.synchronization_lag = UPDATE_MINUTES * 2;  //10 minutes update time

  var email = Session.getActiveUser().getEmail(); // Log the email address of the person running the script.
  t.logo = '';
  if (email) {
    var domain = email.split('@')[1];
    t.logo = 'https://www.google.com/a/'+domain+'/images/logo.gif?alpha=1&service=google_default'; //google logo image
  }
  return t.evaluate().setSandboxMode(HtmlService.SandboxMode.NATIVE);
}

function loadPage() {
  var globalProperties = PropertiesService.getScriptProperties();
  var userProperties = PropertiesService.getUserProperties();

  var memberships = propSplit(userProperties, (L_PREFIX + 'membership'), ';');
  var sharedLabels = JSON.parse((globalProperties.getProperty(L_PREFIX + 'names')||'{}'));

  memberships.map(function(name) {
    var lbl = sharedLabels[name];
    if (lbl) {
      lbl.member = true;
    }
  });
  return {
    labels: sharedLabels,
    triggers: getTriggers(userProperties).length,
    synchronization_lag: UPDATE_MINUTES * 2
  };
}

function createOrGetLabels(config, memberships) { //Creating new label or get existing label
  var existingLabels = {};
  GmailApp.getUserLabels().map(function(label) { //Retrieves a list of user-created labels
    existingLabels[label.getName()] = label;
  });
  function getLabel(name) {
    return existingLabels[name] || GmailApp.createLabel(name);
  };
  var labels = {};
  memberships.map(function(name) {
    labels[name] = {
      'label': getLabel(config[name].label),
      'unlabel': getLabel(config[name].unlabel)
    };
  });
  return labels;
}



function updateUserSharedLabels() { //Updating user-creating shared labels
  var globalProperties = PropertiesService.getScriptProperties(); //Gets a property store that all users can access, but only within this script.
  var userProperties = PropertiesService.getUserProperties(); //Gets a property store that only the current user can access, and only within this script.
  var lastRun = Number(userProperties.getProperty(L_PREFIX + 'lastRun') || 0);
  var userEmail = Session.getActiveUser().getEmail(); // Log the email address of the person running the script.
  Logger.log('running update for ' + userEmail + ' at ' + new Date());

  var memberships = propSplit(userProperties, (L_PREFIX + 'membership'), ';');
  var config = JSON.parse(globalProperties.getProperty(L_PREFIX + 'names'));
  var labels = createOrGetLabels(config, memberships);
  memberships.map(function(name) {
    updateSharedLabel(name, userEmail, lastRun,
                      globalProperties, userProperties,
                      labels[name].label, labels[name].unlabel);
  });
  // Update timestamp
  userProperties.setProperty(L_PREFIX + 'lastRun',
                             String(Number(new Date())));
  Logger.log('finished update for ' + userEmail + ' at ' + new Date());
}

/*
 * processes a particular label/unlabel pair
 */
function updateSharedLabel(name, userEmail, lastRun,
                           globalProperties, userProperties,
                           label, unlabel) {
  
  var members = propSplit(globalProperties, (L_PREFIX + name), ',');
  var msgThreads = {}; //store gmailthread msgId
  var newCommands = [];
  var newDecisions = {}; //store gmailthreadId
  var userCommands = [];
  var pastCommands = [];
  var pastDecisions = {};

  //BUILD newCommands[], pastCommands[] (and msgThreads)
  members.map(function(memEmail) {
    var memberCmdList = propSplit(globalProperties, (L_PREFIX + name + '_' + memEmail), ',');

    if (memEmail == userEmail) {
      //OWN MEMBERSHIP: process differently
      userCommands = memberCmdList.slice(); //copy for later
      memberCmdList.map(updateProcessor(lastRun, pastCommands, msgThreads));
      return;
    } else {
      //OTHER MEMBERSHIPS: => newDecisions
      memberCmdList.map(updateProcessor(lastRun, newCommands, msgThreads, pastCommands));
    }
  });
  //BUILD newDecisions, pastDecisions
  var decisionBuilder = function(decisionDict) {
    return function(cmd) {
      var gmailThread = msgThreads[cmd[2]];
      if (gmailThread) {
        //by design: might overwrite a previous command with a different result
        decisionDict[gmailThread.getId()] = [cmd[1], gmailThread];
      }
    };
  };
  newCommands.sort(); //will sort by timestamp, the first elt of the sub-list
  newCommands.map(decisionBuilder(newDecisions));
  pastCommands.sort();
  pastCommands.map(decisionBuilder(pastDecisions));

  var myChangedThreads = getChangedThreads(label, unlabel, pastDecisions);
  
  for (var usid in myChangedThreads) {
    var us = myChangedThreads[usid];
    var them = newDecisions[usid];
    if (them) { // in both;
      if (them[0] == us[0]) {
        //agreement
        delete myChangedThreads[usid];
        delete newDecisions[usid];
      } else {
        //disagreement: prefer label
        if (them[0] == 'd') {
          delete newDecisions[usid];
        } else {
          delete myChangedThreads[usid];
        }
      }
    }
    // clear the unlabel as log it later
    if (us[0] == 'd') {
      us[1].removeLabel(unlabel);
      us[1].removeLabel(label);
    }
  }

  // Save commands
  var timeStamp = Number(new Date());
  for (var usid in myChangedThreads) {
    var us = myChangedThreads[usid];
    var newCmd = getIdsForTracking(us[1]);
    newCmd.unshift(timeStamp, us[0]);

    userCommands.push(newCmd.join(':'));
  }
  userCommands = purgeExtraCommands(userCommands);
  globalProperties.setProperty(L_PREFIX + name + '_' + userEmail,
                               userCommands.join(','));

  // Update labels
  for (var themId in newDecisions) {
    var t = newDecisions[themId];
    switch (t[0]) {
      case 'a':
        t[1].addLabel(label);
        break;
      case 'd':
        t[1].removeLabel(label);
        break;
    }
    t[1].removeLabel(unlabel);
  }
}

function updateProcessor(lastRun, commandList, msgThreads, fallbackCommandList) {
  return function(update) {
    var updateComponents = update.split(':');
    var timestamp = Number(updateComponents[0]);
    if (timestamp > lastRun) {
      commandList.push(updateComponents);
    } else if (fallbackCommandList) {
      fallbackCommandList.push(updateComponents);
    }
    var thread = false;
    // thread Ids are unstable even within a single user's Inbox
    //  so we map all the message Ids to the same thread
    //find a thread
    updateComponents.slice(2).map(function(msgId) {
      if (msgThreads[msgId]) {
        thread = msgThreads[msgId];
      } else if (!thread) {
        thread = getThreadById(msgId);
      }
    });
    //now setup any new refs
    if (thread) {
      updateComponents.slice(2).map(function(msgId) {
        if (!msgThreads[msgId]) {
          msgThreads[msgId] = thread;
        }
      });
    }
  };
}

function getChangedThreads(label, unlabel, curStateDecisions) {
  var threads = label.getThreads(0, MAX_OLD_THREAD_NUM);
  var unthreads = unlabel.getThreads(0, MAX_OLD_THREAD_NUM);
  var changedThreads = {};
  var ids = {};
  threads.map(function(t) {
    ids[t.getId()] = t;
  });
  unthreads.map(function(t) {
    //TODO: need to remove from ids or organize into one list
    var dtid = t.getId();
    delete ids[dtid]; //in case it's there
    if (!curStateDecisions[dtid] || curStateDecisions[dtid][0] != 'd') {
      changedThreads[dtid] = ['d', t]
    }
  });
  for (var atid in ids) {
    if (!curStateDecisions[atid] || curStateDecisions[atid][0] != 'a') {
      changedThreads[atid] = ['a', ids[atid]];
    }
  }
  return changedThreads;
}

function getThreadById(msgId) {
  //msgId is the subject, because GmailMessage.getId() is not the same across users
  var subject = decodeURIComponent(msgId); //
  //ASSUME: just search for first one, even if redundant subjects
  //IMPROVE: in theory we could make this more rigorous by getting subject+messages[0].id or something
  var threads = GmailApp.search('subject:"'+subject+'"', 0, 1);
  return threads[0]; //if empty will return undefined
}

function getIdsForTracking(t) {
  return [encodeURIComponent(t.getFirstMessageSubject())];
}

function purgeExtraCommands(userCommands) {
  var newerCmd = {};
  var purgedList = [];
  var i = userCommands.length;
  while (i--) {
    var c = userCommands[i];
    var components = c.split(':');
    var msgId1 = components[2];
    var msgId2 = components[3];
    if (newerCmd[msgId2]
        || (msgId2 && newerCmd[msgId2])) {
      continue; //newer command already exists
    } else {
      newerCmd[msgId1] = 1;
      if (msgId2) {
        newerCmd[msgId2] = 1;
      }
      purgedList.unshift(c)
    }
  }
  return purgedList.slice(-(MAX_OLD_THREAD_NUM+10))
}
