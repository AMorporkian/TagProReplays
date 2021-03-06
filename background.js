function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

tileSize = 40

can = document.createElement('canvas')
can.id = 'mapCanvas'
document.body.appendChild(can)

can = document.getElementById('mapCanvas')
can.width = 32 * tileSize
can.height = 20 * tileSize
can.style.zIndex = 200
can.style.position = 'absolute'
can.style.top = 0
can.style.left = 0


context = can.getContext('2d')

defaultTextures = {
    tiles: 'img/tiles.png',
    portal: 'img/portal.png',
    speedpad: 'img/speedpad.png',
    speedpadred: 'img/speedpadred.png',
    speedpadblue: 'img/speedpadblue.png',
    splats: 'img/splats.png',
    flair: 'img/flair.png'
}

img = new Image()
img.src = defaultTextures.tiles
img.id = 'tiles'
img = document.body.appendChild(img)

portalImg = new Image()
portalImg.src = defaultTextures.portal
portalImg.id = 'portal'
portalImg = document.body.appendChild(portalImg)

speedpadImg = new Image()
speedpadImg.src = defaultTextures.speedpad
speedpadImg.id = 'speedpad'
speedpadImg = document.body.appendChild(speedpadImg)

speedpadredImg = new Image()
speedpadredImg.src = defaultTextures.speedpadred
speedpadredImg.id = 'speedpadred'
speedpadredImg = document.body.appendChild(speedpadredImg)

speedpadblueImg = new Image()
speedpadblueImg.src = defaultTextures.speedpadblue
speedpadblueImg.id = 'speedpadblue'
speedpadblueImg = document.body.appendChild(speedpadblueImg)

tagproImg = new Image()
tagproImg.src = 'img/tagpro.png'
tagproImg.id = 'tagpro'
tagproImg = document.body.appendChild(tagproImg)

rollingbombImg = new Image()
rollingbombImg.src = 'img/rollingbomb.png'
rollingbombImg.id = 'rollingbomb'
rollingbombImg = document.body.appendChild(rollingbombImg)

splatsImg = new Image()
splatsImg.src = defaultTextures.splats
splatsImg.id = 'splats'
splatsImg = document.body.appendChild(splatsImg)

flairImg = new Image()
flairImg.src = defaultTextures.flair
flairImg.id = 'flair'
flairImg = document.body.appendChild(flairImg)


// This function opens a download dialog
function saveVideoData(name, data) {
    var file = data
    var a = document.createElement('a');
    a.download = name;
    a.href = (window.URL || window.webkitURL).createObjectURL(file);
    var event = document.createEvent('MouseEvents');
    event.initEvent('click', true, false);
    a.dispatchEvent(event);
    (window.URL || window.webkitURL).revokeObjectURL(a.href);
}

// Actually does the rendering of the movie 
function renderVideo(positions, name, useSplats, lastOne, replaysToRender, replayI, tabNum) {
    localStorage.setItem('useSplats', useSplats)
    positions = JSON.parse(positions)
    mapImgData = drawMap(0, 0, positions)
    mapImg = new Image()
    mapImg.src = mapImgData
    console.log(positions)
    for (j in positions) {
        if (positions[j].me == 'me') {
            me = j
        }
    }
    var encoder = new Whammy.Video(positions[me].fps);

    chrome.tabs.sendMessage(tabNum, {method: "progressBarCreate", name: name})
    for (thisI = 0; thisI < positions.clock.length; thisI++) {
        if (thisI / Math.round(positions.clock.length / 100) % 1 == 0) {
            chrome.tabs.sendMessage(tabNum, {
                method: "progressBarUpdate",
                progress: thisI / positions.clock.length,
                name: name
            })
        }
        animateReplay(thisI, positions, mapImg)
        encoder.add(context)
    }
    output = encoder.compile()
    console.log('movie: ', output)
    createFileSystem('savedMovies', saveMovieFile, [name, output])
    if (lastOne) {
        chrome.tabs.sendMessage(tabNum, {method: "movieRenderConfirmation"})
    } else {
        chrome.tabs.sendMessage(tabNum, {
            method: "movieRenderConfirmationNotLastOne",
            replaysToRender: replaysToRender,
            replayI: replayI,
            tabNum: tabNum
        })
    }
}

// this is a function to get all the keys in the object store
//   It also gets the list of names of rendered movies
//   It sends a message to the content script once it gets the keys and movie names
function listItems() {
    var allKeys = []
    var transaction = db.transaction(["positions"], "readonly");
    var store = transaction.objectStore("positions");
    var request = store.openCursor(null);
    request.onsuccess = function () {
        if (request.result) {
            allKeys.push(request.result.key);
            request.result.continue()
        } else {
            createFileSystem('savedMovies', getRenderedMovieNames, [allKeys])
        }
    }
}

