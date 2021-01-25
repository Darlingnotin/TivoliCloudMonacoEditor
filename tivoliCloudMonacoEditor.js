var tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
var button = tablet.addButton({
    text: "Editor"
});
var monacoEditorUrl = Script.resolvePath("node_modules/monaco-editor.html");

var overlayWebWindow = new OverlayWebWindow({
    title: "Editor",
    source: "about:blank",
    width: 1280,
    height: 720,
    visible: false
});

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
    }
});

function setActive(active) {
    button.editProperties({ isActive: active });
    overlayWebWindow.setURL(monacoEditorUrl);
    overlayWebWindow.setVisible(active);
}

overlayWebWindow.closed.connect(function () {
    setActive(false);
});

Script.scriptEnding.connect(function () {
    tablet.removeButton(button);
});
