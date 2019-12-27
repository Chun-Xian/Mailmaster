README
------

Mailmaster Label is a tool that used to label an email thread and share the labels with others that install the same script.

ADMIN INSTALLATION
-----------------
To install Mailmaster Label from code:

 * Browse https://script.google.com (choose New Project => scripting platform)
 * Copy the sample code of "Code.gs" into the text editor
 * Click File > Save menu and name the script (e.g. "Mailmaster Label")
 * Click File > New > Html file menu and create a file called "ui"
 * Copy the sample code of "ui.html" into the created file
 * Click Publish > Deploy as Web App menu
 * Click "Save new version" (no need for any text in the box)
 * Change "Execute the app as" to "User accessing the web app"
 * For "Who has access to the app", set access to "Anyone" or "Anyone within (yourdomain.com)"
 * Click Deploy
 * Copy "Current web app URL" and share the URL to all the users for installation
 

USER INSTALLATION
----------------------
To install from an existing code installation:

 * Browse the web app URL that shared by the admin
 * If prompted to authorize or grant permissions, do so 
 * After entered the web app, users subscribe the labels based on their interests
 * Click install


UNINSTALL
---------
The script can temporarily uninstall using the Uninstall button at the web app.
This will functionally disable the script but preserve all of your options
for reinstalling later. If you would like to fully uninstall,
there is a link in the automated email you will receive from Apps Script
at installation time.


ADMIN FUNCTION
--------------
Admin can name the group that uses the label -- this is just a descriptive name 
for the purposes of this configuration screen. 
Admin can create a new *label* -- a label use to label the email thread
An *unlabel* -- a label use to trigger removal of the actual label.

For instance, a label named "good", and choose
the unlabel of "bad" -- when an email thread is mislabeled
"good" (i.e. maybe the status changed), then add the label
"bad". That will trigger the next run to remove the label
"resolved" from users.


SYNC FREQUENCY
--------------

Synchronization is NOT immediate -- it will generally occur at
whatever twice the value of UPDATE_MINUTES (around 10 minutes) 
is set to at the top of Code.gs.

(Note that Google only allows certain values for UPDATE_MINUTES;
 It can also be 5 or 10)