// this function gets all positions keys in object store
//   it then cleans out filesystem of any rendered replay that isn't in indexedDB object store
function getCurrentReplaysForCleaning() {
    var allKeys = []
    var transaction = db.transaction(["positions"], "readonly");
    var store = transaction.objectStore("positions");
    var request = store.openCursor(null);
    request.onsuccess = function () {
        if (request.result) {
            allKeys.push(request.result.key);
            request.result.continue()
        } else {
            console.log(allKeys)
            createFileSystem('savedMovies', cleanMovieFiles, [allKeys])
        }
    }
}

// this is a function to get position data from the object store
//   It sends a message to the content script once it gets the data 
function getPosData(dataFileName) {
    positionData = []
    var transaction = db.transaction(["positions"], "readonly");
    var store = transaction.objectStore("positions");
    var request = store.get(dataFileName);
    request.onsuccess = function () {
        thisObj = request.result.value
        chrome.tabs.sendMessage(tabNum, {method: "positionData", title: request.result, movieName: dataFileName})
        console.log('sent reply')
    }
}

// this gets position data from object store so that it can be downloaded by user.
function getPosDataForDownload(dataFileName) {
    positionData = []
    var transaction = db.transaction(["positions"], "readonly");
    var store = transaction.objectStore("positions");
    var request = store.get(dataFileName);
    request.onsuccess = function () {
        chrome.tabs.sendMessage(tabNum, {
            method: "positionDataForDownload",
            fileName: dataFileName,
            title: request.result
        })
        console.log('sent reply - ' + dataFileName)
    }
}

// this deletes data from the object store
function deleteData(dataFileName) {
    var transaction = db.transaction(["positions"], "readwrite");
    var store = transaction.objectStore("positions");
    if ($.isArray(dataFileName)) {
        deleted = []
        for (fTD in dataFileName) {
            request = store.delete(dataFileName[fTD])
            request.onsuccess = function () {
                deleted.push(fTD)
                if (deleted.length == dataFileName.length) {
                    chrome.tabs.sendMessage(tabNum, {method: 'dataDeleted'})
                    console.log('sent reply')
                }
            }
        }
    } else {
        request = store.delete(dataFileName)
        request.onsuccess = function () {
            chrome.tabs.sendMessage(tabNum, {method: 'dataDeleted'})
            console.log('sent reply')
        }
    }
}

// this renames data in the object store
function renameData(oldName, newName) {
    var transaction = db.transaction(["positions"], "readonly");
    var store = transaction.objectStore("positions");
    var request = store.get(oldName);
    request.onsuccess = function () {
        thisObj = request.result
        var transaction2 = db.transaction(["positions"], "readwrite");
        var store = transaction2.objectStore("positions");
        request = store.delete(oldName)
        request.onsuccess = function () {
            transaction3 = db.transaction(["positions"], "readwrite")
            objectStore = transaction3.objectStore('positions')
            request = objectStore.add(thisObj, newName)
            request.onsuccess = function () {
                chrome.tabs.sendMessage(tabNum, {method: "fileRenameSuccess"})
                console.log('sent reply')
            }
        }
    }
}

