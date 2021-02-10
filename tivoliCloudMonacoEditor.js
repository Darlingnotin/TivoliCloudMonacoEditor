// Copyright (c) 2021 Danielle Arlington.

// This program is free software: you can redistribute it and/or modify  
// it under the terms of the GNU General Public License as published by  
// the Free Software Foundation, version 3.
// https://www.gnu.org/licenses/gpl-3.0.en.html

var tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
var button = tablet.addButton({
    text: "Editor",
    icon: Script.resolvePath("code-svg.svg")
});
var monacoEditorUrl = Script.resolvePath("node_modules/monaco-editor.html?166374");
var overlayWebWindow = new OverlayWebWindow({
    title: "Editor",
    source: "about:blank",
    width: 1280,
    height: 720,
    visible: false
});
var isLive = false;
var id;
var liveEditorFileName;
var pageStatus = {
    scriptData: "",
    styleDark: true
}
var pickerActive = false;
var scriptType;
var pickerTimeOut;

function onClicked() {
    setActive(!button.getProperties().isActive);
}

button.clicked.connect(onClicked);

overlayWebWindow.webEventReceived.connect(function (event) {
    var webEventData = JSON.parse(event);
    if (webEventData.action == "save") {
        Assets.putAsset(
            {
                data: webEventData.fileData,
                path: webEventData.fileName
            },
            function (error, result) {
                if (error) {
                    //print("ERROR: Data not uploaded or mapping not set");
                } else {
                    //print("URL: " + result.url);
                }
            }
        );
    } else if (webEventData.action == "loadScript") {
        Assets.getAsset(
            {
                url: webEventData.fileName,
                responseType: "text"
            },
            function (error, result) {
                if (error) {
                    var messageData = {
                        action: "loadScriptResponse",
                        fileData: "ERROR: Data not downloaded"
                    };
                    overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
                } else {
                    var messageData = {
                        action: "loadScriptResponse",
                        fileData: result.response
                    };
                    overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
                }
            }
        );
    } else if (webEventData.action == "goLive") {
        id = webEventData.id;
        liveEditorFileName = webEventData.fileName;
        goLine();
    } else if (webEventData.action == "goSilent") {
        goSilent();
    } else if (webEventData.action == "sendLiveUpdates") {
        Messages.sendMessage("editorLiveChannel", event);
        pageStatus.scriptData = webEventData.scriptUpdateData;
    } else if (webEventData.action == "executeJs") {
        eval(webEventData.scriptData);
    } else if (webEventData.action == "requestCurrentPageStatus") {
        var messageData = {
            action: "requestCurrentPageStatusResponse",
            pageStatus: pageStatus
        };
        overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
    } else if (webEventData.action == "updatePageData") {
        pageStatus.scriptData = webEventData.scriptData;
    } else if (webEventData.action == "updateStyle") {
        pageStatus.styleDark = webEventData.styleDark
    } else if (webEventData.action == "pickerGetScript") {
        scriptType = webEventData.scriptType;
        if (!pickerActive) {
            pickerActive = true;
            pickerGetScript();
        }
    } else if (webEventData.action == "openTabletEditorMenu") {
        var tabletEditor = Script.resolvePath("node_modules/tabletEditorMenu.html");
        tablet.gotoWebScreen(tabletEditor);
    }
});

function setActive(active) {
    button.editProperties({ isActive: active });
    overlayWebWindow.setURL(monacoEditorUrl);
    overlayWebWindow.setVisible(active);
}

overlayWebWindow.closed.connect(function () {
    setActive(false);
    if (isLive) {
        isLive = false;
        Messages.unsubscribe("editorLiveChannel");
        Messages.messageReceived.disconnect(onMessageReceived);
    }
    if (pickerActive) {
        Entities.clickDownOnEntity.disconnect(onClick);
        pickerActive = false;
        Script.clearTimeout(pickerTimeOut);
    }
});

function goLine() {
    isLive = true;
    Messages.messageReceived.connect(onMessageReceived);
    Messages.subscribe("editorLiveChannel");
}

function goSilent() {
    isLive = false;
    Messages.unsubscribe("editorLiveChannel");
    Messages.messageReceived.disconnect(onMessageReceived);
}

function onMessageReceived(channel, message) {
    if (channel != "editorLiveChannel") {
        return;
    }
    var messageData = JSON.parse(message);
    if (isLive && messageData.id != id) {
        if (messageData.action == "sendLiveUpdates" && messageData.fileName == liveEditorFileName) {
            var messageData = {
                action: "receiveLiveData",
                fileData: messageData.scriptUpdateData
            };
            overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
            pageStatus.scriptData = messageData.fileData;
        }
    }
}

function pickerGetScript() {
    pickerActiveTimeOut();
    Entities.clickDownOnEntity.connect(onClick);
}

function onClick(uuid, mouseEvent) {
    entity = Entities.getEntityProperties(uuid, ["script", "serverScripts"]);
    if (scriptType == "script") {
        fileName = entity.script;
    } else if (scriptType == "serverScripts") {
        fileName = entity.serverScripts;
    }
    if (fileName.substring(0, 3) == "atp") {
        if (fileName != "undefined") {
            Assets.getAsset(
                {
                    url: fileName,
                    responseType: "text"
                },
                function (error, result) {
                    if (error) {
                        var messageData = {
                            action: "loadScriptResponse",
                            fileData: "ERROR: Data not downloaded"
                        };
                        overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
                    } else {
                        var messageData = {
                            action: "loadScriptResponse",
                            fileData: result.response,
                            fileName: fileName
                        };
                        overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
                    }
                }
            );
            pickerActive = false;
            Entities.clickDownOnEntity.disconnect(onClick);
            Script.clearTimeout(pickerTimeOut);
        }
    }
}

function pickerActiveTimeOut() {
    pickerTimeOut = Script.setTimeout(function () {
        Entities.clickDownOnEntity.disconnect(onClick);
        pickerActive = false;
    }, 60000);
}

tablet.webEventReceived.connect(onWebEventReceived);

function onWebEventReceived(event) {
    var messageData = JSON.parse(event);
    if (messageData.action == "editFile") {
        var messageData = {
            action: "editFile",
            fileData: messageData.fileData,
            fileName: messageData.fileName
        };
        overlayWebWindow.emitScriptEvent(JSON.stringify(messageData));
        pageStatus.scriptData = messageData.fileData;
    }
}

Script.scriptEnding.connect(function () {
    tablet.removeButton(button);
    tablet.webEventReceived.disconnect(onWebEventReceived);
    if (isLive) {
        Messages.unsubscribe("editorLiveChannel");
        Messages.messageReceived.disconnect(onMessageReceived);
    }
    if (pickerActive) {
        Entities.clickDownOnEntity.disconnect(onClick);
        Script.clearTimeout(pickerTimeOut);
    }
});