// this renders a movie and stores it in the savedMovies FileSystem
function renderMovie(name, useTextures, useSplats, lastOne, replaysToRender, replayI, tabNum) {
    if (useTextures) {
        if (typeof localStorage.getItem('tiles') !== "undefined" & localStorage.getItem('tiles') !== null) {
            img.src = localStorage.getItem('tiles')
        } else {
            img.src = defaultTextures.tiles
        }
        if (typeof localStorage.getItem('portal') !== "undefined" & localStorage.getItem('portal') !== null) {
            portalImg.src = localStorage.getItem('portal')
        } else {
            portalImg.src = defaultTextures.portal
        }
        if (typeof localStorage.getItem('speedpad') !== "undefined" & localStorage.getItem('speedpad') !== null) {
            speedpadImg.src = localStorage.getItem('speedpad')
        } else {
            speedpadImg.src = defaultTextures.speedpad
        }
        if (typeof localStorage.getItem('speedpadred') !== "undefined" & localStorage.getItem('speedpadred') !== null) {
            speedpadredImg.src = localStorage.getItem('speedpadred')
        } else {
            speedpadredImg.src = defaultTextures.speedpadred
        }
        if (typeof localStorage.getItem('speedpadblue') !== "undefined" & localStorage.getItem('speedpadblue') !== null) {
            speedpadblueImg.src = localStorage.getItem('speedpadblue')
        } else {
            speedpadblueImg.src = defaultTextures.speedpadblue
        }
        if (typeof localStorage.getItem('splats') !== "undefined" & localStorage.getItem('splats') !== null) {
            splatsImg.src = localStorage.getItem('splats')
        } else {
            splatsImg.src = defaultTextures.splats
        }
    } else {
        img.src = defaultTextures.tiles
        portalImg.src = defaultTextures.portal
        speedpadImg.src = defaultTextures.speedpad
        speedpadredImg.src = defaultTextures.speedpadred
        speedpadblueImg.src = defaultTextures.speedpadblue
        splatsImg.src = defaultTextures.splats
    }

    setTimeout(function () {
        var transaction = db.transaction(["positions"], "readonly");
        var store = transaction.objectStore("positions");
        var request = store.get(name);
        request.onsuccess = function () {
            if (typeof JSON.parse(request.result).clock !== "undefined") {
                if (typeof replaysToRender !== 'undefined') {
                    renderVideo(request.result, name, useSplats, lastOne, replaysToRender, replayI, tabNum)
                } else {
                    renderVideo(request.result, name, useSplats, lastOne)
                }
            } else {
                chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    tabNum = tabs[0].id
                    chrome.tabs.sendMessage(tabNum, {method: "movieRenderFailure"})
                    console.log('sent movie render failure notice')
                })
            }
        }, 2000
    })
}


// this downloads a rendered movie (found in the FileSystem) to disk
function downloadMovie(name) {
    //var nameDate = name.replace(/.*DATE/,'').replace('replays','')
    createFileSystem('savedMovies', getMovieFile, [name])
}

// this function "cleans" position data when user clicked record too soon after start of game
function cleanPositionData(positionDAT) {
    for (cleanI = 0; cleanI < positionDAT.clock.length; cleanI++) {
        if (positionDAT.clock[cleanI] == 0) {
            for (positionStat in positionDAT) {
                if (positionStat.search('player') == 0) {
                    for (playerStat in positionDAT[positionStat]) {
                        if ($.isArray(positionDAT[positionStat][playerStat])) {
                            positionDAT[positionStat][playerStat].shift()
                        }
                    }
                }
            }
            for (cleanFloorTile in positionDAT.floorTiles) {
                positionDAT.floorTiles[cleanFloorTile].value.shift()
            }
            positionDAT.clock.shift()
            positionDAT.score.shift()
            cleanI--
        }
    }
    return (positionDAT)
}

// this saves custom texture files to localStorage
function saveTextures(textureData) {
    if (typeof textureData.tiles !== 'undefined') {
        localStorage.setItem('tiles', textureData.tiles)
    } else {
        localStorage.removeItem('tiles')
    }
    if (typeof textureData.portal !== 'undefined') {
        localStorage.setItem('portal', textureData.portal)
    } else {
        localStorage.removeItem('portal')
    }
    if (typeof textureData.speedpad !== 'undefined') {
        localStorage.setItem('speedpad', textureData.speedpad)
    } else {
        localStorage.removeItem('speedpad')
    }
    if (typeof textureData.speedpadred !== 'undefined') {
        localStorage.setItem('speedpadred', textureData.speedpadred)
    } else {
        localStorage.removeItem('speedpadred')
    }
    if (typeof textureData.speedpadblue !== 'undefined') {
        localStorage.setItem('speedpadblue', textureData.speedpadblue)
    } else {
        localStorage.removeItem('speedpadblue')
    }
    if (typeof textureData.splats !== 'undefined') {
        localStorage.setItem('splats', textureData.splats)
    } else {
        localStorage.removeItem('splats')
    }
}

// Set up indexedDB
var openRequest = indexedDB.open("ReplayDatabase");
openRequest.onupgradeneeded = function (e) {
    console.log("running onupgradeneeded");
    var thisDb = e.target.result;
    //Create Object Store
    if (!thisDb.objectStoreNames.contains("positions")) {
        console.log("I need to make the positions objectstore");
        var objectStore = thisDb.createObjectStore("positions", {autoIncrement: true});
    }
    if (!thisDb.objectStoreNames.contains("savedMovies")) {
        console.log("I need to make the savedMovies objectstore");
        var objectStore = thisDb.createObjectStore("savedMovies", {autoIncrement: true});
    }
}

openRequest.onsuccess = function (e) {
    db = e.target.result;
    db.onerror = function (e) {
        alert("Sorry, an unforseen error was thrown.");
        console.log("***ERROR***");
        console.dir(e.target);
    }

    if (!db.objectStoreNames.contains("positions")) {
        version = db.version
        db.close()
        secondRequest = indexedDB.open("ReplayDatabase", version + 1)
        secondRequest.onupgradeneeded = function (e) {
            console.log("running onupgradeneeded");
            var thisDb = e.target.result;
            //Create Object Store
            if (!thisDb.objectStoreNames.contains("positions")) {
                console.log("I need to make the positions objectstore");
                var objectStore = thisDb.createObjectStore("positions", {autoIncrement: true});
            }
            if (!thisDb.objectStoreNames.contains("savedMovies")) {
                console.log("I need to make the savedMovies objectstore");
                var objectStore = thisDb.createObjectStore("savedMovies", {autoIncrement: true});
            }
        }
        secondRequest.onsuccess = function (e) {
            db = e.target.result
        }
    }
    if (!db.objectStoreNames.contains("savedMovies")) {
        version = db.version
        db.close()
        secondRequest = indexedDB.open("ReplayDatabase", version + 1)
        secondRequest.onupgradeneeded = function (e) {
            console.log("running onupgradeneeded");
            var thisDb = e.target.result;
            //Create Object Store
            if (!thisDb.objectStoreNames.contains("positions")) {
                console.log("I need to make the positions objectstore");
                var objectStore = thisDb.createObjectStore("positions", {autoIncrement: true});
            }
            if (!thisDb.objectStoreNames.contains("savedMovies")) {
                console.log("I need to make the savedMovies objectstore");
                var objectStore = thisDb.createObjectStore("savedMovies", {autoIncrement: true});
            }
        }
        secondRequest.onsuccess = function (e) {
            db = e.target.result
        }
    }
}

var title;
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.method == 'setPositionData') {
        if (typeof message.newName !== 'undefined') {
            var name = message.newName
        } else {
            var name = 'replays' + new Date().getTime()
        }
        console.log('new key is ' + name)
        transaction = db.transaction(["positions"], "readwrite")
        objectStore = transaction.objectStore('positions')
        console.log('got data from content script.')
        positions = cleanPositionData(JSON.parse(message.positionData))
        request = objectStore.put(JSON.stringify(positions), name)
        request.onsuccess = function () {
            chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                tabNum = tabs[0].id
                chrome.tabs.sendMessage(tabNum, {method: "dataSetConfirmationFromBG"})
                console.log('sent confirmation')
            })
        }
    } else if (message.method == 'requestData') {
        console.log('got data request for ' + message.fileName)
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            getPosData(message.fileName)
        })
    } else if (message.method == 'requestList') {
        console.log('got list request')
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            listItems()
        })
    } else if (message.method == 'requestDataForDownload') {
        console.log('got data request for download - ' + message.fileName)
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            getPosDataForDownload(message.fileName)
        })
    } else if (message.method == 'requestDataDelete') {
        console.log('got delete request for ' + message.fileName)
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            deleteData(message.fileName)
        })
    } else if (message.method == 'requestFileRename') {
        console.log('got rename request for ' + message.oldName + ' to ' + message.newName)
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            renameData(message.oldName, message.newName)
        })
    } else if (message.method == 'renderMovie') {
        console.log('got request to render Movie for ' + message.name)
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            renderMovie(message.name, message.useTextures, message.useSplats, true)
        })
    } else if (message.method == 'downloadMovie') {
        console.log('got request to download Movie for ' + message.name)
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            downloadMovie(message.name)
        })
    } else if (message.method == 'setTextureData') {
        console.log('got request to save texture image files')
        saveTextures(JSON.parse(message.textureData))
        /*chrome.tabs.query({
         active: true,
         currentWindow: true
         }, function(tabs) {
         tabNum = tabs[0].id;
         chrome.tabs.sendMessage(tabNum, { method:"textureSaveConfirmation" });
         });*/
    } else if (message.method == 'cleanRenderedReplays') {
        console.log('got request to clean rendered replays')
        getCurrentReplaysForCleaning()
    } else if (message.method == 'renderAllInitial') {
        console.log('got request to render these replays: ' + message.data)
        console.log('rendering the first one: ' + message.data[0])
        if (message.data.length == 1) {
            lastOne = true
        } else {
            lastOne = false
        }
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            tabNum = tabs[0].id
            renderMovie(message.data[0], message.useTextures, message.useSplats, lastOne, message.data, 0, tabNum)
        })
    } else if (message.method == 'renderAllSubsequent') {
        console.log('got request to render subsequent replay: ' + message.data[message.replayI])
        renderMovie(message.data[message.replayI], message.useTextures, message.useSplats, message.lastOne, message.data, message.replayI, message.tabNum)
    }
});


